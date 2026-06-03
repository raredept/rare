export type CheckoutSmokeIssue = {
  level: "error" | "warning";
  variable: string;
  message: string;
};

export type StripeSecretKeyMode = "test" | "live" | "unknown";

type SmokeEnv = Record<string, string | undefined>;

const checkoutDisabledValues = new Set(["0", "false", "off", "disabled", "no"]);
const safeEnvironmentNames = new Set(["development", "dev", "local", "test", "staging", "stage", "preview", "homologacao", "homologation"]);
const productionEnvironmentNames = new Set(["production", "prod", "live"]);
const productionOrigins = new Set(["https://raredept.com.br", "https://www.raredept.com.br"]);
const placeholderFragments = ["replace-with", "placeholder", "change-me", "paste-here", "set-this", "your-", "example.com"];
const productionDatabaseMarkers = /(^|[-_.:/])(prod|production|live)([-_.:/]|$)/i;

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasPlaceholderValue(value: string | undefined) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return true;
  return placeholderFragments.some((fragment) => normalized.includes(fragment));
}

function isEnabled(value: string | undefined) {
  const normalized = clean(value)?.toLowerCase();
  return !normalized || !checkoutDisabledValues.has(normalized);
}

function parseHttpUrl(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function parseDatabaseUrl(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;

  try {
    return new URL(cleaned);
  } catch {
    return null;
  }
}

function isLocalDatabaseHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local");
}

function addIssue(issues: CheckoutSmokeIssue[], level: CheckoutSmokeIssue["level"], variable: string, message: string) {
  issues.push({ level, variable, message });
}

export function getStripeSecretKeyMode(secretKey: string | undefined): StripeSecretKeyMode {
  const cleaned = clean(secretKey);
  if (!cleaned || hasPlaceholderValue(cleaned)) return "unknown";
  if (/^(sk|rk)_test_/.test(cleaned)) return "test";
  if (/^(sk|rk)_live_/.test(cleaned)) return "live";
  return "unknown";
}

export function validateCheckoutSmokeEnvironment(env: SmokeEnv = process.env) {
  const issues: CheckoutSmokeIssue[] = [];
  const appUrl = parseHttpUrl(env.APP_URL ?? env.NEXT_PUBLIC_APP_URL);
  const webhookUrl = parseHttpUrl(env.CHECKOUT_SMOKE_WEBHOOK_URL ?? env.STRIPE_WEBHOOK_URL);
  const databaseUrl = parseDatabaseUrl(env.DATABASE_URL);
  const stripeMode = getStripeSecretKeyMode(env.STRIPE_SECRET_KEY);
  const appEnvironment = clean(env.APP_ENV ?? env.VERCEL_ENV)?.toLowerCase();
  const nodeEnv = clean(env.NODE_ENV)?.toLowerCase() ?? "development";
  const allowProductionUrl = clean(env.CHECKOUT_SMOKE_ALLOW_PRODUCTION_URL)?.toLowerCase() === "true";
  const allowRemoteDatabase = clean(env.CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE)?.toLowerCase() === "true";

  if (!isEnabled(env.CHECKOUT_ENABLED)) {
    addIssue(issues, "error", "CHECKOUT_ENABLED", "Checkout smoke requires CHECKOUT_ENABLED=true.");
  }

  if (stripeMode === "live") {
    addIssue(issues, "error", "STRIPE_SECRET_KEY", "Live Stripe keys are never allowed for checkout smoke tests.");
  } else if (stripeMode !== "test") {
    addIssue(issues, "error", "STRIPE_SECRET_KEY", "Use a Stripe test secret key starting with sk_test_ or rk_test_.");
  }

  if (!clean(env.STRIPE_WEBHOOK_SECRET) || hasPlaceholderValue(env.STRIPE_WEBHOOK_SECRET)) {
    addIssue(issues, "error", "STRIPE_WEBHOOK_SECRET", "Stripe webhook smoke requires a test webhook signing secret.");
  } else if (!clean(env.STRIPE_WEBHOOK_SECRET)?.startsWith("whsec_")) {
    addIssue(issues, "warning", "STRIPE_WEBHOOK_SECRET", "Stripe webhook secrets normally start with whsec_. Confirm this is a test signing secret.");
  }

  if (!appUrl) {
    addIssue(issues, "error", "APP_URL", "APP_URL or NEXT_PUBLIC_APP_URL must be an absolute http(s) URL for smoke tests.");
  } else if (productionOrigins.has(appUrl.origin) && !allowProductionUrl) {
    addIssue(
      issues,
      "error",
      "APP_URL",
      "The production RARE domain is blocked unless CHECKOUT_SMOKE_ALLOW_PRODUCTION_URL=true is set explicitly.",
    );
  } else if (productionOrigins.has(appUrl.origin) && allowProductionUrl) {
    addIssue(issues, "warning", "APP_URL", "Production domain was explicitly acknowledged; verify this is not using production data.");
  }

  if (webhookUrl) {
    if (productionOrigins.has(webhookUrl.origin) && !allowProductionUrl) {
      addIssue(issues, "error", "CHECKOUT_SMOKE_WEBHOOK_URL", "Production webhook URL is blocked without explicit confirmation.");
    }
    if (!webhookUrl.pathname.endsWith("/api/stripe/webhook")) {
      addIssue(issues, "warning", "CHECKOUT_SMOKE_WEBHOOK_URL", "Webhook URL should point to /api/stripe/webhook.");
    }
  }

  if (appEnvironment && productionEnvironmentNames.has(appEnvironment)) {
    addIssue(issues, "error", "APP_ENV", "Checkout smoke must run in local, staging, preview or test environment, not production/live.");
  }

  if (nodeEnv === "production" && (!appEnvironment || !safeEnvironmentNames.has(appEnvironment))) {
    addIssue(
      issues,
      "error",
      "NODE_ENV",
      "NODE_ENV=production requires APP_ENV or VERCEL_ENV to be staging, preview, test or homologacao for checkout smoke.",
    );
  }

  if (!databaseUrl || hasPlaceholderValue(env.DATABASE_URL)) {
    addIssue(issues, "error", "DATABASE_URL", "Checkout smoke requires an isolated local or staging DATABASE_URL.");
  } else {
    const databaseSurface = `${databaseUrl.hostname}${databaseUrl.pathname}`.toLowerCase();
    if (productionDatabaseMarkers.test(databaseSurface)) {
      addIssue(issues, "error", "DATABASE_URL", "DATABASE_URL appears to target production/live data and is blocked.");
    } else if (!isLocalDatabaseHost(databaseUrl.hostname) && !allowRemoteDatabase) {
      addIssue(
        issues,
        "error",
        "DATABASE_URL",
        "Remote databases require CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE=true after confirming this is staging/test data.",
      );
    } else if (!isLocalDatabaseHost(databaseUrl.hostname) && allowRemoteDatabase) {
      addIssue(issues, "warning", "DATABASE_URL", "Remote database explicitly acknowledged; confirm it contains only staging/test data.");
    }
  }

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return {
    ok: errors.length === 0,
    stripeMode,
    nodeEnv,
    appEnvironment: appEnvironment ?? "not-set",
    appUrlOrigin: appUrl?.origin ?? "invalid",
    webhookUrlOrigin: webhookUrl?.origin ?? "not-set",
    databaseTarget: databaseUrl ? (isLocalDatabaseHost(databaseUrl.hostname) ? "local" : "remote") : "invalid",
    errors,
    warnings,
  };
}

export function assertCheckoutSmokeEnvironment(env: SmokeEnv = process.env) {
  const result = validateCheckoutSmokeEnvironment(env);
  if (!result.ok) {
    const summary = result.errors.map((issue) => `${issue.variable}: ${issue.message}`).join("; ");
    throw new Error(`Checkout smoke guard failed: ${summary}`);
  }
  return result;
}
