import { createHash } from "node:crypto";
import { getRateLimitStatus, getRedisRestConfig, type RateLimitDriver, type RedisRestConfig } from "@/lib/rate-limit-config";

export { getRateLimitStatus } from "@/lib/rate-limit-config";
export type { RateLimitDriver, RateLimitStatus } from "@/lib/rate-limit-config";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  driver: RateLimitDriver;
  shared: boolean;
};

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSharedDriverFailureLogAt = 0;

const redisRateLimitScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

function hashRateLimitKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function getBucketKey(key: string) {
  return hashRateLimitKey(key);
}

function getRedisKey(key: string, prefix: string) {
  return `${prefix}:${hashRateLimitKey(key)}`;
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucketKey = getBucketKey(key);
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt, driver: "memory", shared: false };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt, driver: "memory", shared: false };
  }

  current.count += 1;
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt, driver: "memory", shared: false };
}

function numberFromRedisValue(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid shared rate limit response.");
  }
  return parsed;
}

function parseRedisRestResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("result" in payload)) {
    throw new Error("Invalid shared rate limit response.");
  }

  const result = (payload as { result?: unknown; error?: unknown }).result;
  const error = (payload as { result?: unknown; error?: unknown }).error;
  if (error) {
    throw new Error("Shared rate limit request failed.");
  }

  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Invalid shared rate limit response.");
  }

  return {
    count: numberFromRedisValue(result[0]),
    ttl: numberFromRedisValue(result[1]),
  };
}

async function redisRateLimit(key: string, limit: number, windowMs: number, config: Required<RedisRestConfig>): Promise<RateLimitResult> {
  const now = Date.now();
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["EVAL", redisRateLimitScript, "1", getRedisKey(key, config.prefix), String(windowMs)]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Shared rate limit request failed.");
  }

  const { count, ttl } = parseRedisRestResponse(await response.json());
  const resetAt = now + (ttl > 0 ? ttl : windowMs);

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    driver: "redis",
    shared: true,
  };
}

function logSharedDriverFallback() {
  const now = Date.now();
  if (now - lastSharedDriverFailureLogAt < 60_000) return;
  lastSharedDriverFailureLogAt = now;
  console.error("[rate-limit] Shared rate limit driver unavailable; falling back to memory for this request.");
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const normalizedWindowMs = Math.max(1, Math.floor(windowMs));
  const status = getRateLimitStatus();

  if (status.activeDriver === "redis") {
    const redis = getRedisRestConfig();
    if (redis.url && redis.token) {
      try {
        return await redisRateLimit(key, normalizedLimit, normalizedWindowMs, {
          url: redis.url,
          token: redis.token,
          prefix: redis.prefix,
        });
      } catch {
        logSharedDriverFallback();
      }
    }
  }

  return memoryRateLimit(key, normalizedLimit, normalizedWindowMs);
}

export function resetRateLimitMemoryForTests() {
  buckets.clear();
  lastSharedDriverFailureLogAt = 0;
}
