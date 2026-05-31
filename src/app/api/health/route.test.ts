import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const healthMocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
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
  };
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
    expect(body.environment.shipping).toEqual({
      enabled: true,
      provider: "manual",
      originCepConfigured: true,
    });
    expect(serialized).not.toContain("stripe-secret-value-that-must-not-be-returned");
    expect(serialized).not.toContain("stripe-webhook-value-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-account-id-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-access-key-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-secret-that-must-not-be-returned");
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
