import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const healthMocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    storeSettings: {
      findUnique: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: healthMocks.prisma,
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    DATABASE_URL: "",
    ADMIN_SESSION_SECRET: "admin-session-secret-with-more-than-32-characters",
    APP_URL: "https://staging.rare.example",
    NEXT_PUBLIC_APP_URL: "https://staging.rare.example",
    CHECKOUT_ENABLED: "true",
    STRIPE_SECRET_KEY: "stripe-secret-value-that-must-not-be-returned",
    STRIPE_WEBHOOK_SECRET: "stripe-webhook-value-that-must-not-be-returned",
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "storage-account-id-that-must-not-be-returned",
    R2_BUCKET: "rare-staging",
    R2_ACCESS_KEY_ID: "storage-access-key-that-must-not-be-returned",
    R2_SECRET_ACCESS_KEY: "storage-secret-that-must-not-be-returned",
    R2_PUBLIC_BASE_URL: "https://cdn.example",
    SHIPPING_ENABLED: "true",
    SHIPPING_PROVIDER: "manual",
    SHIPPING_ORIGIN_CEP: "01001000",
    RATE_LIMIT_DRIVER: "redis",
    UPSTASH_REDIS_REST_URL: "https://redis.example",
    UPSTASH_REDIS_REST_TOKEN: "redis-token-that-must-not-be-returned",
  };
  healthMocks.prisma.storeSettings.findUnique.mockResolvedValue({
    shippingMode: "manual",
    originCep: "01001000",
    fixedShippingInCents: 0,
    manualShippingInCents: 0,
    freeShippingMinInCents: null,
    freeShippingThresholdInCents: null,
  });
  healthMocks.prisma.product.count.mockResolvedValue(0);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("health route readiness", () => {
  it("reports readiness without leaking configured secret values", async () => {
    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.app.ok).toBe(true);
    expect(body.database.ok).toBe(false);
    expect(body.environment.shipping.env).toEqual({
      checked: true,
      enabled: true,
      provider: "manual",
      originCepConfigured: true,
      melhorEnvio: {
        environment: "production",
        baseUrlConfigured: false,
        tokenConfigured: false,
        oauthClientConfigured: false,
      },
    });
    expect(body.environment.shipping.storeSettings.checked).toBe(false);
    expect(serialized).not.toContain("stripe-secret-value-that-must-not-be-returned");
    expect(serialized).not.toContain("stripe-webhook-value-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-account-id-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-access-key-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-secret-that-must-not-be-returned");
    expect(serialized).not.toContain("redis-token-that-must-not-be-returned");
  });

  it("returns 200 with warnings when the core app is ready but rate limiting is in memory", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "memory";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok_with_warnings");
    expect(body.database.ok).toBe(true);
    expect(body.configuration.ok).toBe(true);
    expect(body.configuration.errors).toEqual([]);
    expect(body.configuration.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: "RATE_LIMIT_DRIVER" })]),
    );
    expect(body.environment.rateLimit).toEqual(
      expect.objectContaining({
        configuredDriver: "memory",
        activeDriver: "memory",
        shared: false,
      }),
    );
  });

  it("returns 200 without rate-limit warnings when the shared driver is configured", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.environment.rateLimit).toEqual({
      checked: true,
      configuredDriver: "redis",
      activeDriver: "redis",
      shared: true,
      redisRestUrlConfigured: true,
      redisRestTokenConfigured: true,
      warnings: [],
    });
    expect(body.configuration.warnings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: "RATE_LIMIT_DRIVER" })]),
    );
    expect(serialized).not.toContain("redis-token-that-must-not-be-returned");
  });

  it("reports fixed shipping as a legacy warning without requiring originCep", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.SHIPPING_PROVIDER = "";
    process.env.SHIPPING_ORIGIN_CEP = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    healthMocks.prisma.storeSettings.findUnique.mockResolvedValueOnce({
      shippingMode: "fixed",
      originCep: null,
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok_with_warnings");
    expect(body.environment.shipping.storeSettings).toEqual(
      expect.objectContaining({
        checked: true,
        found: true,
        enabled: true,
        mode: "fixed",
        provider: "fixed",
        effectiveProvider: null,
        originCepConfigured: false,
        originCepFallbackActive: false,
        fixedShippingConfigured: true,
        warnings: ["Fixed shipping mode is legacy/provisional and should not be the main production flow."],
      }),
    );
  });

  it("reports the default origin CEP fallback when manual shipping has no originCep", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.SHIPPING_ORIGIN_CEP = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    healthMocks.prisma.storeSettings.findUnique.mockResolvedValueOnce({
      shippingMode: "manual",
      originCep: null,
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok_with_warnings");
    expect(body.environment.shipping.storeSettings).toEqual(
      expect.objectContaining({
        mode: "manual",
        effectiveProvider: "manual",
        originCepConfigured: false,
        originCepFallbackActive: true,
        warnings: ["Origin CEP missing; fallback 31170350 is active."],
      }),
    );
    expect(body.operational.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "shipping.storeSettings",
          message: "Origin CEP missing; fallback 31170350 is active.",
        }),
      ]),
    );
  });

  it("reports Melhor Envio token readiness without exposing the token", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    process.env.MELHOR_ENVIO_TOKEN = "melhor-envio-token-that-must-not-be-returned";
    process.env.SHIPPING_ORIGIN_CEP = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    healthMocks.prisma.product.count.mockResolvedValueOnce(2);
    healthMocks.prisma.storeSettings.findUnique.mockResolvedValueOnce({
      shippingMode: "fixed",
      originCep: null,
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok_with_warnings");
    expect(body.environment.shipping.env.melhorEnvio).toEqual(
      expect.objectContaining({
        environment: "production",
        tokenConfigured: true,
      }),
    );
    expect(body.environment.shipping.storeSettings).toEqual(
      expect.objectContaining({
        mode: "fixed",
        provider: "manual",
        effectiveProvider: "melhor_envio",
        originCepFallbackActive: true,
        warnings: expect.arrayContaining([
          "Origin CEP missing; fallback 31170350 is active.",
          "2 active product(s) will use fallback shipping weight/dimensions until Admin data is completed.",
        ]),
      }),
    );
    expect(serialized).not.toContain("melhor-envio-token-that-must-not-be-returned");
  });

  it("warns when Melhor Envio is selected without a token", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    process.env.MELHOR_ENVIO_TOKEN = "";
    process.env.MELHOR_ENVIO_ACCESS_TOKEN = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.configuration.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: "MELHOR_ENVIO_TOKEN" })]),
    );
    expect(body.environment.shipping.storeSettings.warnings).toEqual(
      expect.arrayContaining(["SHIPPING_PROVIDER=melhor_envio requires MELHOR_ENVIO_TOKEN or MELHOR_ENVIO_ACCESS_TOKEN."]),
    );
  });

  it("returns 503 when checkout is enabled but Stripe secrets are absent", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_WEBHOOK_SECRET = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.database.ok).toBe(true);
    expect(body.configuration.ok).toBe(false);
    expect(body.configuration.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "STRIPE_SECRET_KEY" }),
        expect.objectContaining({ variable: "STRIPE_WEBHOOK_SECRET" }),
      ]),
    );
    expect(serialized).not.toContain("postgresql://rare:password@localhost:5432/rare_test");
  });

  it("returns 503 when the database check fails even if configuration is valid", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    healthMocks.prisma.$queryRaw.mockRejectedValue(new Error("connection failed"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.database.ok).toBe(false);
    expect(body.configuration.ok).toBe(true);
  });
});
