import { describe, expect, it } from "vitest";
import { buildAdminReadiness, type BuildAdminReadinessInput } from "@/lib/admin-readiness";
import type { CatalogIssueCategory, CatalogIssueProduct } from "@/lib/admin-catalog-issues";

const readyEnv = {
  NODE_ENV: "production",
  APP_ENV: "production",
  APP_URL: "https://rare.example",
  NEXT_PUBLIC_APP_URL: "https://rare.example",
  DATABASE_URL: "postgresql://user:password@db.example/rare",
  ADMIN_SESSION_SECRET: "admin-session-secret-with-more-than-32-characters",
  CHECKOUT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_live_value_that_must_not_leak",
  STRIPE_WEBHOOK_SECRET: "whsec_value_that_must_not_leak",
  RATE_LIMIT_DRIVER: "redis",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token-that-must-not-leak",
  STORAGE_DRIVER: "r2",
  R2_ACCOUNT_ID: "account-id",
  R2_BUCKET: "rare-media",
  R2_ACCESS_KEY_ID: "r2-access-key-that-must-not-leak",
  R2_SECRET_ACCESS_KEY: "r2-secret-that-must-not-leak",
  R2_PUBLIC_BASE_URL: "https://media.rare.example",
  SHIPPING_PROVIDER: "melhor_envio",
  SHIPPING_ORIGIN_CEP: "31170350",
  MELHOR_ENVIO_TOKEN: "melhor-envio-token-that-must-not-leak",
  MELHOR_ENVIO_ENV: "production",
};

function product(overrides: Partial<CatalogIssueProduct> = {}): CatalogIssueProduct {
  return {
    id: "prod-ready",
    title: "Camiseta RARE",
    active: true,
    weightGrams: 500,
    lengthCm: 30,
    widthCm: 24,
    heightCm: 4,
    images: [{ url: "https://media.rare.example/products/camiseta.webp" }],
    variants: [{ active: true, stock: 4, reservedStock: 1 }],
    ...overrides,
  };
}

function category(overrides: Partial<CatalogIssueCategory> = {}): CatalogIssueCategory {
  return {
    id: "cat-ready",
    name: "Camisetas",
    active: true,
    _count: { products: 1, subcategoryProducts: 0 },
    ...overrides,
  };
}

function build(overrides: Partial<BuildAdminReadinessInput> = {}) {
  return buildAdminReadiness({
    env: readyEnv,
    settings: {
      shippingMode: "melhor_envio",
      originCep: "31170350",
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
    },
    products: [product()],
    categories: [category()],
    documentation: {
      vercelEnvChecklistExists: true,
      clientHandoffExists: true,
      checkoutSmokeTestExists: true,
      smokeScriptExists: true,
      checkoutSmokeScriptExists: true,
    },
    ...overrides,
  });
}

describe("admin readiness", () => {
  it("blocks open sales when production uses memory rate limit", () => {
    const report = build({
      env: {
        ...readyEnv,
        RATE_LIMIT_DRIVER: "memory",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
      },
    });
    const item = report.items.find((current) => current.id === "rate-limit-shared");

    expect(item).toEqual(expect.objectContaining({ severity: "blocked", blocksOpenSales: true }));
    expect(report.finalStatus).toBe("blocked_for_open_sales");
  });

  it("marks shared Redis rate limit as ok", () => {
    const report = build();
    const item = report.items.find((current) => current.id === "rate-limit-shared");

    expect(item).toEqual(expect.objectContaining({ severity: "ok", blocksOpenSales: false }));
  });

  it("blocks checkout readiness when webhook secret is missing", () => {
    const report = build({
      env: {
        ...readyEnv,
        STRIPE_WEBHOOK_SECRET: "",
      },
    });
    const item = report.items.find((current) => current.id === "webhook-stripe-secret");

    expect(item).toEqual(expect.objectContaining({ severity: "blocked", blocksOpenSales: true, blocksStaging: true }));
  });

  it("treats disabled checkout as an open-sales blocker without blocking staging", () => {
    const report = build({
      env: {
        ...readyEnv,
        CHECKOUT_ENABLED: "false",
        STRIPE_SECRET_KEY: "",
        STRIPE_WEBHOOK_SECRET: "",
      },
    });
    const item = report.items.find((current) => current.id === "checkout-enabled");

    expect(item).toEqual(expect.objectContaining({ severity: "blocked", blocksOpenSales: true, blocksStaging: false }));
    expect(report.stagingReady).toBe(true);
    expect(report.finalStatus).toBe("blocked_for_open_sales");
  });

  it("blocks catalog readiness when an active product lacks dimensions", () => {
    const report = build({
      products: [product({ id: "prod-no-dimensions", widthCm: null })],
    });
    const item = report.items.find((current) => current.id === "catalog:product-missing-shipping-data:prod-no-dimensions");

    expect(item).toEqual(expect.objectContaining({ severity: "blocked", blocksOpenSales: true }));
  });

  it("keeps an empty active category as warning only", () => {
    const report = build({
      categories: [category({ id: "cat-empty", name: "Bags", _count: { products: 0, subcategoryProducts: 0 } })],
    });
    const item = report.items.find((current) => current.id === "catalog:active-category-empty:cat-empty");

    expect(item).toEqual(expect.objectContaining({ severity: "warning", blocksOpenSales: false }));
  });

  it("marks a warning-only report as ready for limited production", () => {
    const report = build({
      categories: [category({ id: "cat-empty", name: "Bags", _count: { products: 0, subcategoryProducts: 0 } })],
    });

    expect(report.finalStatus).toBe("ready_for_limited_production");
    expect(report.openSalesReady).toBe(true);
  });

  it("warns about legacy media variants without blocking open sales", () => {
    const report = build({
      mediaAuditEntries: [
        {
          source: "product",
          field: "product-image",
          ownerId: "prod-legacy",
          ownerTitle: "Produto legado",
          ownerActive: true,
          url: "https://media.rare.example/products/legacy.png",
          usages: ["card", "detail", "zoom", "og"],
        },
      ],
    });
    const item = report.items.find((current) => current.id === "media-legacy-variants");

    expect(item).toEqual(expect.objectContaining({ severity: "warning", blocksOpenSales: false }));
    expect(report.finalStatus).toBe("ready_for_limited_production");
  });

  it("does not include secret values or sensitive env names in the sanitized report", () => {
    const report = build();
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain(readyEnv.STRIPE_SECRET_KEY);
    expect(serialized).not.toContain(readyEnv.STRIPE_WEBHOOK_SECRET);
    expect(serialized).not.toContain(readyEnv.DATABASE_URL);
    expect(serialized).not.toContain(readyEnv.UPSTASH_REDIS_REST_TOKEN);
    expect(serialized).not.toContain(readyEnv.R2_SECRET_ACCESS_KEY);
    expect(serialized).not.toContain(readyEnv.MELHOR_ENVIO_TOKEN);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("STRIPE_SECRET_KEY");
    expect(serialized).not.toContain("STRIPE_WEBHOOK_SECRET");
    expect(serialized).not.toContain("UPSTASH_REDIS_REST_TOKEN");
    expect(serialized).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(serialized).not.toContain("MELHOR_ENVIO_TOKEN");
  });
});
