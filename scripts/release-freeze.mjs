// Release security freeze. The committed record docs/security/RELEASE_FREEZE.json is the only thing
// that can lift it: the exact state "CLEARED" plus closure evidence that exists in the repository.
// Anything else — a missing or unreadable record, a typo, "false", "0", "off", "disabled" — keeps the
// freeze ACTIVE. The RELEASE_SECURITY_FREEZE environment variable can only switch the freeze on.
//
// While active, a production release fails closed; staging and development only warn, so the
// staging rotation and homologation can proceed.
//
// CLI (Railway pre-deploy, release checks): node scripts/release-freeze.mjs [--target=<environment>]
// Exit code 1 when a production release is blocked.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FREEZE_RECORD_PATH = "docs/security/RELEASE_FREEZE.json";

// Same names as src/lib/deployment-environment.ts (kept in sync by a unit test).
const PRODUCTION_NAMES = ["production", "prod", "live"];
const RESTRICTED_NAMES = ["staging", "preview", "homologation"];
const DEVELOPMENT_NAMES = ["development", "test"];
export const RELEASE_ENVIRONMENT_NAMES = { production: PRODUCTION_NAMES, restricted: RESTRICTED_NAMES, development: DEVELOPMENT_NAMES };

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readFreezeRecord(root = repositoryRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, FREEZE_RECORD_PATH), "utf8"));
  } catch {
    return null;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z)?$/;

// Owner-authorized release policy, 2026-11-13. Stripe revocation can remain an external incident
// only after both environments have disconnected it and internal session/cron risks are contained.
export const CONTAINMENT_CONDITIONS = [
  "sessionStagingRotatedAndOldRejected", "sessionProductionRotatedAndOldRejected",
  "cronStagingRotatedAndOldRemoved", "cronProductionRotatedAndOldRejected",
  "stripeStagingDisconnected", "stripeProductionDisconnected",
  "newStripePaymentsImpossible", "noStripeFallback", "asaasSandboxRealPassed",
  "stagingRealPassed", "initialProductionCheckoutOff",
];

/** ACTIVE unless the record says exactly CLEARED and carries a complete closure. */
export function evaluateFreezeRecord(record, { evidenceExists }) {
  if (!record || typeof record !== "object") return { state: "ACTIVE", reason: "freeze record missing or unreadable" };
  if (record.state === "ACTIVE") return { state: "ACTIVE", reason: "freeze record is ACTIVE" };
  if (record.state !== "CLEARED") return { state: "ACTIVE", reason: "unrecognised freeze state, treated as ACTIVE" };
  if (record.policyVersion !== 2) return { state: "ACTIVE", reason: "release policy version 2 required" };
  const closure = record.closure && typeof record.closure === "object" ? record.closure : {};
  const missing = [];
  if (typeof closure.clearedAt !== "string" || !ISO_DATE.test(closure.clearedAt) || Number.isNaN(Date.parse(closure.clearedAt))) missing.push("clearedAt");
  if (typeof closure.clearedBy !== "string" || !closure.clearedBy.trim()) missing.push("clearedBy");
  if (typeof closure.evidence !== "string" || !closure.evidence.trim() || !evidenceExists(closure.evidence)) missing.push("evidence");
  for (const condition of CONTAINMENT_CONDITIONS) {
    if (closure.conditions?.[condition] !== true) missing.push(condition);
  }
  if (!["MANUAL_PENDING", "REVOKED"].includes(closure.legacyStripeCredentialStatus)) missing.push("legacyStripeCredentialStatus");
  if (missing.length) return { state: "ACTIVE", reason: `CLEARED without a valid closure (${missing.join(", ")}), treated as ACTIVE` };
  return { state: "CLEARED", reason: "freeze cleared with recorded closure evidence" };
}

export function classifyEnvironmentName(value) {
  const name = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!name) return null;
  if (PRODUCTION_NAMES.includes(name)) return "production";
  if (RESTRICTED_NAMES.includes(name)) return "restricted";
  if (DEVELOPMENT_NAMES.includes(name)) return "development";
  return "unknown";
}

/**
 * Where this release goes. Any production or unrecognised signal makes it production (fail closed):
 * an explicit --target, RELEASE_TARGET, APP_ENV and Railway's RAILWAY_ENVIRONMENT_NAME all count.
 */
export function resolveReleaseTarget(env, explicitTarget) {
  const signals = [explicitTarget, env.RELEASE_TARGET, env.APP_ENV, env.RAILWAY_ENVIRONMENT_NAME].map(classifyEnvironmentName).filter(Boolean);
  if (!signals.length) return env.NODE_ENV?.trim().toLowerCase() === "production" ? "production" : "development";
  if (signals.some((signal) => signal === "production" || signal === "unknown")) return "production";
  if (signals.includes("restricted")) return "restricted";
  return "development";
}

export function decideRelease({ freeze, target, environmentFreeze }) {
  const value = typeof environmentFreeze === "string" ? environmentFreeze.trim() : "";
  const forcedByEnvironment = value.toUpperCase() === "ACTIVE";
  const notes = value && !forcedByEnvironment ? ["RELEASE_SECURITY_FREEZE can only activate the freeze; this value was ignored"] : [];
  const active = freeze.state !== "CLEARED" || forcedByEnvironment;
  const reason = forcedByEnvironment && freeze.state === "CLEARED" ? "RELEASE_SECURITY_FREEZE=ACTIVE set in the environment" : freeze.reason;
  if (!active) return { allowed: true, level: "ok", active, target, reason, notes };
  if (target === "production") return { allowed: false, level: "fail", active, target, reason, notes };
  return { allowed: true, level: "warn", active, target, reason, notes };
}

export function getProductionConfigurationIssue(env) {
  const retiredCredentials = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CRON_SECRET_PREVIOUS"].some((name) => env[name]?.trim());
  const provider = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  return retiredCredentials || !["asaas", "disabled"].includes(provider ?? "")
    ? "production must use Asaas or disabled and contain no retired Stripe/cron credentials"
    : null;
}

/** @param {{ root?: string, env?: Record<string, string | undefined>, explicitTarget?: string }} [options] */
export function checkReleaseFreeze({ root = repositoryRoot, env = process.env, explicitTarget } = {}) {
  const resolvedRoot = path.resolve(root);
  const evidenceExists = (relative) => {
    const full = path.resolve(resolvedRoot, relative);
    return full.startsWith(resolvedRoot + path.sep) && fs.existsSync(full) && fs.statSync(full).isFile();
  };
  const freeze = evaluateFreezeRecord(readFreezeRecord(resolvedRoot), { evidenceExists });
  const decision = decideRelease({ freeze, target: resolveReleaseTarget(env, explicitTarget), environmentFreeze: env.RELEASE_SECURITY_FREEZE });
  if (decision.target === "production" && decision.allowed) {
    const issue = getProductionConfigurationIssue(env);
    if (issue) return { ...decision, allowed: false, level: "fail", reason: issue };
  }
  return decision;
}

const samePath = (first, second) => (process.platform === "win32" ? first.toLowerCase() === second.toLowerCase() : first === second);
const invokedDirectly = Boolean(process.argv[1]) && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const explicitTarget = process.argv.find((argument) => argument.startsWith("--target="))?.slice("--target=".length);
  const decision = checkReleaseFreeze({ explicitTarget });
  const line = `release-freeze target=${decision.target} freeze=${decision.active ? "ACTIVE" : "CLEARED"}: ${decision.reason}`;
  if (decision.level === "fail") {
    console.error(`FAIL ${line}. Production release blocked until ${FREEZE_RECORD_PATH} is CLEARED with closure evidence.`);
    process.exitCode = 1;
  } else if (decision.level === "warn") {
    console.warn(`WARNING ${line}. Non-production release allowed.`);
  } else {
    console.log(`OK ${line}`);
  }
  for (const note of decision.notes) console.warn(`WARNING ${note}`);
}
