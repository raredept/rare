/**
 * The single answer to "which environment is this?".
 *
 * APP_ENV used to be interpreted in seven places, and they disagreed. The e-mail
 * policy accepted `prod` and `live` as production names, while the media
 * backfill guard only recognised the literal `production`, so a production
 * deployment configured as `APP_ENV=prod` would have run a destructive R2
 * backfill without its explicit authorization. The staging gate, SEO noindex and
 * local-storage rule each carried their own copy of the restricted list.
 *
 * Every guard that needs the environment reads it from here.
 */

export type EnvLike = Record<string, string | undefined>;

export type DeploymentEnvironment = "production" | "restricted" | "development";

export const PRODUCTION_APP_ENVS: readonly string[] = ["production", "prod", "live"];
export const RESTRICTED_APP_ENVS: readonly string[] = ["staging", "preview", "homologation"];
export const DEVELOPMENT_APP_ENVS: readonly string[] = ["development", "test"];

export const KNOWN_APP_ENVS: readonly string[] = [...PRODUCTION_APP_ENVS, ...RESTRICTED_APP_ENVS, ...DEVELOPMENT_APP_ENVS];

export function normalizeAppEnv(env: EnvLike = process.env) {
  const value = env.APP_ENV?.trim().toLowerCase();
  return value ? value : null;
}

export function isProductionAppEnv(env: EnvLike = process.env) {
  const appEnv = normalizeAppEnv(env);
  return appEnv !== null && PRODUCTION_APP_ENVS.includes(appEnv);
}

/** A gated homologation deployment: Basic gate, noindex, test-only credentials. */
export function isRestrictedAppEnv(env: EnvLike = process.env) {
  const appEnv = normalizeAppEnv(env);
  return appEnv !== null && RESTRICTED_APP_ENVS.includes(appEnv);
}

/** Set but not one of the names any guard understands. */
export function isUnknownAppEnv(env: EnvLike = process.env) {
  const appEnv = normalizeAppEnv(env);
  return appEnv !== null && !KNOWN_APP_ENVS.includes(appEnv);
}

/**
 * A known APP_ENV name is authoritative, so a label means the same thing to
 * every guard — including the e-mail policy, which decides test/production
 * delivery from the same names. Only an unset or unrecognised APP_ENV falls
 * back to NODE_ENV, which makes it count as production on a production build:
 * the conservative reading.
 */
export function getDeploymentEnvironment(env: EnvLike = process.env): DeploymentEnvironment {
  const appEnv = normalizeAppEnv(env);
  if (appEnv && PRODUCTION_APP_ENVS.includes(appEnv)) return "production";
  if (appEnv && RESTRICTED_APP_ENVS.includes(appEnv)) return "restricted";
  if (appEnv && DEVELOPMENT_APP_ENVS.includes(appEnv)) return "development";
  return env.NODE_ENV?.trim() === "production" ? "production" : "development";
}

export function describeEnvironment(environment: DeploymentEnvironment) {
  if (environment === "production") return "produção";
  if (environment === "restricted") return "homologação";
  return "desenvolvimento";
}
