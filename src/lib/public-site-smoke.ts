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

// ---------------------------------------------------------------------------------------------
// RARE-SEO-GOOGLE-01: indexing checks (opt-in; the CLI turns them on). Only meaningful on the
// canonical production host — any other target is noindex/disallow by design.
// ---------------------------------------------------------------------------------------------

const CANONICAL_HOST = "raredept.com.br";
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const SEO_PUBLIC_PATHS = ["/", "/contato", "/contato?utm_source=x", "/sobre", "/suporte", "/categoria/tudo", "/produto/exemplo", "/_next/static/chunks/app.js", "/feeds/google-products.xml"];
const SEO_PRIVATE_PATHS = ["/admin", "/api/health", "/checkout", "/finalizar-compra", "/minha-conta", "/entrar", "/conta", "/conta?tab=perfil", "/conta/dados"];
const FILTERED_LISTING_PATH = "/categoria/tudo?sort=price-asc";
export const MERCHANT_FEED_SMOKE_PATH = "/feeds/google-products.xml";

/** Disallow rules that apply to a generic crawler ("User-agent: *" groups), per RFC 9309 grouping. */
export function getWildcardDisallowRules(robotsTxt: string) {
  const rules: string[] = [];
  let agents: string[] = [];
  let collectingAgents = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!collectingAgents) agents = [];
      agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if (field === "disallow" && value && agents.includes("*")) rules.push(value);
  }
  return rules;
}

/** Google-style match of a robots rule (prefix, `*` wildcard, `$` end anchor). */
export function robotsRuleMatches(rule: string, path: string) {
  const anchored = rule.endsWith("$");
  const pattern = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path);
}

function readCanonical(html: string) {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? null;
}

function readRobotsMeta(html: string) {
  return html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i)?.[1]?.toLowerCase() ?? null;
}

function readJsonLdTypes(html: string) {
  return Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)).flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1] ?? "") as { "@type"?: unknown };
      return typeof parsed["@type"] === "string" ? [parsed["@type"]] : [];
    } catch {
      return ["INVALID"];
    }
  });
}

async function runPublicSeoChecks(params: {
  baseUrl: string;
  checks: PublicSmokeCheck[];
  fetchImpl: FetchLike;
  timeoutMs: number;
  robots: CapturedResponse | null;
  sitemap: CapturedResponse | null;
  capturedResponses: CapturedResponse[];
}) {
  const { baseUrl, checks } = params;
  if (new URL(baseUrl).hostname !== CANONICAL_HOST) {
    add(checks, "OK", "seo:target", "Alvo nao canonico: checagens de indexacao ignoradas (staging/preview sao noindex por design).");
    return;
  }

  if (params.robots) {
    const body = params.robots.body;
    if (/^sitemap:\s*https:\/\/raredept\.com\.br\/sitemap\.xml\s*$/im.test(body)) add(checks, "OK", "seo:robots-sitemap", "robots.txt aponta o sitemap canonico.");
    else add(checks, "FAIL", "seo:robots-sitemap", "robots.txt nao declara Sitemap: https://raredept.com.br/sitemap.xml.");
    const rules = getWildcardDisallowRules(body);
    const blockedPublic = SEO_PUBLIC_PATHS.filter((path) => rules.some((rule) => robotsRuleMatches(rule, path)));
    const openPrivate = SEO_PRIVATE_PATHS.filter((path) => !rules.some((rule) => robotsRuleMatches(rule, path)));
    if (blockedPublic.length) add(checks, "FAIL", "seo:robots-public", `robots.txt bloqueia paginas publicas: ${blockedPublic.join(", ")}.`);
    else add(checks, "OK", "seo:robots-public", "Nenhuma pagina publica conhecida bloqueada.");
    if (openPrivate.length) add(checks, "FAIL", "seo:robots-private", `robots.txt nao bloqueia: ${openPrivate.join(", ")}.`);
    else add(checks, "OK", "seo:robots-private", "Superficies privadas bloqueadas.");
  }

  const locs = params.sitemap
    ? Array.from(params.sitemap.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((match) => decodeXmlEntities(match[1] ?? ""))
    : [];
  if (params.sitemap) {
    const invalid = locs.filter((loc) => !(loc === CANONICAL_ORIGIN || loc.startsWith(`${CANONICAL_ORIGIN}/`)) || loc.includes("?") || /\/colecao\/|\/feeds\//.test(loc));
    if (invalid.length) add(checks, "FAIL", "seo:sitemap-urls", `Sitemap com URL nao indexavel/nao canonica: ${invalid.slice(0, 5).join(", ")}.`);
    else add(checks, "OK", "seo:sitemap-urls", `${locs.length} URLs canonicas, sem parametros, colecoes ou feed.`);
  }

  const fetchPage = (path: string, label: string) => captureResponse({ baseUrl, path, method: "GET", label, checks, fetchImpl: params.fetchImpl, timeoutMs: params.timeoutMs, readBody: true });

  const home = await fetchPage("/", "seo:home");
  if (home) {
    params.capturedResponses.push(home);
    const canonical = readCanonical(home.body);
    const robots = readRobotsMeta(home.body);
    if (canonical === CANONICAL_ORIGIN && !robots?.includes("noindex")) add(checks, "OK", "seo:home", "Home indexavel com canonical canonico.");
    else add(checks, "FAIL", "seo:home", `Home: canonical=${canonical ?? "ausente"} robots=${robots ?? "padrao"}.`);
  }

  const productLoc = locs.find((loc) => loc.startsWith(`${CANONICAL_ORIGIN}/produto/`));
  if (productLoc) {
    const product = await fetchPage(new URL(productLoc).pathname, "seo:product");
    if (product) {
      params.capturedResponses.push(product);
      const canonical = readCanonical(product.body);
      const types = readJsonLdTypes(product.body);
      const robots = readRobotsMeta(product.body);
      const hasProduct = types.includes("Product") || types.includes("ProductGroup");
      if (product.status === 200 && canonical === productLoc && hasProduct && !types.includes("INVALID") && !robots?.includes("noindex")) {
        add(checks, "OK", "seo:product", `${new URL(productLoc).pathname}: canonical proprio e JSON-LD ${types.join("+")}.`);
      } else {
        add(checks, "FAIL", "seo:product", `${productLoc}: status=${product.status} canonical=${canonical ?? "ausente"} jsonld=${types.join("+") || "nenhum"} robots=${robots ?? "padrao"}.`);
      }
    }
  } else if (params.sitemap) {
    add(checks, "WARNING", "seo:product", "Sitemap sem produto para validar.");
  }

  const filtered = await fetchPage(FILTERED_LISTING_PATH, "seo:filtered-listing");
  if (filtered) {
    const robots = readRobotsMeta(filtered.body);
    const canonical = readCanonical(filtered.body);
    if (robots?.includes("noindex") && canonical === `${CANONICAL_ORIGIN}/categoria/tudo`) add(checks, "OK", "seo:filtered-listing", "Listagem filtrada/ordenada e noindex com canonical sem parametros.");
    else add(checks, "FAIL", "seo:filtered-listing", `${FILTERED_LISTING_PATH}: robots=${robots ?? "padrao"} canonical=${canonical ?? "ausente"}.`);
  }

  const feed = await fetchPage(MERCHANT_FEED_SMOKE_PATH, "seo:merchant-feed");
  if (feed) {
    params.capturedResponses.push(feed);
    const isFeed = feed.status === 200 && feed.body.includes('xmlns:g="http://base.google.com/ns/1.0"') && /noindex/i.test(feed.headers.get("x-robots-tag") ?? "");
    if (isFeed) add(checks, "OK", "seo:merchant-feed", `Feed Merchant publicado (${(feed.body.match(/<item>/g) ?? []).length} itens), noindex.`);
    else if (feed.status === 404) add(checks, "WARNING", "seo:merchant-feed", "Feed Merchant ainda nao publicado (404).");
    else add(checks, "FAIL", "seo:merchant-feed", `Feed Merchant invalido: status ${feed.status}.`);
  }
}

export async function runPublicSiteSmoke(options: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** RARE-SEO-GOOGLE-01 indexing checks (robots, sitemap, canonical, JSON-LD, filters, Merchant feed). */
  seo?: boolean;
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

  if (options.seo) {
    await runPublicSeoChecks({ baseUrl, checks, fetchImpl, timeoutMs, robots, sitemap, capturedResponses });
  }

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
