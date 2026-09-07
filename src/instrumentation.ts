import type { Instrumentation } from "next";
import packageJson from "../package.json";
import {
  buildServerActionErrorRecord,
  buildServerStartupRecord,
  sanitizePublicIdentifier,
} from "@/lib/server-action-observability";

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  console.info("[RARE application] startup", buildServerStartupRecord({ appVersion: packageJson.version }));
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
