import { describe, expect, it } from "vitest";
import { assertCheckoutSmokeEnvironment, getStripeSecretKeyMode, validateCheckoutSmokeEnvironment } from "@/lib/stripe-smoke-guard";

const safeEnv = {
  NODE_ENV: "development",
  APP_ENV: "local",
  CHECKOUT_ENABLED: "true",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://rare:rare@localhost:5432/rare_checkout_smoke",
  STRIPE_SECRET_KEY: "sk_test_1234567890",
  STRIPE_WEBHOOK_SECRET: "whsec_test_1234567890",
};

describe("Stripe checkout smoke guard", () => {
  it("detects Stripe test and live secret key modes", () => {
    expect(getStripeSecretKeyMode("sk_test_abc")).toBe("test");
    expect(getStripeSecretKeyMode("rk_test_abc")).toBe("test");
    expect(getStripeSecretKeyMode("sk_live_abc")).toBe("live");
    expect(getStripeSecretKeyMode("replace-with-stripe-test-secret-key")).toBe("unknown");
  });

  it("accepts an isolated local test-mode checkout smoke environment", () => {
    const result = validateCheckoutSmokeEnvironment(safeEnv);

    expect(result.ok).toBe(true);
    expect(result.stripeMode).toBe("test");
    expect(result.databaseTarget).toBe("local");
    expect(result.errors).toEqual([]);
  });

  it("refuses to run with a Stripe live secret key", () => {
    const result = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      STRIPE_SECRET_KEY: "sk_live_1234567890",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "STRIPE_SECRET_KEY",
          message: "Live Stripe keys are never allowed for checkout smoke tests.",
        }),
      ]),
    );
  });

  it("requires a webhook signing secret before smoke execution", () => {
    const result = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      STRIPE_WEBHOOK_SECRET: "",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "STRIPE_WEBHOOK_SECRET")).toBe(true);
  });

  it("blocks the production RARE domain unless explicitly acknowledged", () => {
    const result = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      APP_URL: "https://raredept.com.br",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "APP_URL")).toBe(true);
  });

  it("blocks production-like database URLs even with remote database acknowledgement", () => {
    const result = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      APP_URL: "https://staging.rare.test",
      DATABASE_URL: "postgresql://user:pass@checkout-smoke-db.internal:5432/rare_production",
      CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE: "true",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "DATABASE_URL",
          message: "DATABASE_URL appears to target production/live data and is blocked.",
        }),
      ]),
    );
  });

  it("requires explicit acknowledgement for remote staging databases", () => {
    const blocked = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      APP_ENV: "staging",
      APP_URL: "https://staging.rare.test",
      DATABASE_URL: "postgresql://user:pass@checkout-smoke-db.internal:5432/rare_staging",
    });
    const acknowledged = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      APP_ENV: "staging",
      APP_URL: "https://staging.rare.test",
      DATABASE_URL: "postgresql://user:pass@checkout-smoke-db.internal:5432/rare_staging",
      CHECKOUT_SMOKE_ALLOW_REMOTE_DATABASE: "true",
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.errors.some((issue) => issue.variable === "DATABASE_URL")).toBe(true);
    expect(acknowledged.ok).toBe(true);
    expect(acknowledged.warnings.some((issue) => issue.variable === "DATABASE_URL")).toBe(true);
  });

  it("rejects ambiguous NODE_ENV=production smoke environments", () => {
    const result = validateCheckoutSmokeEnvironment({
      ...safeEnv,
      NODE_ENV: "production",
      APP_ENV: "",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "NODE_ENV")).toBe(true);
  });

  it("throws a safe summary without secret values", () => {
    expect(() =>
      assertCheckoutSmokeEnvironment({
        ...safeEnv,
        STRIPE_SECRET_KEY: "sk_live_secret_that_must_not_be_printed",
      }),
    ).toThrow(/STRIPE_SECRET_KEY: Live Stripe keys/);
    expect(() =>
      assertCheckoutSmokeEnvironment({
        ...safeEnv,
        STRIPE_SECRET_KEY: "sk_live_secret_that_must_not_be_printed",
      }),
    ).not.toThrow(/sk_live_secret_that_must_not_be_printed/);
  });
});
