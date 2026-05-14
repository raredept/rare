import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

const originalEnv = process.env;

beforeEach(() => {
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
    expect(serialized).not.toContain("stripe-secret-value-that-must-not-be-returned");
    expect(serialized).not.toContain("stripe-webhook-value-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-account-id-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-access-key-that-must-not-be-returned");
    expect(serialized).not.toContain("storage-secret-that-must-not-be-returned");
  });
});
