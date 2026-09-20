import type { Instrumentation } from "next";
import packageJson from "../package.json";
import { detectConfigDrift } from "@/lib/config-drift";
import { getStorageDriver, isLocalStorageAllowedInProduction, isProductionEnv } from "@/lib/env";
import {
  buildServerActionErrorRecord,
  buildServerStartupRecord,
  sanitizePublicIdentifier,
} from "@/lib/server-action-observability";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  console.info("[RARE application] startup", buildServerStartupRecord({ appVersion: packageJson.version }));

  // Uploads already fail closed; this makes the misconfiguration visible at boot.
  try {
    if (isProductionEnv() && getStorageDriver() === "local" && !isLocalStorageAllowedInProduction()) {
      console.error("[RARE application] misconfiguration: production is using local storage; uploads are refused until STORAGE_DRIVER=r2.");
    }
  } catch {
    console.error("[RARE application] misconfiguration: STORAGE_DRIVER is invalid.");
  }

  // Credentials belonging to another environment. Logged, never thrown: a boot
  // refusal on a false positive would take the storefront down, and the payment
  // path refuses on its own in assertCheckoutCredentialsMatchEnvironment.
  for (const issue of detectConfigDrift()) {
    const log = issue.level === "error" ? console.error : console.warn;
    log(`[RARE application] config drift (${issue.level})`, { variable: issue.variable, message: issue.message });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  if (context.routeType !== "action") return;

  const requestIdHeader = request.headers["x-rare-request-id"];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
  console.error("[RARE server action] execution error", buildServerActionErrorRecord({
    route: request.path,
    method: request.method,
    requestId: sanitizePublicIdentifier(requestId) ?? undefined,
    appVersion: packageJson.version,
  }));
};
