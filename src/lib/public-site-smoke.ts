import { getSecurityHeaders } from "./security-headers";

export const DEFAULT_PUBLIC_SITE_URL = "https://raredept.com.br";

export type PublicSmokeStatus = "OK" | "WARNING" | "FAIL";

export type PublicSmokeCheck = {
  status: PublicSmokeStatus;
  label: string;
  message: string;
};

export type PublicSmokeResult = {
  baseUrl: string;
  checks: PublicSmokeCheck[];
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type CapturedResponse = {
  label: string;
  path: string;
  status: number;
  headers: Headers;
  body: string;
};

const securityHeaderNames = getSecurityHeaders().map((header) => header.key);
const cspReportOnlyHeader = "Content-Security-Policy-Report-Only";
const forbiddenSitemapPathPrefixes = ["/admin", "/api", "/checkout", "/minha-conta", "/pedido", "/pedidos"];

const secretLeakRules: Array<{ label: string; pattern: RegExp }> = [
  { label: "Stripe live secret key", pattern: /\bsk_live_[A-Za-z0-9_=-]+/ },
  { label: "Stripe test secret key", pattern: /\bsk_test_[A-Za-z0-9_=-]+/ },
  { label: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_=-]+/ },
  { label: "PostgreSQL connection URL", pattern: /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/i },
  { label: "Redis connection URL", pattern: /\brediss?:\/\/[^\s"'<>]+/i },
  { label: "Bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}=*/i },
];

function add(checks: PublicSmokeCheck[], status: PublicSmokeStatus, label: string, message: string) {
  checks.push({ status, label, message });
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : "Unknown error.";
}

function normalizeUrlCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_PUBLIC_SITE_URL;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function resolvePublicSmokeBaseUrl(cliUrl?: string, env: Record<string, string | undefined> = process.env) {
  const candidate = normalizeUrlCandidate(cliUrl?.trim() || env.SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_URL);
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use uma URL http ou https.");
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function buildPublicSmokeUrl(baseUrl: string, path: string) {
  return new URL(path, `${baseUrl}/`);
}

async function fetchWithTimeout(fetchImpl: FetchLike, url: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      redirect: "follow",
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function captureResponse(params: {
  baseUrl: string;
  path: string;
  method: "GET" | "HEAD";
  label: string;
  checks: PublicSmokeCheck[];
  fetchImpl: FetchLike;
  timeoutMs: number;
  readBody?: boolean;
}) {
  try {
    const response = await fetchWithTimeout(
      params.fetchImpl,
      buildPublicSmokeUrl(params.baseUrl, params.path),
      { method: params.method, cache: "no-store" },
      params.timeoutMs,
    );
    const body = params.readBody ? await response.text() : "";

    return {
      label: params.label,
      path: params.path,
      status: response.status,
      headers: response.headers,
      body,
    } satisfies CapturedResponse;
  } catch (error) {
    add(params.checks, "FAIL", params.label, `${params.method} ${params.path} falhou: ${safeErrorMessage(error)}`);
    return null;
  }
}

function checkExpectedStatus(checks: PublicSmokeCheck[], response: CapturedResponse | null, expectedStatus: number, label: string) {
  if (!response) return;

  if (response.status === expectedStatus) {
    add(checks, "OK", label, `${response.path} retornou ${expectedStatus}.`);
    return;
  }

  add(checks, "FAIL", label, `${response.path} retornou ${response.status}; esperado ${expectedStatus}.`);
}

function checkSecurityHeaders(checks: PublicSmokeCheck[], response: CapturedResponse | null) {
  if (!response) return;

  for (const headerName of securityHeaderNames) {
    const value = response.headers.get(headerName);
    if (value?.trim()) {
      add(checks, "OK", `security:${headerName}`, "Header presente.");
    } else {
      add(checks, "FAIL", `security:${headerName}`, "Header ausente na resposta publica.");
    }
  }

  if (response.headers.get(cspReportOnlyHeader)?.trim()) {
    add(checks, "OK", "security:csp-report-only", "CSP Report-Only presente.");
  } else {
    add(checks, "FAIL", "security:csp-report-only", "Content-Security-Policy-Report-Only ausente.");
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function findForbiddenSitemapPaths(sitemapXml: string) {
  const paths = new Set<string>();
  const locs = Array.from(sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((match) => decodeXmlEntities(match[1] ?? ""));

  for (const loc of locs) {
    try {
      const path = new URL(loc).pathname;
      for (const prefix of forbiddenSitemapPathPrefixes) {
        if (path === prefix || path.startsWith(`${prefix}/`)) {
          paths.add(path);
        }
      }
    } catch {
      for (const prefix of forbiddenSitemapPathPrefixes) {
        if (loc.includes(prefix)) {
          paths.add(prefix);
        }
      }
    }
  }

  if (!locs.length) {
    for (const prefix of forbiddenSitemapPathPrefixes) {
      if (sitemapXml.includes(prefix)) {
        paths.add(prefix);
      }
    }
  }

  return [...paths].sort();
}

function checkSitemapContent(checks: PublicSmokeCheck[], response: CapturedResponse | null) {
  if (!response) return;

  const forbiddenPaths = findForbiddenSitemapPaths(response.body);
  if (forbiddenPaths.length) {
    add(checks, "FAIL", "sitemap:private-routes", `Sitemap contem rotas privadas ou operacionais: ${forbiddenPaths.join(", ")}.`);
    return;
  }

  add(checks, "OK", "sitemap:private-routes", "Sitemap nao contem rotas privadas ou operacionais conhecidas.");
}

function checkHealthJson(checks: PublicSmokeCheck[], response: CapturedResponse | null) {
  if (!response) return;

  if (response.status < 200 || response.status >= 300) {
    add(checks, "FAIL", "health:status", `/api/health retornou ${response.status}; esperado 2xx.`);
  } else {
    add(checks, "OK", "health:status", "/api/health retornou status HTTP 2xx.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    add(checks, "OK", "health:content-type", "Content-Type JSON presente.");
  } else {
    add(checks, "WARNING", "health:content-type", "Content-Type nao informa application/json.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
    add(checks, "OK", "health:json", "/api/health respondeu JSON valido.");
  } catch {
    add(checks, "FAIL", "health:json", "/api/health nao respondeu JSON valido.");
    return;
  }

  const status = parsed && typeof parsed === "object" && "status" in parsed ? String((parsed as { status?: unknown }).status ?? "") : "";
  if (status === "ok") {
    add(checks, "OK", "health:app-status", "Health status ok.");
  } else if (status === "ok_with_warnings") {
    add(checks, "WARNING", "health:app-status", "Health status ok_with_warnings.");
  } else if (status) {
    add(checks, "FAIL", "health:app-status", `Health status ${status}.`);
  } else {
    add(checks, "WARNING", "health:app-status", "Health JSON nao possui campo status.");
  }
}

function headersToScanText(headers: Headers) {
  const lines: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      lines.push(`${key}: ${value}`);
    }
  });
  return lines.join("\n");
}

function scanForSecretLeaks(checks: PublicSmokeCheck[], responses: CapturedResponse[]) {
  let leakCount = 0;

  for (const response of responses) {
    const publicText = `${headersToScanText(response.headers)}\n${response.body}`;
    for (const rule of secretLeakRules) {
      if (rule.pattern.test(publicText)) {
        leakCount += 1;
        add(checks, "FAIL", `leak:${response.path}`, `${response.label} contem marcador sensivel: ${rule.label}.`);
      }
    }
  }

  if (!leakCount) {
    add(checks, "OK", "leaks", "Nenhum marcador sensivel obvio encontrado nas respostas publicas verificadas.");
  }
}

export async function runPublicSiteSmoke(options: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
} = {}): Promise<PublicSmokeResult> {
  const baseUrl = resolvePublicSmokeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const checks: PublicSmokeCheck[] = [];
  const capturedResponses: CapturedResponse[] = [];

  add(checks, "OK", "target", `Validando ${baseUrl}.`);

  const homeHead = await captureResponse({
    baseUrl,
    path: "/",
    method: "HEAD",
    label: "home",
    checks,
    fetchImpl,
    timeoutMs,
  });
  checkSecurityHeaders(checks, homeHead);

  const robots = await captureResponse({
    baseUrl,
    path: "/robots.txt",
    method: "GET",
    label: "robots",
    checks,
    fetchImpl,
    timeoutMs,
    readBody: true,
  });
  checkExpectedStatus(checks, robots, 200, "robots");
  if (robots) capturedResponses.push(robots);

  const sitemap = await captureResponse({
    baseUrl,
    path: "/sitemap.xml",
    method: "GET",
    label: "sitemap",
    checks,
    fetchImpl,
    timeoutMs,
    readBody: true,
  });
  checkExpectedStatus(checks, sitemap, 200, "sitemap");
  checkSitemapContent(checks, sitemap);
  if (sitemap) capturedResponses.push(sitemap);

  const notFoundPaths = ["/produto/nao-existe", "/categoria/nao-existe", "/nonexistent-page"];
  for (const path of notFoundPaths) {
    const headResponse = await captureResponse({
      baseUrl,
      path,
      method: "HEAD",
      label: `not-found:${path}`,
      checks,
      fetchImpl,
      timeoutMs,
    });
    checkExpectedStatus(checks, headResponse, 404, `not-found:${path}`);

    const getResponse = await captureResponse({
      baseUrl,
      path,
      method: "GET",
      label: `not-found-body:${path}`,
      checks,
      fetchImpl,
      timeoutMs,
      readBody: true,
    });
    if (getResponse) capturedResponses.push(getResponse);
  }

  const health = await captureResponse({
    baseUrl,
    path: "/api/health",
    method: "GET",
    label: "health",
    checks,
    fetchImpl,
    timeoutMs,
    readBody: true,
  });
  checkHealthJson(checks, health);
  if (health) capturedResponses.push(health);

  scanForSecretLeaks(checks, capturedResponses);

  return { baseUrl, checks };
}

export function summarizePublicSmokeResult(result: PublicSmokeResult) {
  return {
    ok: result.checks.filter((check) => check.status === "OK").length,
    warnings: result.checks.filter((check) => check.status === "WARNING").length,
    failures: result.checks.filter((check) => check.status === "FAIL").length,
  };
}

export function hasPublicSmokeFailure(result: PublicSmokeResult) {
  return summarizePublicSmokeResult(result).failures > 0;
}

export function formatPublicSmokeReport(result: PublicSmokeResult) {
  const lines = [`Public site smoke: ${result.baseUrl}`];
  for (const check of result.checks) {
    lines.push(`${check.status} ${check.label}: ${check.message}`);
  }

  const summary = summarizePublicSmokeResult(result);
  lines.push(`Summary: ${summary.ok} OK, ${summary.warnings} WARNING, ${summary.failures} FAIL.`);
  return lines.join("\n");
}
