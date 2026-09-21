import { describe, expect, it } from "vitest";
import { assertCheckoutCredentialsMatchEnvironment } from "@/lib/config-drift";
import { validateEnvironment } from "@/lib/env";

// The integrated branch carries two guard families: the credential/environment
// drift guard and the e-mail delivery policy. These cases run both through the
// same entry point operators use (validateEnvironment → app:check, /api/health,
// /admin/readiness) and check that neither weakens or silences the other.

// Distinctive fake values assembled at runtime, so the release guard does not see
// secret-shaped literals and so a leak would be unambiguous in the assertions.
const LIVE_KEY = ["sk", "live", "INTEGRATIONCANARYLIVE"].join("_");
const TEST_KEY = ["sk", "test", "INTEGRATIONCANARYTEST"].join("_");
const WEBHOOK_SECRET = ["whsec", "INTEGRATIONCANARYHOOK"].join("_");
const ZEPTO_TOKEN = "ZEPTOCANARY" + "x".repeat(40);
const SMTP_PASSWORD = "SMTPCANARYPASSWORD";
const ME_TOKEN = "MECANARYTOKEN";
const secrets = [LIVE_KEY, TEST_KEY, WEBHOOK_SECRET, ZEPTO_TOKEN, SMTP_PASSWORD, ME_TOKEN];

const base = {
  DATABASE_URL: "postgresql://rare:pw@db.canary.local:5432/rare",
  ADMIN_SESSION_SECRET: "a".repeat(40),
  STORAGE_DRIVER: "r2",
  R2_ACCOUNT_ID: "acct",
  R2_BUCKET: "bucket",
  R2_ACCESS_KEY_ID: "akid",
  R2_SECRET_ACCESS_KEY: "sak",
  R2_PUBLIC_BASE_URL: "https://media.raredept.com.br",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  SHIPPING_PROVIDER: "melhor_envio",
  MELHOR_ENVIO_TOKEN: ME_TOKEN,
  EMAIL_DRIVER: "disabled",
  RATE_LIMIT_DRIVER: "redis",
  REDIS_URL: "redis://redis.internal:6379",
};

const production = { ...base, NODE_ENV: "production", APP_ENV: "production", APP_URL: "https://raredept.com.br" };
const staging = {
  ...base,
  NODE_ENV: "production",
  APP_ENV: "staging",
  APP_URL: "https://rare-staging-staging.up.railway.app",
  STORAGE_DRIVER: "local",
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "true",
};

const smtp = {
  EMAIL_DRIVER: "smtp",
  SMTP_HOST: "smtp.zoho.com",
  SMTP_PORT: "465",
  SMTP_USER: "pedidos@raredept.com.br",
  SMTP_PASSWORD,
  EMAIL_FROM_ORDERS: "pedidos@raredept.com.br",
  EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
};
const zepto = {
  EMAIL_DRIVER: "zeptomail",
  ZEPTOMAIL_SEND_TOKEN: ZEPTO_TOKEN,
  EMAIL_FROM_ORDERS: "pedidos@raredept.com.br",
  EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
};

function run(env: Record<string, string | undefined>) {
  const result = validateEnvironment({ env });
  const text = JSON.stringify(result);
  for (const secret of secrets) expect(text, "secret leaked into validation output").not.toContain(secret);
  return result;
}

function errorVariables(env: Record<string, string | undefined>) {
  return run(env).errors.map((issue) => issue.variable);
}

function checkoutBlocked(env: Record<string, string | undefined>) {
  try {
    assertCheckoutCredentialsMatchEnvironment(env);
    return false;
  } catch (error) {
    // The shopper-facing message carries no configuration detail at all.
    expect((error as Error).message).toBe("Checkout bloqueado por configuração de ambiente inconsistente.");
    return true;
  }
}

describe("the four dangerous combinations", () => {
  it("production + Stripe test key with sales open: error and checkout blocked", () => {
    const env = { ...production, STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "true", MELHOR_ENVIO_ENV: "production" };
    expect(errorVariables(env)).toContain("STRIPE_SECRET_KEY");
    expect(checkoutBlocked(env)).toBe(true);
  });

  it("staging + Stripe live key: error and checkout blocked, even with sales paused", () => {
    const env = { ...staging, STRIPE_SECRET_KEY: LIVE_KEY, CHECKOUT_ENABLED: "false", MELHOR_ENVIO_ENV: "sandbox" };
    expect(errorVariables(env)).toContain("STRIPE_SECRET_KEY");
    expect(checkoutBlocked(env)).toBe(true);
  });

  it("production + Melhor Envio sandbox with sales open: error and checkout blocked", () => {
    const env = { ...production, STRIPE_SECRET_KEY: LIVE_KEY, CHECKOUT_ENABLED: "true", MELHOR_ENVIO_ENV: "sandbox" };
    expect(errorVariables(env)).toContain("MELHOR_ENVIO_ENV");
    expect(checkoutBlocked(env)).toBe(true);
  });

  it("staging + Melhor Envio production: warning per policy, checkout not blocked", () => {
    const env = { ...staging, STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "true", MELHOR_ENVIO_ENV: "production" };
    const result = run(env);
    expect(result.errors.map((i) => i.variable)).not.toContain("MELHOR_ENVIO_ENV");
    expect(result.warnings.map((i) => i.variable)).toContain("MELHOR_ENVIO_ENV");
    expect(checkoutBlocked(env)).toBe(false);
  });

  it("the correct pairs raise neither drift error", () => {
    const prodOk = { ...production, STRIPE_SECRET_KEY: LIVE_KEY, CHECKOUT_ENABLED: "true", MELHOR_ENVIO_ENV: "production" };
    const stgOk = { ...staging, STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "true", MELHOR_ENVIO_ENV: "sandbox" };
    for (const env of [prodOk, stgOk]) {
      expect(errorVariables(env)).not.toEqual(expect.arrayContaining(["STRIPE_SECRET_KEY"]));
      expect(errorVariables(env)).not.toEqual(expect.arrayContaining(["MELHOR_ENVIO_ENV"]));
      expect(checkoutBlocked(env)).toBe(false);
    }
  });
});

describe("all three e-mail drivers survive the integration", () => {
  const stagingOk = { ...staging, STRIPE_SECRET_KEY: TEST_KEY, MELHOR_ENVIO_ENV: "sandbox" };

  it("disabled is valid everywhere", () => {
    expect(errorVariables({ ...stagingOk, EMAIL_DRIVER: "disabled" })).not.toContain("EMAIL_DRIVER");
  });

  it("smtp in homologation needs test mode and an allowlist", () => {
    expect(errorVariables({ ...stagingOk, ...smtp, EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br" })).not.toContain("EMAIL_DRIVER");
    expect(errorVariables({ ...stagingOk, ...smtp, EMAIL_DELIVERY_MODE: "test" })).toContain("EMAIL_DRIVER");
  });

  it("zeptomail in homologation needs test mode and an allowlist", () => {
    expect(errorVariables({ ...stagingOk, ...zepto, EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br" })).not.toContain("EMAIL_DRIVER");
    expect(errorVariables({ ...stagingOk, ...zepto, EMAIL_DELIVERY_MODE: "test" })).toContain("EMAIL_DRIVER");
  });

  it("homologation can never send in production mode, whichever driver", () => {
    for (const driver of [smtp, zepto]) {
      const result = run({ ...stagingOk, ...driver, EMAIL_DELIVERY_MODE: "production", EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br" });
      const issue = result.errors.find((i) => i.variable === "EMAIL_DRIVER");
      expect(issue?.message).toContain("EmailEnvironmentModeMismatch");
    }
  });

  it("production can never run in test mode, whichever driver", () => {
    const prodOk = { ...production, STRIPE_SECRET_KEY: LIVE_KEY, MELHOR_ENVIO_ENV: "production" };
    for (const driver of [smtp, zepto]) {
      const result = run({ ...prodOk, ...driver, EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br" });
      expect(result.errors.find((i) => i.variable === "EMAIL_DRIVER")?.message).toContain("EmailEnvironmentModeMismatch");
    }
  });

  it("names the missing ZeptoMail token without echoing anything", () => {
    const result = run({ ...stagingOk, ...zepto, ZEPTOMAIL_SEND_TOKEN: "", EMAIL_DELIVERY_MODE: "test", EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br" });
    expect(result.errors.find((i) => i.variable === "EMAIL_DRIVER")?.message).toContain("MissingZEPTOMAIL_SEND_TOKEN");
  });

  it("rejects an unknown driver instead of falling back to another transport", () => {
    expect(errorVariables({ ...stagingOk, EMAIL_DRIVER: "sendgrid" })).toContain("EMAIL_DRIVER");
  });
});

describe("an unrecognised APP_ENV is surfaced", () => {
  it("warns and says how the guards will read it", () => {
    const result = run({ ...production, APP_ENV: "rare-prod", STRIPE_SECRET_KEY: LIVE_KEY, MELHOR_ENVIO_ENV: "production" });
    const warning = result.warnings.find((i) => i.variable === "APP_ENV");
    expect(warning?.message).toContain("produção");
  });

  it("never echoes an arbitrary label verbatim", () => {
    const result = run({ ...production, APP_ENV: "x<script>y" + "z".repeat(80), STRIPE_SECRET_KEY: LIVE_KEY, MELHOR_ENVIO_ENV: "production" });
    const warning = result.warnings.find((i) => i.variable === "APP_ENV")?.message ?? "";
    expect(warning).not.toContain("<script>");
    expect(warning).not.toContain("z".repeat(40));
  });
});
