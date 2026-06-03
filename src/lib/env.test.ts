import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAdminSessionSecret, getAppUrl, getR2StorageConfig, isCheckoutEnabled, validateEnvironment } from "@/lib/env";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://local/rare",
    ADMIN_SESSION_SECRET: "dev-secret-with-more-than-32-characters",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    STORAGE_DRIVER: "local",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("environment validation", () => {
  it("warns about missing Stripe configuration in development without blocking local readiness", () => {
    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.warnings.some((issue) => issue.variable === "STRIPE_SECRET_KEY")).toBe(true);
    expect(result.warnings.some((issue) => issue.variable === "STRIPE_WEBHOOK_SECRET")).toBe(true);
  });

  it("requires Stripe configuration in production when checkout is active", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://rare.example",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-production",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-secret-key",
      R2_PUBLIC_BASE_URL: "https://cdn.example",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "STRIPE_SECRET_KEY")).toBe(true);
    expect(result.errors.some((issue) => issue.variable === "STRIPE_WEBHOOK_SECRET")).toBe(true);
  });

  it("accepts Stripe test-mode style configuration without exposing secret values", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "true",
      STRIPE_SECRET_KEY: "stripe-test-secret-configured-in-provider",
      STRIPE_WEBHOOK_SECRET: "stripe-test-webhook-secret-configured-in-provider",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://cdn.example",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("does not require Stripe secrets when checkout is explicitly disabled", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://cdn.example",
    };

    const result = validateEnvironment();

    expect(isCheckoutEnabled()).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.errors.some((issue) => issue.variable === "STRIPE_SECRET_KEY")).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "STRIPE_WEBHOOK_SECRET")).toBe(false);
  });

  it("accepts AUTH_SECRET as admin session secret alias", () => {
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.AUTH_SECRET = "test-secret-" + "with-more-than-32-characters";

    expect(getAdminSessionSecret()).toBe(process.env.AUTH_SECRET);
  });

  it("normalizes server app url from APP_URL before NEXT_PUBLIC_APP_URL", () => {
    process.env.APP_URL = "https://rare.example/";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    expect(getAppUrl()).toBe("https://rare.example");
  });

  it("rejects storage drivers outside local or r2", () => {
    process.env.STORAGE_DRIVER = "s3";

    const result = validateEnvironment();

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "STORAGE_DRIVER")).toBe(true);
  });

  it("does not accept vercel_blob as a storage driver", () => {
    process.env.STORAGE_DRIVER = "vercel_blob";

    const result = validateEnvironment();

    expect(result.ok).toBe(false);
    expect(result.storageDriver).toBe("invalid");
    expect(result.errors.some((issue) => issue.variable === "STORAGE_DRIVER")).toBe(true);
  });

  it("does not require non-R2 storage credentials when R2 storage is configured", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://media.rare.example",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.storageDriver).toBe("r2");
  });

  it("treats in-memory rate limiting in production as a warning, not a critical env error", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://media.rare.example",
      RATE_LIMIT_DRIVER: "memory",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ variable: "RATE_LIMIT_DRIVER" })]));
  });

  it("warns and falls back when the shared rate limit driver lacks Redis REST credentials", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://media.rare.example",
      RATE_LIMIT_DRIVER: "redis",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      REDIS_REST_URL: "",
      REDIS_REST_TOKEN: "",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "RATE_LIMIT_DRIVER",
          message: expect.stringContaining("Falling back to memory"),
        }),
      ]),
    );
  });

  it("does not warn when the shared rate limit driver is configured", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-storage-secret",
      R2_PUBLIC_BASE_URL: "https://media.rare.example",
      RATE_LIMIT_DRIVER: "redis",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "configured-redis-token",
    };

    const result = validateEnvironment();

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((issue) => issue.variable === "RATE_LIMIT_DRIVER")).toBe(false);
  });

  it("requires R2 configuration without exposing configured secret values", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: "https://staging.rare.example",
      CHECKOUT_ENABLED: "false",
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "configured-account-id",
      R2_BUCKET: "rare-staging",
      R2_ACCESS_KEY_ID: "r2-access-key-that-must-not-leak",
      R2_SECRET_ACCESS_KEY: "",
      R2_PUBLIC_BASE_URL: "https://media.rare.example",
    };

    const result = validateEnvironment();
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(false);
    expect(result.errors.some((issue) => issue.variable === "R2_SECRET_ACCESS_KEY")).toBe(true);
    expect(serialized).not.toContain("r2-access-key-that-must-not-leak");
  });

  it("normalizes complete R2 config to the Cloudflare S3-compatible endpoint", () => {
    process.env = {
      ...process.env,
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "abc123",
      R2_BUCKET: "rare-media",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-secret-key",
      R2_PUBLIC_BASE_URL: "https://media.rare.example/",
    };

    const config = getR2StorageConfig();

    expect(config.endpoint).toBe("https://abc123.r2.cloudflarestorage.com");
    expect(config.publicBaseUrl).toBe("https://media.rare.example");
  });

  it("accepts STORAGE_PUBLIC_BASE_URL as the R2 public URL fallback", () => {
    process.env = {
      ...process.env,
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "abc123",
      R2_BUCKET: "rare-media",
      R2_ACCESS_KEY_ID: "configured-access-key",
      R2_SECRET_ACCESS_KEY: "configured-secret-key",
      R2_PUBLIC_BASE_URL: "",
      STORAGE_PUBLIC_BASE_URL: "https://cdn.rare.example/",
    };

    expect(getR2StorageConfig().publicBaseUrl).toBe("https://cdn.rare.example");
  });
});
