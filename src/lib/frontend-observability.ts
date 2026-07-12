type FrontendIssueLevel = "error" | "warning";

type FrontendIssueRecord = {
  level: FrontendIssueLevel;
  source: "storefront";
  route: string;
  kind: string;
};

const safeKinds = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError"]);

export function sanitizeFrontendRoute(value: string | null | undefined) {
  try {
    const url = new URL(value || "/", "https://raredept.com.br");
    const pathname = url.pathname.replace(/[^/A-Za-z0-9._~-]/g, "-").replace(/\/{2,}/g, "/");
    return pathname.startsWith("/") ? pathname.slice(0, 160) || "/" : "/";
  } catch {
    return "/";
  }
}

export function buildFrontendIssueRecord(
  error: unknown,
  input: { level?: FrontendIssueLevel; route?: string | null } = {},
): FrontendIssueRecord {
  const rawKind = error instanceof Error ? error.name : "Error";
  return {
    level: input.level ?? "error",
    source: "storefront",
    route: sanitizeFrontendRoute(input.route),
    kind: safeKinds.has(rawKind) ? rawKind : "Error",
  };
}

export function reportFrontendError(error: unknown, route?: string | null) {
  console.error("[RARE frontend] unexpected error", buildFrontendIssueRecord(error, { route }));
}
