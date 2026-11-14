import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt } from "node:crypto";
import { getAdminMfaConfigurationIssue } from "@/lib/admin-mfa-config";
import type { EnvLike } from "@/lib/deployment-environment";

// Sealing of TOTP secrets and hashing of recovery codes.
//
// The TOTP secret must be recoverable (the server recomputes codes), so it is encrypted, not
// hashed: AES-256-GCM with a key that exists only for this purpose (ADMIN_MFA_ENCRYPTION_KEY,
// never the session secret) and the user id as associated data, so a sealed value copied onto
// another account does not open. Recovery codes are only ever compared, so they are stored as a
// keyed hash (HMAC-SHA256 under a key derived from the same master key).

const SEAL_VERSION = "v1";
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I: read aloud safely
export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10; // 50 bits each

export class AdminMfaConfigError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AdminMfaConfigError";
  }
}

function getMasterKey(env: EnvLike) {
  const issue = getAdminMfaConfigurationIssue(env);
  if (issue) throw new AdminMfaConfigError(issue);
  const raw = (env.ADMIN_MFA_ENCRYPTION_KEY as string).trim().replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(raw, "base64");
}

function deriveKey(env: EnvLike, purpose: string) {
  return Buffer.from(hkdfSync("sha256", getMasterKey(env), Buffer.alloc(0), `rare-admin-mfa:${purpose}`, 32));
}

function aad(userId: string) {
  return Buffer.from(`rare-admin-mfa-secret:${userId}`);
}

export function sealMfaSecret(secret: string, userId: string, env: EnvLike = process.env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(env, "totp-secret"), iv);
  cipher.setAAD(aad(userId));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${SEAL_VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}

/** Throws on a wrong key, a tampered value or a value sealed for another account. */
export function openMfaSecret(sealed: string, userId: string, env: EnvLike = process.env) {
  const [version, payload] = sealed.split(".");
  if (version !== SEAL_VERSION || !payload) throw new Error("InvalidSealedMfaSecret");
  const data = Buffer.from(payload, "base64url");
  if (data.length < 12 + 16 + 1) throw new Error("InvalidSealedMfaSecret");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(env, "totp-secret"), data.subarray(0, 12));
  decipher.setAAD(aad(userId));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

/** Uppercase, without separators; null when it cannot be a recovery code at all. */
export function normalizeRecoveryCode(input: unknown) {
  if (typeof input !== "string") return null;
  const value = input.toUpperCase().replace(/[\s-]/g, "");
  const pattern = new RegExp(`^[${RECOVERY_ALPHABET}]{${RECOVERY_CODE_LENGTH}}$`);
  return pattern.test(value) ? value : null;
}

export function hashRecoveryCode(normalizedCode: string, env: EnvLike = process.env) {
  return createHmac("sha256", deriveKey(env, "recovery-code")).update(normalizedCode).digest("hex");
}

/** Codes as shown to the administrator (XXXXX-XXXXX). Shown once, never stored in clear. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    let code = "";
    for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
}
