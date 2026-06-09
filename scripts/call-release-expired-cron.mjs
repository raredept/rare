const endpointPath = "/api/cron/release-expired-inventory";
const timeoutMs = 30_000;
const productionOrigins = new Set(["https://raredept.com.br", "https://www.raredept.com.br"]);
const productionEnvironmentNames = new Set(["production", "prod", "live"]);

function clean(value) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function sanitize(value) {
  return String(value)
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted-token]")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted-token]");
}

function withHttps(value) {
  const cleaned = clean(value);
  if (!cleaned) return undefined;
  return cleaned.startsWith("http://") || cleaned.startsWith("https://") ? cleaned : `https://${cleaned}`;
}

function resolveBaseUrl() {
  return withHttps(process.env.RAILWAY_PUBLIC_DOMAIN) ?? withHttps(process.env.APP_URL) ?? withHttps(process.env.NEXT_PUBLIC_APP_URL);
}

function resolveTargetUrl() {
  const explicitTarget = clean(process.env.CRON_TARGET_URL);
  if (explicitTarget) {
    return new URL(explicitTarget).toString();
  }

  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    throw new Error("Configure CRON_TARGET_URL, RAILWAY_PUBLIC_DOMAIN, APP_URL or NEXT_PUBLIC_APP_URL for the Railway cron service.");
  }

  return new URL(endpointPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function isProductionExecution() {
  const appEnvironment = clean(process.env.APP_ENV ?? process.env.RAILWAY_ENVIRONMENT_NAME)?.toLowerCase();
  return Boolean(appEnvironment && productionEnvironmentNames.has(appEnvironment));
}

function assertSafeTarget(targetUrl) {
  const url = new URL(targetUrl);
  const allowProductionTarget = clean(process.env.CRON_ALLOW_PRODUCTION_TARGET)?.toLowerCase() === "true";

  if (productionOrigins.has(url.origin) && !isProductionExecution() && !allowProductionTarget) {
    throw new Error(
      "Refusing to call the production cron target outside a production Railway environment. Set APP_ENV=production on the cron service or use CRON_ALLOW_PRODUCTION_TARGET=true intentionally.",
    );
  }
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

async function main() {
  const cronSecret = clean(process.env.CRON_SECRET);
  if (!cronSecret) {
    throw new Error("Configure CRON_SECRET for the Railway cron service.");
  }

  const targetUrl = resolveTargetUrl();
  assertSafeTarget(targetUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "User-Agent": "RARE Railway Cron",
      },
      signal: controller.signal,
    });
    const body = await readResponse(response);

    if (!response.ok || body.ok !== true) {
      throw new Error(`Cron endpoint returned ${response.status}: ${sanitize(JSON.stringify(body))}`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        targetOrigin: new URL(targetUrl).origin,
        releasedReservations: body.releasedReservations ?? null,
        timestamp: body.timestamp ?? new Date().toISOString(),
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  console.error(sanitize(error instanceof Error ? error.message : "Railway cron failed."));
  process.exit(1);
});
