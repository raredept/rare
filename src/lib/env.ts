import { getRateLimitStatus } from "@/lib/rate-limit-config";

type EnvIssueLevel = "error" | "warning";

export type EnvIssue = {
  level: EnvIssueLevel;
  variable: string;
  message: string;
};

type EnvValidationOptions = {
  env?: Record<string, string | undefined>;
  requireDatabase?: boolean;
  requireAdminAuth?: boolean;
  requireCheckout?: boolean;
  requireWebhook?: boolean;
  requireStorage?: boolean;
};

type StorageDriver = "local" | "r2";

const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_LOCAL_STORAGE_DIR = "public/uploads";
const DEFAULT_LOCAL_STORAGE_PUBLIC_BASE_URL = "/uploads";
const CHECKOUT_DISABLED_VALUES = new Set(["0", "false", "off", "disabled", "no"]);
const PLACEHOLDER_FRAGMENTS = [
  "replace-with",
  "placeholder",
  "change-me",
  "paste-here",
  "set-this",
  "your-",
  "example.com",
];

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasPlaceholderValue(value: string | undefined) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(value: string) {
  return value.replace(/\/$/, "");
}

function addIssue(issues: EnvIssue[], level: EnvIssueLevel, variable: string, message: string) {
  issues.push({ level, variable, message });
}

function validateRequired(
  issues: EnvIssue[],
  variable: string,
  value: string | undefined,
  message: string,
  level: EnvIssueLevel = "error",
) {
  if (!clean(value) || hasPlaceholderValue(value)) {
    addIssue(issues, level, variable, message);
  }
}

export function getNodeEnv(env: Record<string, string | undefined> = process.env) {
  return clean(env.NODE_ENV) ?? "development";
}

export function isProductionEnv(env: Record<string, string | undefined> = process.env) {
  return getNodeEnv(env) === "production";
}

export function isCheckoutEnabled(env: Record<string, string | undefined> = process.env) {
  const value = clean(env.CHECKOUT_ENABLED);
  return !value || !CHECKOUT_DISABLED_VALUES.has(value.toLowerCase());
}

export function getAppUrl() {
  const configured = clean(process.env.APP_URL) ?? clean(process.env.NEXT_PUBLIC_APP_URL);

  if (!configured) {
    if (isProductionEnv()) {
      throw new Error("APP_URL or NEXT_PUBLIC_APP_URL is required in production.");
    }
    return DEFAULT_APP_URL;
  }

  if (!isHttpUrl(configured)) {
    throw new Error("APP_URL/NEXT_PUBLIC_APP_URL must be an absolute http(s) URL.");
  }

  return normalizeUrl(configured);
}

export function getDatabaseUrl() {
  const databaseUrl = clean(process.env.DATABASE_URL);
  if (!databaseUrl || hasPlaceholderValue(databaseUrl)) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}

export function getAdminSessionSecret() {
  const secret = clean(process.env.ADMIN_SESSION_SECRET) ?? clean(process.env.AUTH_SECRET);
  if (!secret || hasPlaceholderValue(secret) || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET or AUTH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function getOptionalAdminSessionSecret() {
  try {
    return getAdminSessionSecret();
  } catch {
    return null;
  }
}

export function getStripeSecretKey() {
  const secretKey = clean(process.env.STRIPE_SECRET_KEY);
  if (!secretKey || hasPlaceholderValue(secretKey)) {
    throw new Error("STRIPE_SECRET_KEY is required when checkout is enabled.");
  }
  return secretKey;
}

export function getStripeWebhookSecret() {
  const webhookSecret = clean(process.env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret || hasPlaceholderValue(webhookSecret)) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for Stripe webhooks.");
  }
  return webhookSecret;
}

export function getStorageDriver(env: Record<string, string | undefined> = process.env): StorageDriver {
  const rawDriver = (clean(env.STORAGE_DRIVER) ?? clean(env.UPLOAD_DRIVER) ?? "local").toLowerCase();
  if (rawDriver === "local" || rawDriver === "r2") {
    return rawDriver;
  }
  throw new Error("STORAGE_DRIVER deve ser local em desenvolvimento ou r2 em producao.");
}

export function getStorageLocalDir() {
  return clean(process.env.STORAGE_LOCAL_DIR) ?? DEFAULT_LOCAL_STORAGE_DIR;
}

export function getStoragePublicBaseUrl() {
  return normalizeUrl(clean(process.env.STORAGE_PUBLIC_BASE_URL) ?? DEFAULT_LOCAL_STORAGE_PUBLIC_BASE_URL);
}

export function getR2PublicBaseUrl(env: Record<string, string | undefined> = process.env) {
  const publicBaseUrl = clean(env.R2_PUBLIC_BASE_URL) ?? clean(env.STORAGE_PUBLIC_BASE_URL);
  if (!publicBaseUrl || hasPlaceholderValue(publicBaseUrl)) {
    throw new Error("Configure R2_PUBLIC_BASE_URL ou STORAGE_PUBLIC_BASE_URL para publicar uploads do Cloudflare R2.");
  }

  if (!isHttpUrl(publicBaseUrl)) {
    throw new Error("A URL publica do R2 deve ser absoluta e iniciar com http(s).");
  }

  return normalizeUrl(publicBaseUrl);
}

export function getR2StorageConfig(env: Record<string, string | undefined> = process.env) {
  const accountId = clean(env.R2_ACCOUNT_ID);
  const bucket = clean(env.R2_BUCKET);
  const accessKeyId = clean(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.R2_SECRET_ACCESS_KEY);
  const missing = [
    ["R2_ACCOUNT_ID", accountId],
    ["R2_BUCKET", bucket],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, value]) => hasPlaceholderValue(value))
    .map(([name]) => name);

  let publicBaseUrl = "";
  try {
    publicBaseUrl = getR2PublicBaseUrl(env);
  } catch {
    missing.push("R2_PUBLIC_BASE_URL or STORAGE_PUBLIC_BASE_URL");
  }

  if (missing.length) {
    throw new Error(`Upload Cloudflare R2 incompleto. Configure no ambiente: ${missing.join(", ")}.`);
  }

  return {
    accountId: accountId as string,
    bucket: bucket as string,
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    publicBaseUrl,
  };
}

export function isLocalStorageAllowedInProduction(env: Record<string, string | undefined> = process.env) {
  return clean(env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION)?.toLowerCase() === "true";
}

export function assertUploadStorageReady() {
  const driver = getStorageDriver();

  if (driver === "local") {
    if (isProductionEnv() && !isLocalStorageAllowedInProduction()) {
      throw new Error("Upload local nao e permitido em producao. Configure STORAGE_DRIVER=r2 com Cloudflare R2.");
    }
    return;
  }

  getR2StorageConfig();
}

export function validateEnvironment(options: EnvValidationOptions = {}) {
  const env = options.env ?? process.env;
  const issues: EnvIssue[] = [];
  const production = isProductionEnv(env);
  const checkoutEnabled = isCheckoutEnabled(env);
  const storageDriver = (() => {
    try {
      return getStorageDriver(env);
    } catch {
      return null;
    }
  })();

  const requireDatabase = options.requireDatabase ?? true;
  const requireAdminAuth = options.requireAdminAuth ?? true;
  const requireCheckout = options.requireCheckout ?? (production && checkoutEnabled);
  const requireWebhook = options.requireWebhook ?? (production && checkoutEnabled);
  const requireStorage = options.requireStorage ?? production;

  if (!["development", "test", "production"].includes(getNodeEnv(env))) {
    addIssue(issues, "warning", "NODE_ENV", "NODE_ENV should be development, test or production.");
  }

  if (requireDatabase) {
    validateRequired(issues, "DATABASE_URL", env.DATABASE_URL, "DATABASE_URL is required.");
  }

  if (requireAdminAuth) {
    const authSecret = clean(env.ADMIN_SESSION_SECRET) ?? clean(env.AUTH_SECRET);
    validateRequired(
      issues,
      "ADMIN_SESSION_SECRET",
      authSecret,
      "ADMIN_SESSION_SECRET or AUTH_SECRET is required for admin sessions.",
    );
    if (authSecret && !hasPlaceholderValue(authSecret) && authSecret.length < 32) {
      addIssue(issues, "error", "ADMIN_SESSION_SECRET", "Admin session secret must have at least 32 characters.");
    }
  }

  const appUrl = clean(env.APP_URL) ?? clean(env.NEXT_PUBLIC_APP_URL);
  if (production) {
    validateRequired(
      issues,
      "APP_URL",
      appUrl,
      "APP_URL or NEXT_PUBLIC_APP_URL is required in production.",
    );
  } else if (!appUrl) {
    addIssue(issues, "warning", "NEXT_PUBLIC_APP_URL", `No app URL configured; ${DEFAULT_APP_URL} will be used locally.`);
  }
  if (appUrl && !isHttpUrl(appUrl)) {
    addIssue(issues, "error", "APP_URL", "APP_URL/NEXT_PUBLIC_APP_URL must be an absolute http(s) URL.");
  }

  if (checkoutEnabled) {
    const stripeLevel: EnvIssueLevel = requireCheckout ? "error" : "warning";
    validateRequired(
      issues,
      "STRIPE_SECRET_KEY",
      env.STRIPE_SECRET_KEY,
      "STRIPE_SECRET_KEY is required when checkout is active.",
      stripeLevel,
    );
    const webhookLevel: EnvIssueLevel = requireWebhook ? "error" : "warning";
    validateRequired(
      issues,
      "STRIPE_WEBHOOK_SECRET",
      env.STRIPE_WEBHOOK_SECRET,
      "STRIPE_WEBHOOK_SECRET is required to confirm paid orders from Stripe.",
      webhookLevel,
    );
  }

  if (!storageDriver) {
    addIssue(issues, "error", "STORAGE_DRIVER", "Use STORAGE_DRIVER=local em desenvolvimento ou STORAGE_DRIVER=r2 em producao.");
  } else if (requireStorage && storageDriver === "local" && !isLocalStorageAllowedInProduction(env)) {
    addIssue(
      issues,
      "error",
      "STORAGE_DRIVER",
      "STORAGE_DRIVER=local nao persiste uploads em container de producao. Use STORAGE_DRIVER=r2 com Cloudflare R2 em producao.",
    );
  } else if (!production && storageDriver === "local") {
    addIssue(issues, "warning", "STORAGE_DRIVER", "Storage local serve apenas para desenvolvimento.");
  }

  if (storageDriver === "r2") {
    for (const variable of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
      validateRequired(issues, variable, env[variable], `${variable} is required for R2 upload storage.`);
    }

    const publicBaseUrl = clean(env.R2_PUBLIC_BASE_URL) ?? clean(env.STORAGE_PUBLIC_BASE_URL);
    validateRequired(
      issues,
      "R2_PUBLIC_BASE_URL",
      publicBaseUrl,
      "R2_PUBLIC_BASE_URL ou STORAGE_PUBLIC_BASE_URL e obrigatoria para publicar uploads do Cloudflare R2.",
    );
    if (publicBaseUrl && !hasPlaceholderValue(publicBaseUrl) && !isHttpUrl(publicBaseUrl)) {
      addIssue(issues, "error", "R2_PUBLIC_BASE_URL", "A URL publica do R2 deve ser absoluta e iniciar com http(s).");
    }
  }

  const rateLimit = getRateLimitStatus(env);
  for (const warning of rateLimit.warnings) {
    addIssue(issues, "warning", "RATE_LIMIT_DRIVER", warning);
  }

  const shippingProvider = clean(env.SHIPPING_PROVIDER)?.toLowerCase();
  if (shippingProvider === "melhor_envio") {
    const melhorEnvioToken = clean(env.MELHOR_ENVIO_TOKEN) ?? clean(env.MELHOR_ENVIO_ACCESS_TOKEN);
    const melhorEnvioOAuthClient = clean(env.MELHOR_ENVIO_CLIENT_ID) || clean(env.MELHOR_ENVIO_CLIENT_SECRET);
    const level: EnvIssueLevel = production && checkoutEnabled ? "error" : "warning";

    if (!melhorEnvioToken && melhorEnvioOAuthClient) {
      addIssue(
        issues,
        level,
        "MELHOR_ENVIO_TOKEN",
        "Configure MELHOR_ENVIO_TOKEN or finish Melhor Envio OAuth authorization before automatic shipping.",
      );
    } else if (!melhorEnvioToken) {
      addIssue(
        issues,
        level,
        "MELHOR_ENVIO_TOKEN",
        "MELHOR_ENVIO_TOKEN or MELHOR_ENVIO_ACCESS_TOKEN is required for SHIPPING_PROVIDER=melhor_envio.",
      );
    }

    const melhorEnvioEnv = clean(env.MELHOR_ENVIO_ENV);
    if (melhorEnvioEnv && !["production", "sandbox"].includes(melhorEnvioEnv.toLowerCase())) {
      addIssue(issues, "warning", "MELHOR_ENVIO_ENV", "MELHOR_ENVIO_ENV should be production or sandbox.");
    }

    const melhorEnvioBaseUrl = clean(env.MELHOR_ENVIO_BASE_URL);
    if (melhorEnvioBaseUrl && !isHttpUrl(melhorEnvioBaseUrl)) {
      addIssue(issues, "error", "MELHOR_ENVIO_BASE_URL", "MELHOR_ENVIO_BASE_URL must be an absolute http(s) URL.");
    }
  }

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return {
    ok: errors.length === 0,
    nodeEnv: getNodeEnv(env),
    checkoutEnabled,
    storageDriver: storageDriver ?? "invalid",
    errors,
    warnings,
  };
}
