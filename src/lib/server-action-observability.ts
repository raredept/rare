export type ServerActionAuthState = "admin" | "customer" | "anonymous" | "unknown";

type Environment = Record<string, string | undefined>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safeGitShaPattern = /^[a-f0-9]{7,64}$/i;
const safeMethodPattern = /^(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/;
const safeEnvironments = new Set(["production", "development", "test"]);

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function sanitizePublicIdentifier(value: string | undefined) {
  const candidate = clean(value);
  return candidate && safeIdentifierPattern.test(candidate) ? candidate : null;
}

export function sanitizeReleaseSha(value: string | undefined) {
  const candidate = clean(value);
  return candidate && safeGitShaPattern.test(candidate) ? candidate.toLowerCase() : null;
}

export function sanitizeServerActionRoute(value: string | null | undefined) {
  try {
    const url = new URL(value || "/", "https://raredept.com.br");
    const pathname = url.pathname.replace(/[^/A-Za-z0-9._~-]/g, "-").replace(/\/{2,}/g, "/");
    return pathname.startsWith("/") ? pathname.slice(0, 160) || "/" : "/";
  } catch {
    return "/";
  }
}

export function getServerActionDeploymentId(environment: Environment = process.env) {
  return (
    sanitizePublicIdentifier(environment.NEXT_DEPLOYMENT_ID) ??
    sanitizePublicIdentifier(environment.RAILWAY_DEPLOYMENT_ID) ??
    sanitizeReleaseSha(environment.RAILWAY_GIT_COMMIT_SHA) ??
    undefined
  );
}

export function getServerRuntimeMetadata(environment: Environment, appVersion: string) {
  const runtimeEnvironment = clean(environment.NODE_ENV)?.toLowerCase();
  return {
    environment: runtimeEnvironment && safeEnvironments.has(runtimeEnvironment) ? runtimeEnvironment : "unknown",
    appVersion: sanitizePublicIdentifier(appVersion) ?? "unknown",
    releaseSha: sanitizeReleaseSha(environment.RAILWAY_GIT_COMMIT_SHA),
    buildId: getServerActionDeploymentId(environment) ?? null,
    deploymentId: sanitizePublicIdentifier(environment.RAILWAY_DEPLOYMENT_ID),
    replicaId: sanitizePublicIdentifier(environment.RAILWAY_REPLICA_ID),
  };
}

export function isServerActionRequest(method: string, headers: Pick<Headers, "has">) {
  return method.toUpperCase() === "POST" && headers.has("next-action");
}

export function buildServerActionRequestRecord(input: {
  route: string;
  method: string;
  requestId: string;
  authState: ServerActionAuthState;
  environment?: Environment;
  appVersion: string;
  timestamp?: string;
}) {
  const method = input.method.toUpperCase();
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: "info" as const,
    source: "server_action" as const,
    category: "server_action_request" as const,
    requestId: sanitizePublicIdentifier(input.requestId) ?? "invalid",
    route: sanitizeServerActionRoute(input.route),
    method: safeMethodPattern.test(method) ? method : "UNKNOWN",
    authState: input.authState,
    ...getServerRuntimeMetadata(input.environment ?? process.env, input.appVersion),
  };
}

export function buildServerActionErrorRecord(input: {
  route: string;
  method: string;
  requestId?: string;
  environment?: Environment;
  appVersion: string;
  timestamp?: string;
}) {
  const method = input.method.toUpperCase();
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: "error" as const,
    source: "server_action" as const,
    category: "server_action_execution_error" as const,
    requestId: sanitizePublicIdentifier(input.requestId) ?? crypto.randomUUID(),
    route: sanitizeServerActionRoute(input.route),
    method: safeMethodPattern.test(method) ? method : "UNKNOWN",
    authState: "unknown" as const,
    ...getServerRuntimeMetadata(input.environment ?? process.env, input.appVersion),
  };
}

export function buildServerStartupRecord(input: {
  environment?: Environment;
  appVersion: string;
  timestamp?: string;
}) {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: "info" as const,
    source: "application" as const,
    category: "server_startup" as const,
    ...getServerRuntimeMetadata(input.environment ?? process.env, input.appVersion),
  };
}
