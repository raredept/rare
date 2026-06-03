type Header = {
  key: string;
  value: string;
};

type PublicEnv = Record<string, string | undefined> &
  Partial<Record<"APP_URL" | "NEXT_PUBLIC_APP_URL" | "R2_PUBLIC_BASE_URL" | "STORAGE_PUBLIC_BASE_URL" | "VERCEL_URL", string>>;

const canonicalAppOrigins = ["https://raredept.com.br", "https://www.raredept.com.br"];
const publicR2Sources = ["https://*.r2.dev"];
const stripeCheckoutSource = "https://checkout.stripe.com";
const stripeJsSources = ["https://js.stripe.com", "https://*.js.stripe.com"];
const stripeFrameSources = [...stripeJsSources, "https://hooks.stripe.com"];

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toHttpOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.startsWith("/")) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function toVercelOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return toHttpOrigin(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
}

export function getPublicAppOrigins(env: PublicEnv = process.env) {
  return unique([...canonicalAppOrigins, toHttpOrigin(env.APP_URL), toHttpOrigin(env.NEXT_PUBLIC_APP_URL), toVercelOrigin(env.VERCEL_URL)]);
}

export function getPublicAssetOrigins(env: PublicEnv = process.env) {
  return unique([toHttpOrigin(env.R2_PUBLIC_BASE_URL), toHttpOrigin(env.STORAGE_PUBLIC_BASE_URL), ...publicR2Sources]);
}

export function buildContentSecurityPolicyReportOnly(env: PublicEnv = process.env) {
  const appOrigins = getPublicAppOrigins(env);
  const assetOrigins = getPublicAssetOrigins(env);
  const imageAndMediaSources = unique(["'self'", "data:", "blob:", ...appOrigins, ...assetOrigins, "https://*.stripe.com"]);

  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", unique(["'self'", stripeCheckoutSource, ...stripeJsSources])],
    ["style-src", ["'self'"]],
    ["img-src", imageAndMediaSources],
    ["media-src", imageAndMediaSources],
    ["connect-src", unique(["'self'", stripeCheckoutSource, "https://api.stripe.com", "https://hooks.stripe.com"])],
    ["font-src", ["'self'", "data:"]],
    ["frame-src", unique([stripeCheckoutSource, ...stripeFrameSources])],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ] satisfies Array<[string, string[]]>;

  return directives.map(([directive, sources]) => `${directive} ${sources.join(" ")}`).join("; ");
}

export function getSecurityHeaders(env: PublicEnv = process.env): Header[] {
  // CSP is intentionally Report-Only while Next/React inline runtime styles/scripts
  // and product JSON-LD do not have nonces or hashes. Switch the key to
  // Content-Security-Policy after report data confirms enforcement is clean.
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Strict-Transport-Security", value: "max-age=63072000" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicyReportOnly(env) },
  ];
}
