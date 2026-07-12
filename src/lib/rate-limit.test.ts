import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRateLimitStatus, rateLimit, resetRateLimitMemoryForTests } from "@/lib/rate-limit";

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    RATE_LIMIT_DRIVER: "memory",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    REDIS_REST_URL: "",
    REDIS_REST_TOKEN: "",
    REDIS_URL: "",
  };
  resetRateLimitMemoryForTests();
});

afterEach(() => {
  process.env = originalEnv;
  resetRateLimitMemoryForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rate limit driver", () => {
  it("enforces limits with the memory driver and resets after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const first = await rateLimit("customer-login:cliente@example.com", 2, 1_000);
    const second = await rateLimit("customer-login:cliente@example.com", 2, 1_000);
    const blocked = await rateLimit("customer-login:cliente@example.com", 2, 1_000);

    expect(first).toEqual(expect.objectContaining({ ok: true, remaining: 1, driver: "memory", shared: false }));
    expect(second).toEqual(expect.objectContaining({ ok: true, remaining: 0, driver: "memory", shared: false }));
    expect(blocked).toEqual(expect.objectContaining({ ok: false, remaining: 0, driver: "memory", shared: false }));

    vi.advanceTimersByTime(1_001);

    const afterReset = await rateLimit("customer-login:cliente@example.com", 2, 1_000);
    expect(afterReset).toEqual(expect.objectContaining({ ok: true, remaining: 1, driver: "memory", shared: false }));
  });

  it("keeps memory as the default driver outside production", () => {
    const status = getRateLimitStatus();

    expect(status).toEqual(
      expect.objectContaining({
        configuredDriver: "memory",
        activeDriver: "memory",
        activeTransport: "memory",
        shared: false,
        warnings: [],
      }),
    );
  });

  it("warns in production when the memory driver is active", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      RATE_LIMIT_DRIVER: "memory",
    };

    const status = getRateLimitStatus();

    expect(status.activeDriver).toBe("memory");
    expect(status.shared).toBe(false);
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining("not shared across production")]));
  });

  it("falls back to memory when redis is selected without REST credentials", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      RATE_LIMIT_DRIVER: "redis",
    };

    const status = getRateLimitStatus();

    expect(status).toEqual(
      expect.objectContaining({
        configuredDriver: "redis",
        activeDriver: "memory",
        activeTransport: "memory",
        shared: false,
        redisRestUrlConfigured: false,
        redisRestTokenConfigured: false,
        redisTcpUrlConfigured: false,
      }),
    );
    expect(status.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Falling back to memory")]));
  });

  it("uses the Redis REST driver when shared credentials are configured", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      RATE_LIMIT_DRIVER: "redis",
      UPSTASH_REDIS_REST_URL: "https://redis.example",
      UPSTASH_REDIS_REST_TOKEN: "configured-redis-token",
    };

    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ result: [1, 60_000] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const status = getRateLimitStatus();
    const result = await rateLimit("customer-login:cliente@example.com", 2, 60_000);
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as unknown[];
    const headers = requestInit.headers as Record<string, string>;

    expect(status).toEqual(
      expect.objectContaining({
        configuredDriver: "redis",
        activeDriver: "redis",
        activeTransport: "rest",
        shared: true,
        redisRestUrlConfigured: true,
        redisRestTokenConfigured: true,
        warnings: [],
      }),
    );
    expect(result).toEqual(expect.objectContaining({ ok: true, remaining: 1, driver: "redis", shared: true }));
    expect(fetchMock).toHaveBeenCalledWith("https://redis.example", expect.any(Object));
    expect(headers.Authorization).toBe("Bearer configured-redis-token");
    expect(body[0]).toBe("EVAL");
    expect(JSON.stringify(body)).not.toContain("cliente@example.com");
  });

  it("selects the Redis TCP driver when REDIS_URL is configured", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      RATE_LIMIT_DRIVER: "redis",
      REDIS_URL: "redis://default:secret@redis.railway.internal:6379",
    };

    expect(getRateLimitStatus()).toEqual(
      expect.objectContaining({
        configuredDriver: "redis",
        activeDriver: "redis",
        activeTransport: "tcp",
        shared: true,
        redisTcpUrlConfigured: true,
        warnings: [],
      }),
    );
  });
});
