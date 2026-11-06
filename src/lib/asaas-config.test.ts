import { describe, expect, it } from "vitest";
import { ASAAS_API_BASES, getAsaasConfig, getAsaasConfigurationIssue, getAsaasPaymentMethods } from "@/lib/asaas-config";
import { getAvailableCheckoutMethods, getPaymentProvider } from "@/lib/payment-provider-config";
import { detectConfigDrift } from "@/lib/config-drift";

const sandboxKey = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjAwMDAwMDAwMDAwMDAwMDAwMDA6OiRhYWNoXzAwMDAw";
const productionKey = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjAwMDAwMDAwMDAwMDAwMDAwMDA6OiRhYWNoXzAwMDAw";
const token = "whk_" + "x".repeat(40);
const staging = { APP_ENV: "staging", ASAAS_ENV: "sandbox", ASAAS_API_KEY: sandboxKey, ASAAS_WEBHOOK_TOKEN: token };
const production = { APP_ENV: "production", ASAAS_ENV: "production", ASAAS_API_KEY: productionKey, ASAAS_WEBHOOK_TOKEN: token };

describe("Asaas environment guard", () => {
  it("accepts Sandbox outside production and Production in production, with fixed hosts", () => {
    expect(getAsaasConfigurationIssue(staging)).toBeNull();
    expect(getAsaasConfig(staging)).toMatchObject({ environment: "sandbox", apiBase: "https://api-sandbox.asaas.com/v3" });
    expect(getAsaasConfigurationIssue(production)).toBeNull();
    expect(getAsaasConfig(production).apiBase).toBe(ASAAS_API_BASES.production);
  });

  it("refuses a sandbox key in production and a production key in staging", () => {
    expect(getAsaasConfigurationIssue({ ...production, ASAAS_ENV: "sandbox", ASAAS_API_KEY: sandboxKey })).toBe("AsaasSandboxInProduction");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_ENV: "production", ASAAS_API_KEY: productionKey })).toBe("AsaasProductionOutsideProduction");
    expect(getAsaasConfigurationIssue({ ...production, ASAAS_API_KEY: sandboxKey })).toBe("AsaasKeyDoesNotMatchASAAS_ENV");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_API_KEY: productionKey })).toBe("AsaasKeyDoesNotMatchASAAS_ENV");
  });

  it("never lets a variable send the key to another host", () => {
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_API_BASE: "https://evil.example/v3" })).toBe("AsaasApiBaseDoesNotMatchASAAS_ENV");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_API_BASE: "https://api.asaas.com/v3" })).toBe("AsaasApiBaseDoesNotMatchASAAS_ENV");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_API_BASE: "https://api-sandbox.asaas.com/v3/" })).toBeNull();
  });

  it("requires a strong webhook token distinct from the API key", () => {
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_WEBHOOK_TOKEN: "" })).toBe("MissingASAAS_WEBHOOK_TOKEN");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_WEBHOOK_TOKEN: "short" })).toBe("InvalidASAAS_WEBHOOK_TOKEN");
    expect(getAsaasConfigurationIssue({ ...staging, ASAAS_WEBHOOK_TOKEN: sandboxKey })).toBe("AsaasWebhookTokenReusesApiKey");
  });

  it("reports codes, never values", () => {
    for (const env of [{}, { ASAAS_ENV: "sandbox" }, { ...staging, ASAAS_API_KEY: "nope" }]) {
      const issue = getAsaasConfigurationIssue(env) ?? "";
      expect(issue).not.toContain("aact");
      expect(issue).toMatch(/^[A-Za-z_]+$/);
    }
    expect(() => getAsaasConfig({})).toThrow("InvalidASAAS_ENV");
  });

  it("logs drift at boot for keys in the wrong environment", () => {
    expect(detectConfigDrift({ APP_ENV: "staging", ASAAS_API_KEY: productionKey }).map((issue) => issue.variable)).toContain("ASAAS_API_KEY");
    expect(detectConfigDrift({ APP_ENV: "production", PAYMENT_PROVIDER: "asaas", ASAAS_API_KEY: sandboxKey }).map((issue) => issue.variable)).toContain("ASAAS_API_KEY");
  });
});

describe("payment provider selection", () => {
  it("keeps Stripe as the default so deploying changes nothing", () => {
    expect(getPaymentProvider({})).toBe("stripe");
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "asaas" })).toBe("asaas");
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "disabled" })).toBe("disabled");
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "paypal" })).toBe("disabled");
  });

  it("offers only configured Asaas methods and none when misconfigured", () => {
    expect(getAvailableCheckoutMethods({ ...staging, PAYMENT_PROVIDER: "asaas" })).toEqual(["card", "pix"]);
    expect(getAvailableCheckoutMethods({ ...staging, PAYMENT_PROVIDER: "asaas", ASAAS_PAYMENT_METHODS: "pix,boleto" })).toEqual(["pix"]);
    expect(getAvailableCheckoutMethods({ ...production, PAYMENT_PROVIDER: "asaas", ASAAS_API_KEY: sandboxKey, ASAAS_ENV: "sandbox" })).toEqual([]);
    expect(getAvailableCheckoutMethods({ PAYMENT_PROVIDER: "disabled" })).toEqual([]);
    expect(getAsaasPaymentMethods({ ASAAS_PAYMENT_METHODS: "BOLETO" })).toEqual([]);
  });
});
