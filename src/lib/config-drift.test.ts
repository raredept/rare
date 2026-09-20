import { describe, expect, it } from "vitest";
import {
  assertCheckoutCredentialsMatchEnvironment,
  detectConfigDrift,
  getDeploymentEnvironment,
  getMelhorEnvioMode,
  getStripeKeyMode,
} from "@/lib/config-drift";

const LIVE_KEY = "sk_live_exampleexampleexample";
const TEST_KEY = "sk_test_exampleexampleexample";

function drift(env: Record<string, string | undefined>) {
  return detectConfigDrift(env);
}

function variables(env: Record<string, string | undefined>) {
  return drift(env).map((issue) => `${issue.level}:${issue.variable}`);
}

describe("getDeploymentEnvironment", () => {
  it("treats the homologation app environments as restricted", () => {
    for (const appEnv of ["staging", "preview", "homologation", "STAGING"]) {
      expect(getDeploymentEnvironment({ APP_ENV: appEnv, NODE_ENV: "production" })).toBe("restricted");
    }
  });

  it("falls back to NODE_ENV when APP_ENV is absent", () => {
    expect(getDeploymentEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(getDeploymentEnvironment({ NODE_ENV: "development" })).toBe("development");
    expect(getDeploymentEnvironment({})).toBe("development");
  });

  it("honours an explicit production APP_ENV", () => {
    expect(getDeploymentEnvironment({ APP_ENV: "production", NODE_ENV: "development" })).toBe("production");
  });
});

describe("getStripeKeyMode", () => {
  it("recognises both secret and restricted keys", () => {
    expect(getStripeKeyMode(LIVE_KEY)).toBe("live");
    expect(getStripeKeyMode(TEST_KEY)).toBe("test");
    expect(getStripeKeyMode("rk_live_example")).toBe("live");
    expect(getStripeKeyMode("rk_test_example")).toBe("test");
  });

  it("returns null for absent or unrecognised values", () => {
    expect(getStripeKeyMode(undefined)).toBeNull();
    expect(getStripeKeyMode("   ")).toBeNull();
    expect(getStripeKeyMode("pk_live_example")).toBeNull();
  });
});

describe("getMelhorEnvioMode", () => {
  it("defaults to the production API when unset", () => {
    expect(getMelhorEnvioMode({})).toBe("production");
  });

  it("reads the configured mode and rejects anything else", () => {
    expect(getMelhorEnvioMode({ MELHOR_ENVIO_ENV: "sandbox" })).toBe("sandbox");
    expect(getMelhorEnvioMode({ MELHOR_ENVIO_ENV: "PRODUCTION" })).toBe("production");
    expect(getMelhorEnvioMode({ MELHOR_ENVIO_ENV: "staging" })).toBeNull();
  });
});

describe("Stripe key mode against the environment", () => {
  it("rejects a live key in homologation even with the checkout paused", () => {
    const issues = drift({ APP_ENV: "staging", STRIPE_SECRET_KEY: LIVE_KEY, CHECKOUT_ENABLED: "false" });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "error", variable: "STRIPE_SECRET_KEY" });
    expect(issues[0].message).toContain("cobraria cartões reais");
  });

  it("rejects a live key in development", () => {
    expect(variables({ NODE_ENV: "development", STRIPE_SECRET_KEY: LIVE_KEY })).toEqual(["error:STRIPE_SECRET_KEY"]);
  });

  it("escalates a test key in production once the checkout is live", () => {
    expect(variables({ NODE_ENV: "production", STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "true" })).toEqual([
      "error:STRIPE_SECRET_KEY",
    ]);
  });

  it("only warns about a test key in production while sales are paused", () => {
    expect(variables({ NODE_ENV: "production", STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "false" })).toEqual([
      "warning:STRIPE_SECRET_KEY",
    ]);
  });

  it("accepts the matching pairs", () => {
    expect(drift({ NODE_ENV: "production", STRIPE_SECRET_KEY: LIVE_KEY, CHECKOUT_ENABLED: "true" })).toEqual([]);
    expect(drift({ APP_ENV: "staging", STRIPE_SECRET_KEY: TEST_KEY, CHECKOUT_ENABLED: "true" })).toEqual([]);
  });

  it("stays quiet when no key is configured", () => {
    expect(drift({ NODE_ENV: "production" })).toEqual([]);
  });
});

describe("Melhor Envio mode against the environment", () => {
  const base = { SHIPPING_PROVIDER: "melhor_envio" };

  it("blocks sandbox shipping behind a live production checkout", () => {
    const issues = drift({ ...base, NODE_ENV: "production", MELHOR_ENVIO_ENV: "sandbox", CHECKOUT_ENABLED: "true" });
    expect(issues).toEqual([
      expect.objectContaining({ level: "error", variable: "MELHOR_ENVIO_ENV" }),
    ]);
  });

  it("only warns about sandbox shipping while production sales are paused", () => {
    expect(variables({ ...base, NODE_ENV: "production", MELHOR_ENVIO_ENV: "sandbox" })).toEqual([
      "warning:MELHOR_ENVIO_ENV",
    ]);
  });

  it("warns when homologation silently defaults to the production API", () => {
    const issues = drift({ ...base, APP_ENV: "staging" });
    expect(issues).toEqual([expect.objectContaining({ level: "warning", variable: "MELHOR_ENVIO_ENV" })]);
    expect(issues[0].message).toContain("não definida");
  });

  it("warns when homologation explicitly uses the production API", () => {
    const issues = drift({ ...base, APP_ENV: "staging", MELHOR_ENVIO_ENV: "production" });
    expect(issues).toEqual([expect.objectContaining({ level: "warning", variable: "MELHOR_ENVIO_ENV" })]);
    expect(issues[0].message).toContain("conta real");
  });

  it("ignores the shipping mode for other providers", () => {
    expect(drift({ SHIPPING_PROVIDER: "fixed", APP_ENV: "staging" })).toEqual([]);
  });
});

describe("app URL against the environment", () => {
  it("rejects homologation pointing at the live storefront", () => {
    expect(variables({ APP_ENV: "staging", APP_URL: "https://raredept.com.br" })).toEqual(["error:APP_URL"]);
    expect(variables({ APP_ENV: "staging", NEXT_PUBLIC_APP_URL: "https://www.raredept.com.br/" })).toEqual([
      "error:APP_URL",
    ]);
  });

  it("accepts a homologation host and the production host in production", () => {
    expect(drift({ APP_ENV: "staging", APP_URL: "https://rare-staging.up.railway.app" })).toEqual([]);
    expect(drift({ NODE_ENV: "production", APP_URL: "https://raredept.com.br" })).toEqual([]);
  });
});

describe("assertCheckoutCredentialsMatchEnvironment", () => {
  it("throws a message with no configuration detail for shoppers", () => {
    expect(() => assertCheckoutCredentialsMatchEnvironment({ APP_ENV: "staging", STRIPE_SECRET_KEY: LIVE_KEY })).toThrowError(
      "Checkout bloqueado por configuração de ambiente inconsistente.",
    );
  });

  it("blocks a sandbox shipping mode behind a live production checkout", () => {
    expect(() =>
      assertCheckoutCredentialsMatchEnvironment({
        NODE_ENV: "production",
        SHIPPING_PROVIDER: "melhor_envio",
        MELHOR_ENVIO_ENV: "sandbox",
        CHECKOUT_ENABLED: "true",
        STRIPE_SECRET_KEY: LIVE_KEY,
      }),
    ).toThrowError("Checkout bloqueado");
  });

  it("does not block on a non-payment drift such as the app URL", () => {
    expect(() =>
      assertCheckoutCredentialsMatchEnvironment({
        APP_ENV: "staging",
        APP_URL: "https://raredept.com.br",
        STRIPE_SECRET_KEY: TEST_KEY,
      }),
    ).not.toThrow();
  });

  it("allows a correctly matched environment", () => {
    expect(() =>
      assertCheckoutCredentialsMatchEnvironment({
        NODE_ENV: "production",
        STRIPE_SECRET_KEY: LIVE_KEY,
        CHECKOUT_ENABLED: "true",
      }),
    ).not.toThrow();
  });
});
