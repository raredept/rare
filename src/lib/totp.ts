import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 TOTP (HMAC-SHA1, 30 s, 6 digits): the defaults every authenticator app implements
// (Google/Microsoft Authenticator, 1Password, Authy, ...). No vendor integration involved.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted on each side of "now": tolerates ~30 s of clock drift, nothing more. */
export const TOTP_ALLOWED_DRIFT_STEPS = 1;

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(clean)) throw new Error("InvalidBase32");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** 160-bit secret, the size RFC 4226 recommends for HMAC-SHA1. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpStep(nowMs: number) {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export type TotpVerification =
  | { ok: true; step: number }
  | { ok: false; reason: "format" | "invalid" | "replay" };

/**
 * Checks a code against the steps around `nowMs`. A code whose step is not newer than the last
 * accepted one is a replay (the same code, or an older one, presented again) and is refused.
 * Every candidate step is compared, in constant time, so timing does not reveal which matched.
 */
export function verifyTotp(input: { secret: string; code: unknown; nowMs: number; lastUsedStep?: number | null }): TotpVerification {
  if (typeof input.code !== "string") return { ok: false, reason: "format" };
  const code = input.code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "format" };
  const key = base32Decode(input.secret);
  const current = totpStep(input.nowMs);
  const received = Buffer.from(code);
  let matched: number | null = null;
  for (let step = current - TOTP_ALLOWED_DRIFT_STEPS; step <= current + TOTP_ALLOWED_DRIFT_STEPS; step += 1) {
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, received) && matched === null) matched = step;
  }
  if (matched === null) return { ok: false, reason: "invalid" };
  if (typeof input.lastUsedStep === "number" && matched <= input.lastUsedStep) return { ok: false, reason: "replay" };
  return { ok: true, step: matched };
}

export function buildOtpAuthUri(input: { secret: string; accountName: string; issuer: string }) {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.accountName)}`;
  // Percent-encoding (not "+") for spaces: several authenticators read "+" literally.
  const params = [
    ["secret", input.secret],
    ["issuer", input.issuer],
    ["algorithm", "SHA1"],
    ["digits", String(TOTP_DIGITS)],
    ["period", String(TOTP_PERIOD_SECONDS)],
  ].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("&");
  return `otpauth://totp/${label}?${params}`;
}
