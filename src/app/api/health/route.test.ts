import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const healthMocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
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

vi.mock("@/lib/auth", () => ({
  getCurrentAdmin: healthMocks.getCurrentAdmin,
}));

vi.mock("@/lib/release-artifact", () => ({
  getReleaseArtifact: () => ({
    commitSha: "abcdef1234567890abcdef1234567890abcdef12",
    nextBuildId: "synthetic-build-id",
    sourceSha256: "a".repeat(64),
  }),
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("Health unit tests must not contact external services.");
  }));
  // Keep readiness checks hermetic: never inherit workspace credentials.
  process.env = {
    NODE_ENV: "production",
    DATABASE_URL: "",
    ADMIN_SESSION_SECRET: "admin-session-secret-with-more-than-32-characters",
    APP_URL: "https://staging.rare.example",
    NEXT_PUBLIC_APP_URL: "https://staging.rare.example",
    CHECKOUT_ENABLED: "true",
    EMAIL_DRIVER: "disabled",
    STRIPE_SECRET_KEY: "stripe-secret-value-that-must-not-be-returned",
    STRIPE_WEBHOOK_SECRET: "stripe-webhook-value-that-must-not-be-returned",
    STRIPE_PAYMENT_METHOD_TYPES: "card",
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "web-push-public-key",
    WEB_PUSH_VAPID_PRIVATE_KEY: "web-push-private-key",
    WEB_PUSH_CONTACT: "mailto:contato@raredept.com.br",
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
    RAILWAY_GIT_COMMIT_SHA: "abcdef1234567890abcdef1234567890abcdef12",
    RAILWAY_DEPLOYMENT_ID: "deployment-123",
    RAILWAY_REPLICA_ID: "replica-456",
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
  healthMocks.getCurrentAdmin.mockResolvedValue({ id: "admin_1" });
});

afterEach(() => {
  process.env = originalEnv;
  try {
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("health route readiness", () => {
  it("reports readiness without leaking configured secret values", async () => {
    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.app.ok).toBe(true);
    expect(body.app.release).toEqual({
      sha: "abcdef1234567890abcdef1234567890abcdef12",
      buildId: "deployment-123",
    });
    expect(body.app.artifact).toEqual({
      commitSha: "abcdef1234567890abcdef1234567890abcdef12",
      nextBuildId: "synthetic-build-id",
      sourceSha256: "a".repeat(64),
    });
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
    expect(healthMocks.prisma.$queryRaw).not.toHaveBeenCalled();
    expect(healthMocks.prisma.storeSettings.findUnique).not.toHaveBeenCalled();
    expect(healthMocks.prisma.product.count).not.toHaveBeenCalled();
    expect(serialized).not.toContain("admin-session-secret-with-more-than-32-characters");
    expect(serialized).not.toContain("web-push-private-key");
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

    const response = await GET(new Request("http://localhost/api/health"));
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

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.environment.rateLimit).toEqual({
      checked: true,
      configuredDriver: "redis",
      activeDriver: "redis",
      activeTransport: "rest",
      shared: true,
      redisRestUrlConfigured: true,
      redisRestTokenConfigured: true,
      redisTcpUrlConfigured: false,
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

    const response = await GET(new Request("http://localhost/api/health"));
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

    const response = await GET(new Request("http://localhost/api/health"));
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
      shippingMode: "melhor_envio",
      originCep: null,
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    const response = await GET(new Request("http://localhost/api/health"));
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
        mode: "melhor_envio",
        provider: "melhor_envio",
        effectiveProvider: "melhor_envio",
        originCepFallbackActive: true,
        warnings: expect.arrayContaining([
          "Origin CEP missing; fallback 31170350 is active.",
          "2 active product(s) are not ready for automatic shipping; manual modes use fallback until Admin data is completed.",
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
    healthMocks.prisma.storeSettings.findUnique.mockResolvedValueOnce({
      shippingMode: "melhor_envio",
      originCep: "01001000",
      fixedShippingInCents: 0,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("error");
    expect(body.configuration.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ variable: "MELHOR_ENVIO_TOKEN" })]),
    );
    expect(body.environment.shipping.storeSettings.warnings).toEqual(
      expect.arrayContaining(["SHIPPING_PROVIDER=melhor_envio requires MELHOR_ENVIO_TOKEN or MELHOR_ENVIO_ACCESS_TOKEN."]),
    );
  });

  it("returns 200 when checkout is enabled but Stripe secrets are absent", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_WEBHOOK_SECRET = "";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
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

  it("classifies intentionally disabled integrations without returning HTTP failure", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/rare_test";
    process.env.CHECKOUT_ENABLED = "false";
    process.env.STRIPE_SECRET_KEY = "";
    process.env.STRIPE_WEBHOOK_SECRET = "";
    process.env.EMAIL_DRIVER = "disabled";
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);
    healthMocks.prisma.product.count.mockResolvedValueOnce(3);

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).not.toBe("error");
    expect(body.operational.summary).toEqual(expect.objectContaining({
      checkout: "intentionally_disabled",
      email: "intentionally_disabled",
      melhorEnvio: "awaiting_explicit_activation",
      catalogShippingData: { state: "incomplete", activeProductsNotReady: 3 },
    }));
  });

  it("shows an Admin the e-mail driver readiness without any credential or address", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/rare_test";
    process.env.APP_ENV = "staging";
    process.env.EMAIL_DRIVER = "zeptomail";
    process.env.EMAIL_DELIVERY_MODE = "test";
    process.env.EMAIL_TEST_RECIPIENTS = "qa@homologacao.example.org";
    process.env.EMAIL_FROM_ORDERS = "orders@raredept.com.br";
    process.env.EMAIL_SEND_NOT_BEFORE = "2026-01-01T00:00:00Z";
    process.env.ZEPTOMAIL_SEND_TOKEN = "synthetic-send-mail-token-not-a-credential";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const body = await (await GET(new Request("http://localhost/api/health"))).json();
    const serialized = JSON.stringify(body);

    expect(body.environment.email).toEqual({ driver: "zeptomail", configured: true, deliveryMode: "test" });
    expect(body.operational.summary.email).toBe("zeptomail_configured_delivery_unverified");
    expect(serialized).not.toContain("synthetic-send-mail-token-not-a-credential");
    expect(serialized).not.toContain("homologacao.example.org");
    delete process.env.ZEPTOMAIL_SEND_TOKEN;
  });

  it("reports an incomplete zeptomail configuration as not configured", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/rare_test";
    process.env.APP_ENV = "staging";
    process.env.EMAIL_DRIVER = "zeptomail";
    process.env.EMAIL_DELIVERY_MODE = "test";
    delete process.env.ZEPTOMAIL_SEND_TOKEN;
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const body = await (await GET(new Request("http://localhost/api/health"))).json();

    expect(body.environment.email).toEqual({ driver: "zeptomail", configured: false, deliveryMode: "test" });
    expect(body.operational.summary.email).toBe("missing_required_configuration");
  });

  it("never tells an anonymous caller which e-mail provider is in use", async () => {
    healthMocks.getCurrentAdmin.mockResolvedValue(null);
    process.env.DATABASE_URL = "postgresql://localhost:5432/rare_test";
    process.env.EMAIL_DRIVER = "zeptomail";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const serialized = JSON.stringify(await (await GET(new Request("http://localhost/api/health"))).json());

    expect(serialized).not.toMatch(/zeptomail|smtp|email/i);
  });

  it("returns a sanitized error verdict with HTTP 200 when the database check fails", async () => {
    process.env.DATABASE_URL = "postgresql://rare:password@localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "redis";
    healthMocks.prisma.$queryRaw.mockRejectedValue(new Error("synthetic-private-database-error"));

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("error");
    expect(body.database).toEqual({ ok: false, message: "Database connection failed." });
    expect(body.configuration.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("synthetic-private-database-error");
    expect(healthMocks.prisma.storeSettings.findUnique).not.toHaveBeenCalled();
    expect(healthMocks.prisma.product.count).not.toHaveBeenCalled();
  });

  it("exposes only the verdict to anonymous callers", async () => {
    healthMocks.getCurrentAdmin.mockResolvedValue(null);
    process.env.DATABASE_URL = "postgresql://db.internal:5432/rare";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const request = new Request("http://localhost/api/health", {
      headers: { "x-real-ip": "172.71.10.20", "cf-connecting-ip": "203.0.113.7" },
    });
    const response = await GET(request);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["app", "configuration", "database", "status", "timestamp"]);
    expect(body.database).toEqual({ ok: true });
    expect(body.app).toEqual({ ok: true });
    expect(body.configuration).toEqual({ ok: true, errors: [] });
    expect(serialized).not.toContain("abcdef1234567890abcdef1234567890abcdef12");
    expect(serialized).not.toContain("deployment-123");
    expect(serialized).not.toContain("synthetic-build-id");
    expect(serialized).not.toContain("203.0.113.7");
    expect(serialized).not.toContain("db.internal");
    expect(serialized).not.toContain("redis");
    expect(serialized).not.toContain("STRIPE");
    expect(serialized).not.toContain("R2_");
    expect(serialized).not.toContain("melhorEnvio");
  });

  it("never names the failing configuration variables to anonymous callers", async () => {
    healthMocks.getCurrentAdmin.mockResolvedValue(null);
    delete process.env.ADMIN_SESSION_SECRET;

    const body = await (await GET(new Request("http://localhost/api/health"))).json();

    expect(body.configuration.ok).toBe(false);
    expect(body.configuration.errors.length).toBeGreaterThan(0);
    for (const issue of body.configuration.errors) {
      expect(issue).toEqual({ message: "Configuration issue. Sign in to the Admin for details." });
    }
    expect(JSON.stringify(body)).not.toContain("ADMIN_SESSION_SECRET");
  });

  it("treats an authentication failure as anonymous", async () => {
    healthMocks.getCurrentAdmin.mockRejectedValue(new Error("synthetic-private-auth-error"));

    const body = await (await GET(new Request("http://localhost/api/health"))).json();

    expect(body.app).toEqual({ ok: true });
    expect(Object.keys(body).sort()).toEqual(["app", "configuration", "database", "status", "timestamp"]);
    expect(JSON.stringify(body)).not.toContain("synthetic-private-auth-error");
  });

  it("keeps anonymous database failures minimal without leaking the failed connection", async () => {
    healthMocks.getCurrentAdmin.mockResolvedValue(null);
    process.env.DATABASE_URL = "postgresql://private-db.invalid:5432/synthetic-db";
    healthMocks.prisma.$queryRaw.mockRejectedValue(new Error("synthetic-private-database-error"));

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.status).toBe("error");
    expect(body.database).toEqual({ ok: false });
    expect(body.configuration).toEqual({ ok: true, errors: [] });
    expect(Object.keys(body).sort()).toEqual(["app", "configuration", "database", "status", "timestamp"]);
    expect(serialized).not.toMatch(/private-db|synthetic-db|synthetic-private-database-error|Database connection failed/);
  });

  it("reports anonymous warning status without exposing configuration or driver details", async () => {
    healthMocks.getCurrentAdmin.mockResolvedValue(null);
    process.env.DATABASE_URL = "postgresql://localhost:5432/rare_test";
    process.env.RATE_LIMIT_DRIVER = "memory";
    healthMocks.prisma.$queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok_with_warnings");
    expect(body.configuration).toEqual({ ok: true, errors: [] });
    expect(Object.keys(body).sort()).toEqual(["app", "configuration", "database", "status", "timestamp"]);
    expect(JSON.stringify(body)).not.toMatch(/RATE_LIMIT_DRIVER|memory|redis|"warnings":|environment|operational/);
  });

  it("shows an Admin which address the rate limiter attributes to the request", async () => {
    const request = new Request("http://localhost/api/health", {
      headers: { "x-real-ip": "172.71.10.20", "cf-connecting-ip": "203.0.113.7" },
    });

    const body = await (await GET(request)).json();

    expect(body.clientIdentity).toEqual({ ip: "203.0.113.7", source: "cf-connecting-ip" });
  });

  it("does not trust a client-supplied Cloudflare IP without a Cloudflare peer", async () => {
    const request = new Request("http://localhost/api/health", {
      headers: { "x-real-ip": "198.51.100.23", "cf-connecting-ip": "203.0.113.7" },
    });

    const body = await (await GET(request)).json();

    expect(body.clientIdentity).toEqual({ ip: "198.51.100.23", source: "x-real-ip" });
  });

  it("resolves an Admin request without IP headers to the existing local identity", async () => {
    const body = await (await GET(new Request("http://localhost/api/health"))).json();

    expect(body.clientIdentity).toEqual({ ip: "local", source: "none" });
  });
});
