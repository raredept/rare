import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicyReportOnly, getPublicAppOrigins, getPublicAssetOrigins, getSecurityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("derives public app and media origins without keeping URL paths or query values", () => {
    const env = {
      APP_URL: "https://raredept.com.br/store",
      NEXT_PUBLIC_APP_URL: "https://www.raredept.com.br",
      R2_PUBLIC_BASE_URL: "https://media.rare.example/products?token=must-not-leak",
      STORAGE_PUBLIC_BASE_URL: "/uploads",
      RAILWAY_PUBLIC_DOMAIN: "rare-staging.up.railway.app",
    };

    expect(getPublicAppOrigins(env)).toEqual([
      "https://raredept.com.br",
      "https://www.raredept.com.br",
      "https://rare-staging.up.railway.app",
    ]);
    expect(getPublicAssetOrigins(env)).toEqual(["https://media.rare.example", "https://*.r2.dev"]);

    const csp = buildContentSecurityPolicyReportOnly(env);
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("media-src 'self' data: blob:");
    expect(csp).toContain("https://media.rare.example");
    expect(csp).toContain("https://*.r2.dev");
    expect(csp).not.toContain("must-not-leak");
    expect(csp).not.toContain("/products");
  });

  it("allows Stripe Checkout and Stripe.js without allowing inline script execution", () => {
    const csp = buildContentSecurityPolicyReportOnly({});

    expect(csp).toContain("script-src 'self' https://checkout.stripe.com https://js.stripe.com https://*.js.stripe.com");
    expect(csp).toContain("connect-src 'self' https://checkout.stripe.com https://api.stripe.com https://hooks.stripe.com");
    expect(csp).toContain("frame-src https://checkout.stripe.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("does not expose configured server-side secrets in public headers", () => {
    const headers = getSecurityHeaders();
    const serialized = JSON.stringify(headers);

    expect(serialized).not.toContain("STRIPE_SECRET_KEY");
    expect(serialized).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("ADMIN_SESSION_SECRET");
    expect(serialized).not.toContain("sk_test_secret_value_that_must_not_leak");
    expect(serialized).not.toContain("r2_secret_value_that_must_not_leak");
    expect(serialized).not.toContain("postgres://user:password@db.example/rare");
    expect(serialized).not.toContain("admin_session_secret_that_must_not_leak");
    expect(headers.some((header) => header.key.startsWith("Content-Security-Policy"))).toBe(false);
  });
});
