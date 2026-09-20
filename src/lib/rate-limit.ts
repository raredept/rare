import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import {
  getRateLimitStatus,
  getRedisRestConfig,
  getRedisTcpConfig,
  type RateLimitDriver,
  type RedisRestConfig,
} from "@/lib/rate-limit-config";

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
let redisTcpClient: RedisClientType | null = null;
let redisTcpClientUrl: string | null = null;
let redisTcpConnectPromise: Promise<RedisClientType> | null = null;

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

// A bucket is only revisited when the same identity comes back, so expired
// entries for one-shot identities (a guessed e-mail, a spoofed address) would
// otherwise accumulate for the life of the process. This matters exactly when
// the memory driver is load bearing: a Redis outage during an attack.
export const MAX_MEMORY_BUCKETS = 50_000;

function sweepExpiredBuckets(now: number) {
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
}

function evictOldestBuckets() {
  // Still at the cap after sweeping: drop the entries closest to expiring, one
  // more than the overflow so the incoming identity has room.
  const overflow = buckets.size - MAX_MEMORY_BUCKETS + 1;
  const byResetAt = [...buckets].sort((first, second) => first[1].resetAt - second[1].resetAt);
  for (const [bucketKey] of byResetAt.slice(0, overflow)) {
    buckets.delete(bucketKey);
  }
}

function enforceMemoryBucketCap(now: number) {
  if (buckets.size < MAX_MEMORY_BUCKETS) return;
  sweepExpiredBuckets(now);
  if (buckets.size >= MAX_MEMORY_BUCKETS) evictOldestBuckets();
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucketKey = getBucketKey(key);
  const current = buckets.get(bucketKey);

  if (!current) enforceMemoryBucketCap(now);

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

async function getConnectedRedisTcpClient(url: string) {
  if (redisTcpClientUrl !== url) {
    redisTcpClient?.destroy();
    redisTcpClient = null;
    redisTcpConnectPromise = null;
    redisTcpClientUrl = url;
  }

  if (redisTcpClient?.isReady) return redisTcpClient;
  if (redisTcpConnectPromise) return redisTcpConnectPromise;

  const client = createClient({
    url,
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy: false,
    },
  });
  client.on("error", () => undefined);
  redisTcpClient = client;
  redisTcpConnectPromise = client
    .connect()
    .then(() => client)
    .catch((error) => {
      client.destroy();
      redisTcpClient = null;
      redisTcpConnectPromise = null;
      throw error;
    });

  return redisTcpConnectPromise;
}

async function redisTcpRateLimit(key: string, limit: number, windowMs: number, url: string, prefix: string): Promise<RateLimitResult> {
  const now = Date.now();
  const client = await getConnectedRedisTcpClient(url);
  const result = await client.eval(redisRateLimitScript, {
    keys: [getRedisKey(key, prefix)],
    arguments: [String(windowMs)],
  });

  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("Invalid shared rate limit response.");
  }

  const count = numberFromRedisValue(result[0]);
  const ttl = numberFromRedisValue(result[1]);
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
    try {
      if (status.activeTransport === "rest") {
        const redis = getRedisRestConfig();
        if (!redis.url || !redis.token) throw new Error("Redis REST configuration unavailable.");
        return await redisRateLimit(key, normalizedLimit, normalizedWindowMs, {
          url: redis.url,
          token: redis.token,
          prefix: redis.prefix,
        });
      }

      if (status.activeTransport === "tcp") {
        const redis = getRedisTcpConfig();
        if (!redis.url) throw new Error("Redis TCP configuration unavailable.");
        return await redisTcpRateLimit(key, normalizedLimit, normalizedWindowMs, redis.url, redis.prefix);
      }
    } catch {
      logSharedDriverFallback();
    }
  }

  return memoryRateLimit(key, normalizedLimit, normalizedWindowMs);
}

export function getMemoryBucketCountForTests() {
  return buckets.size;
}

export function resetRateLimitMemoryForTests() {
  buckets.clear();
  lastSharedDriverFailureLogAt = 0;
  redisTcpClient?.destroy();
  redisTcpClient = null;
  redisTcpClientUrl = null;
  redisTcpConnectPromise = null;
}
