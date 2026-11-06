import { getDeploymentEnvironment, type EnvLike } from "@/lib/deployment-environment";

// Admin MFA policy. Kept free of Node-only imports: the proxy and the environment validation
// read it too. The cryptography lives in src/lib/admin-mfa-crypto.ts.

/**
 * Whether every Admin session must carry a verified second factor.
 *
 * Production always requires it: the flag cannot switch MFA off there, so a stray
 * `ADMIN_MFA_REQUIRED=false` never silently weakens the live Admin. Staging/preview default to
 * required as well (that is where the rollout is rehearsed). Local development and tests keep the
 * previous password-only flow unless the flag turns MFA on. An administrator who enrolled is
 * always challenged, whatever the flag says.
 */
export function isAdminMfaRequired(env: EnvLike = process.env) {
  const deployment = getDeploymentEnvironment(env);
  if (deployment === "production") return true;
  const flag = env.ADMIN_MFA_REQUIRED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return deployment === "restricted";
}

function decodeBase64Length(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return -1;
  try {
    return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")).length;
  } catch {
    return -1;
  }
}

/** Fixed reason code when the MFA key is unusable; never the value. Null when usable. */
export function getAdminMfaConfigurationIssue(env: EnvLike = process.env): string | null {
  const key = env.ADMIN_MFA_ENCRYPTION_KEY?.trim();
  if (!key) return "MissingADMIN_MFA_ENCRYPTION_KEY";
  if (decodeBase64Length(key) !== 32) return "InvalidADMIN_MFA_ENCRYPTION_KEY";
  const sessionSecrets = [env.ADMIN_SESSION_SECRET, env.AUTH_SECRET].map((value) => value?.trim()).filter(Boolean);
  // A leaked session secret must not also open the stored TOTP secrets.
  if (sessionSecrets.includes(key)) return "ADMIN_MFA_ENCRYPTION_KEY_ReusesSessionSecret";
  return null;
}

/** Production ignores ADMIN_MFA_REQUIRED=false; surface it so nobody believes it took effect. */
export function getAdminMfaPolicyWarning(env: EnvLike = process.env): string | null {
  if (getDeploymentEnvironment(env) === "production" && env.ADMIN_MFA_REQUIRED?.trim().toLowerCase() === "false") {
    return "AdminMfaCannotBeDisabledInProduction";
  }
  return null;
}
