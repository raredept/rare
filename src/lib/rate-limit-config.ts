export type RateLimitDriver = "memory" | "redis";

export type RateLimitStatus = {
  configuredDriver: string;
  activeDriver: RateLimitDriver;
  shared: boolean;
  redisRestUrlConfigured: boolean;
  redisRestTokenConfigured: boolean;
  warnings: string[];
};

export type RedisRestConfig = {
  url?: string;
  token?: string;
  prefix: string;
};

type RuntimeEnv = Record<string, string | undefined>;

const DEFAULT_REDIS_PREFIX = "rare:rate-limit";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getConfiguredDriver(env: RuntimeEnv) {
  return clean(env.RATE_LIMIT_DRIVER)?.toLowerCase() ?? "memory";
}

export function getRedisRestConfig(env: RuntimeEnv = process.env): RedisRestConfig {
  return {
    url: clean(env.UPSTASH_REDIS_REST_URL) ?? clean(env.REDIS_REST_URL),
    token: clean(env.UPSTASH_REDIS_REST_TOKEN) ?? clean(env.REDIS_REST_TOKEN),
    prefix: clean(env.RATE_LIMIT_REDIS_PREFIX) ?? DEFAULT_REDIS_PREFIX,
  };
}

export function getRateLimitStatus(env: RuntimeEnv = process.env): RateLimitStatus {
  const configuredDriver = getConfiguredDriver(env);
  const production = (clean(env.NODE_ENV) ?? "development") === "production";
  const redis = getRedisRestConfig(env);
  const redisConfigured = Boolean(redis.url && redis.token);
  const warnings: string[] = [];
  let activeDriver: RateLimitDriver = "memory";

  if (configuredDriver === "redis" || configuredDriver === "upstash") {
    if (redisConfigured) {
      activeDriver = "redis";
    } else {
      warnings.push(
        "RATE_LIMIT_DRIVER=redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or REDIS_REST_URL and REDIS_REST_TOKEN. Falling back to memory.",
      );
    }
  } else if (configuredDriver === "memory") {
    if (production) {
      warnings.push(
        "RATE_LIMIT_DRIVER=memory is not shared across production instances. Configure RATE_LIMIT_DRIVER=redis with shared Redis REST credentials.",
      );
    }
  } else {
    warnings.push(`RATE_LIMIT_DRIVER=${configuredDriver} is not supported. Falling back to memory.`);
  }

  return {
    configuredDriver,
    activeDriver,
    shared: activeDriver === "redis",
    redisRestUrlConfigured: Boolean(redis.url),
    redisRestTokenConfigured: Boolean(redis.token),
    warnings,
  };
}
