import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, buildOtpAuthUri, generateTotpSecret, hotp, totpStep, verifyTotp } from "@/lib/totp";

// RFC 6238 Appendix B, SHA-1 key "12345678901234567890". The RFC lists 8-digit values; the
// 6-digit code is the same truncation modulo 10^6.
const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("matches the RFC vector at T=%i", (seconds, expected) => {
    expect(hotp(base32Decode(rfcSecret), totpStep(seconds * 1000))).toBe(expected);
  });

  it("round-trips base32 and generates 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(() => base32Decode("not base32!")).toThrow("InvalidBase32");
  });

  it("accepts the current code and one step of drift, nothing further", () => {
    const now = 1_800_000_000_000;
    const key = base32Decode(rfcSecret);
    const step = totpStep(now);
    expect(verifyTotp({ secret: rfcSecret, code: hotp(key, step), nowMs: now })).toEqual({ ok: true, step });
    expect(verifyTotp({ secret: rfcSecret, code: hotp(key, step - 1), nowMs: now })).toEqual({ ok: true, step: step - 1 });
    expect(verifyTotp({ secret: rfcSecret, code: hotp(key, step + 1), nowMs: now })).toEqual({ ok: true, step: step + 1 });
    expect(verifyTotp({ secret: rfcSecret, code: hotp(key, step - 2), nowMs: now })).toEqual({ ok: false, reason: "invalid" });
    expect(verifyTotp({ secret: rfcSecret, code: hotp(key, step + 2), nowMs: now })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a code from an expired window", () => {
    const issuedAt = 1_800_000_000_000;
    const code = hotp(base32Decode(rfcSecret), totpStep(issuedAt));
    expect(verifyTotp({ secret: rfcSecret, code, nowMs: issuedAt + 120_000 })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses replays of the last accepted step or older", () => {
    const now = 1_800_000_000_000;
    const step = totpStep(now);
    const code = hotp(base32Decode(rfcSecret), step);
    expect(verifyTotp({ secret: rfcSecret, code, nowMs: now, lastUsedStep: step })).toEqual({ ok: false, reason: "replay" });
    expect(verifyTotp({ secret: rfcSecret, code, nowMs: now, lastUsedStep: step + 1 })).toEqual({ ok: false, reason: "replay" });
    expect(verifyTotp({ secret: rfcSecret, code, nowMs: now, lastUsedStep: step - 1 })).toEqual({ ok: true, step });
  });

  it("rejects malformed input before any comparison", () => {
    for (const code of [undefined, 123456, "", "12345", "1234567", "abcdef", "12 34 5"]) {
      expect(verifyTotp({ secret: rfcSecret, code, nowMs: 0 })).toEqual({ ok: false, reason: "format" });
    }
    const now = 1_800_000_000_000;
    const spaced = hotp(base32Decode(rfcSecret), totpStep(now)).replace(/^(\d{3})/, "$1 ");
    expect(verifyTotp({ secret: rfcSecret, code: spaced, nowMs: now }).ok).toBe(true);
  });

  it("builds a standard otpauth URI", () => {
    const uri = buildOtpAuthUri({ secret: "JBSWY3DPEHPK3PXP", accountName: "admin@rare.test", issuer: "RARE Admin" });
    expect(uri).toBe("otpauth://totp/RARE%20Admin:admin%40rare.test?secret=JBSWY3DPEHPK3PXP&issuer=RARE%20Admin&algorithm=SHA1&digits=6&period=30");
  });
});
