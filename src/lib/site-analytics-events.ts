// Site analytics contract (pure: no DOM, no Node APIs), shared by the browser client and the
// ingestion route. The browser can only send the behavioural events listed here; everything about
// checkout, payment and purchase is read from the orders on the server and can never be posted.

/** Behavioural events, accepted only with analytics consent. */
export const CLIENT_ANALYTICS_EVENTS = ["page_view", "product_view", "product_click", "add_to_cart"] as const;
export type ClientAnalyticsEventType = (typeof CLIENT_ANALYTICS_EVENTS)[number];

/** Events that need a product. */
const PRODUCT_EVENTS: readonly ClientAnalyticsEventType[] = ["product_view", "product_click", "add_to_cart"];

export const ANALYTICS_ENDPOINT = "/api/analytics/events";
export const ANALYTICS_BATCH_LIMIT = 20;
export const ANALYTICS_BODY_LIMIT_BYTES = 8_000;
export const ANALYTICS_PATH_MAX_LENGTH = 160;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

export function isAnalyticsClientId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isProductIdShape(value: unknown): value is string {
  return typeof value === "string" && PRODUCT_ID_PATTERN.test(value);
}

export function isClientAnalyticsEventType(value: unknown): value is ClientAnalyticsEventType {
  return typeof value === "string" && (CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(value);
}

/** Areas whose URLs carry order or account references: only the area is recorded, never the rest. */
const COLLAPSED_AREAS = ["/minha-conta", "/pedido", "/pedidos", "/finalizar-compra", "/entrar", "/cadastro"] as const;
/** Never recorded. */
const EXCLUDED_AREAS = ["/admin", "/api", "/_next", "/uploads"] as const;

function inArea(pathname: string, area: string) {
  return pathname === area || pathname.startsWith(`${area}/`);
}

/**
 * Pathname only (query string and fragment are dropped: they can carry e-mails, tokens or order
 * references), restricted to URL-safe characters and a fixed length. Null means "do not record".
 */
export function normalizeAnalyticsPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  let pathname: string;
  try {
    pathname = new URL(value, "https://raredept.com.br").pathname;
  } catch {
    return null;
  }
  pathname = pathname.replace(/[^/A-Za-z0-9._~-]/g, "-").replace(/\/{2,}/g, "/");
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  if (EXCLUDED_AREAS.some((area) => inArea(pathname, area))) return null;
  const collapsed = COLLAPSED_AREAS.find((area) => inArea(pathname, area));
  return (collapsed ?? pathname).slice(0, ANALYTICS_PATH_MAX_LENGTH) || "/";
}

export type ClientAnalyticsEvent = {
  type: ClientAnalyticsEventType;
  path: string;
  productId: string | null;
};

export type ClientAnalyticsBatch = {
  visitorId: string;
  sessionId: string;
  events: ClientAnalyticsEvent[];
};

/**
 * Strict parse of what the browser posts. Unknown keys are ignored (never stored), unknown event
 * types and malformed entries are dropped, and a malformed envelope rejects the whole batch.
 */
export function parseAnalyticsBatch(body: unknown): ClientAnalyticsBatch | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const envelope = body as Record<string, unknown>;
  if (!isAnalyticsClientId(envelope.v) || !isAnalyticsClientId(envelope.s)) return null;
  if (!Array.isArray(envelope.events) || envelope.events.length < 1 || envelope.events.length > ANALYTICS_BATCH_LIMIT) return null;

  const events: ClientAnalyticsEvent[] = [];
  for (const entry of envelope.events) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    if (!isClientAnalyticsEventType(raw.type)) continue;
    const path = normalizeAnalyticsPath(raw.path);
    if (!path) continue;
    const needsProduct = PRODUCT_EVENTS.includes(raw.type);
    if (needsProduct && !isProductIdShape(raw.productId)) continue;
    events.push({ type: raw.type, path, productId: needsProduct ? (raw.productId as string) : null });
  }

  return { visitorId: envelope.v.toLowerCase(), sessionId: envelope.s.toLowerCase(), events };
}
