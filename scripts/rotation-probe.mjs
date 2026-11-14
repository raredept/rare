// Rotation proof for the credential incident (M-20): NEW WORKS / OLD FAILS, with status codes only.
// Secrets come from environment variables (never arguments, so they stay out of shell history) and are
// never printed. Production hosts and LIVE Stripe keys are refused.
//
//   PROBE_STRIPE_KEY=...      node scripts/rotation-probe.mjs stripe-key --expect=accepted|rejected
//   PROBE_WEBHOOK_SECRET=...  node scripts/rotation-probe.mjs stripe-webhook --url=https://<staging>/api/stripe/webhook --expect=...
//   [PROBE_CRON_SECRET=...]   node scripts/rotation-probe.mjs cron --url=https://<staging>/api/cron/release-expired-inventory --expect=rejected
//
// stripe-key: GET /v1/balance in test mode (read-only). stripe-webhook: a synthetic, unhandled event
// type signed with the given secret; the route answers 200 "ignored" (no side effect) or 400.
// cron: without a secret or with a wrong one the route answers 401 with no side effect; a valid secret
// RUNS the expiry job, so sending any secret requires --allow-run. In staging the Basic gate answers
// first (same Authorization header), which the probe reports as BLOCKED_BY_STAGING_GATE.
// Exit: 0 result matches --expect (or no --expect), 1 mismatch or inconclusive, 2 refused.

import { createHmac, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_HOSTS = new Set(["raredept.com.br", "www.raredept.com.br"]);

/** Only local and explicitly staging-labelled hosts are probed. */
export function isAllowedProbeUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(host)) return false;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return url.protocol === "http:" || url.protocol === "https:";
  return url.protocol === "https:" && host.split(/[.-]/).includes("staging");
}

export function isTestModeStripeKey(value) {
  return typeof value === "string" && /^(sk|rk)_test_[A-Za-z0-9]+$/.test(value);
}

/** The Stripe-Signature header for a payload, as Stripe computes it (t=<unix>,v1=<HMAC-SHA256>). */
export function stripeSignatureHeader(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

export function syntheticProbeEvent(timestamp = Math.floor(Date.now() / 1000)) {
  return JSON.stringify({
    id: `evt_rotation_probe_${randomBytes(6).toString("hex")}`,
    object: "event",
    type: "rare.rotation_probe",
    livemode: false,
    created: timestamp,
    data: { object: {} },
  });
}

export function classify(probe, status, headers = {}) {
  if (probe === "cron" && status === 401 && /basic/i.test(headers["www-authenticate"] ?? "")) return "BLOCKED_BY_STAGING_GATE";
  if (probe === "stripe-key") return status === 200 ? "ACCEPTED" : status === 401 ? "REJECTED" : "INCONCLUSIVE";
  if (probe === "stripe-webhook") return status === 200 ? "ACCEPTED" : status === 400 ? "REJECTED" : status === 500 ? "NOT_CONFIGURED" : "INCONCLUSIVE";
  if (probe === "cron") return status === 200 || status === 207 ? "ACCEPTED" : status === 401 ? "REJECTED" : status === 503 ? "NOT_CONFIGURED" : "INCONCLUSIVE";
  return "INCONCLUSIVE";
}

async function run() {
  const probe = process.argv[2];
  const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const expected = option("expect")?.toUpperCase();
  const refuse = (message) => { console.error(`REFUSED ${message}`); process.exit(2); };
  if (expected && !["ACCEPTED", "REJECTED"].includes(expected)) refuse("--expect must be accepted or rejected.");

  let response;
  if (probe === "stripe-key") {
    const key = process.env.PROBE_STRIPE_KEY?.trim();
    if (!key) refuse("PROBE_STRIPE_KEY is not set.");
    if (!isTestModeStripeKey(key)) refuse("only TEST-mode Stripe keys are probed.");
    response = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
  } else if (probe === "stripe-webhook") {
    const url = option("url");
    const secret = process.env.PROBE_WEBHOOK_SECRET?.trim();
    if (!url || !isAllowedProbeUrl(url)) refuse("--url must be a local or staging host (never production).");
    if (!secret) refuse("PROBE_WEBHOOK_SECRET is not set.");
    const payload = syntheticProbeEvent();
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": stripeSignatureHeader(payload, secret) }, body: payload });
  } else if (probe === "cron") {
    const url = option("url");
    const secret = process.env.PROBE_CRON_SECRET?.trim();
    if (!url || !isAllowedProbeUrl(url)) refuse("--url must be a local or staging host (never production).");
    if (secret && !process.argv.includes("--allow-run")) refuse("a secret that is accepted runs the expiry job; add --allow-run to send one.");
    response = await fetch(url, { method: "POST", headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
  } else {
    refuse("probe must be stripe-key, stripe-webhook or cron.");
  }
  await response.arrayBuffer(); // the body is never printed: Stripe errors echo the key's last characters
  const result = classify(probe, response.status, { "www-authenticate": response.headers.get("www-authenticate") ?? "" });
  const verdict = expected ? (result === expected ? "PASS" : "FAIL") : "RECORDED";
  console.log(JSON.stringify({ probe, httpStatus: response.status, result, expected: expected ?? null, verdict, at: new Date().toISOString() }));
  process.exitCode = verdict === "FAIL" || result === "INCONCLUSIVE" || result === "BLOCKED_BY_STAGING_GATE" ? 1 : 0;
}

const samePath = (first, second) => (process.platform === "win32" ? first.toLowerCase() === second.toLowerCase() : first === second);
if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  run().catch(() => { console.error("FAILED probe could not complete (details withheld)."); process.exitCode = 1; });
}
