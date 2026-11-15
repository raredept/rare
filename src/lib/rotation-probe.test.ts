import { spawnSync } from "node:child_process";
import path from "node:path";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { classify, isAllowedProbeUrl, isTestModeStripeKey, stripeSignatureHeader, syntheticProbeEvent } from "../../scripts/rotation-probe.mjs";

const script = path.resolve(__dirname, "../../scripts/rotation-probe.mjs");
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [script, ...args], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });

describe("credential rotation probe", () => {
  it("signs a synthetic event exactly as Stripe verifies it, and only with the right secret", () => {
    const secret = ["whsec", "rotation", "probe", "fixture", "value"].join("_");
    const payload = syntheticProbeEvent();
    const header = stripeSignatureHeader(payload, secret);
    const event = Stripe.webhooks.constructEvent(payload, header, secret);
    expect(event).toMatchObject({ type: "rare.rotation_probe", livemode: false });
    expect(() => Stripe.webhooks.constructEvent(payload, header, `${secret}_old`)).toThrow();
  });

  it("probes only local and staging-labelled hosts, never production", () => {
    expect(isAllowedProbeUrl("https://rare-staging-staging.up.railway.app/api/stripe/webhook")).toBe(true);
    expect(isAllowedProbeUrl("http://localhost:3200/api/stripe/webhook")).toBe(true);
    for (const url of ["https://raredept.com.br/api/stripe/webhook", "https://www.raredept.com.br/api/cron/release-expired-inventory", "http://rare-staging.example.com/x", "https://rare-production.up.railway.app/x", "https://stagingly.example.com/x", "not a url"]) {
      expect(isAllowedProbeUrl(url)).toBe(false);
    }
  });

  it("accepts only TEST-mode Stripe keys", () => {
    expect(isTestModeStripeKey(["sk", "test", "abc123"].join("_"))).toBe(true);
    expect(isTestModeStripeKey(["rk", "test", "abc123"].join("_"))).toBe(true);
    expect(isTestModeStripeKey(["sk", "live", "abc123"].join("_"))).toBe(false);
    expect(isTestModeStripeKey("")).toBe(false);
  });

  it("reads the status codes of each route", () => {
    expect(classify("stripe-key", 200)).toBe("ACCEPTED");
    expect(classify("stripe-key", 401)).toBe("REJECTED");
    expect(classify("stripe-webhook", 400)).toBe("REJECTED");
    expect(classify("stripe-webhook", 500)).toBe("NOT_CONFIGURED");
    expect(classify("cron", 401, { "www-authenticate": 'Basic realm="RARE homologacao"' })).toBe("BLOCKED_BY_STAGING_GATE");
    expect(classify("cron", 401)).toBe("REJECTED");
  });

  it("refuses LIVE keys, production hosts and an unconfirmed cron run before any request", () => {
    expect(run(["stripe-key"], { PROBE_STRIPE_KEY: ["sk", "live", "abc123"].join("_") })).toMatchObject({ status: 2 });
    expect(run(["stripe-webhook", "--url=https://raredept.com.br/api/stripe/webhook"], { PROBE_WEBHOOK_SECRET: "x" })).toMatchObject({ status: 2 });
    const cron = run(["cron", "--url=https://rare-staging-staging.up.railway.app/api/cron/release-expired-inventory"], { PROBE_CRON_SECRET: "x" });
    expect(cron.status).toBe(2);
    expect(cron.stderr).toContain("--allow-run");
  });
});
