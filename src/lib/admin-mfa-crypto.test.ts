import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getAdminMfaConfigurationIssue, getAdminMfaPolicyWarning, isAdminMfaRequired } from "@/lib/admin-mfa-config";
import {
  AdminMfaConfigError,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  openMfaSecret,
  sealMfaSecret,
} from "@/lib/admin-mfa-crypto";

const key = randomBytes(32).toString("base64");
const env = { ADMIN_MFA_ENCRYPTION_KEY: key, ADMIN_SESSION_SECRET: "x".repeat(40) };

describe("admin MFA policy", () => {
  it("is always required in production, even if the flag says false", () => {
    expect(isAdminMfaRequired({ APP_ENV: "production" })).toBe(true);
    expect(isAdminMfaRequired({ APP_ENV: "production", ADMIN_MFA_REQUIRED: "false" })).toBe(true);
    expect(getAdminMfaPolicyWarning({ APP_ENV: "production", ADMIN_MFA_REQUIRED: "false" })).toBe("AdminMfaCannotBeDisabledInProduction");
    expect(isAdminMfaRequired({ NODE_ENV: "production" })).toBe(true);
  });

  it("defaults to required in staging and optional in development", () => {
    expect(isAdminMfaRequired({ APP_ENV: "staging" })).toBe(true);
    expect(isAdminMfaRequired({ APP_ENV: "staging", ADMIN_MFA_REQUIRED: "false" })).toBe(false);
    expect(isAdminMfaRequired({ APP_ENV: "development" })).toBe(false);
    expect(isAdminMfaRequired({ APP_ENV: "development", ADMIN_MFA_REQUIRED: "true" })).toBe(true);
  });

  it("reports unusable keys with fixed codes, never the value", () => {
    expect(getAdminMfaConfigurationIssue({})).toBe("MissingADMIN_MFA_ENCRYPTION_KEY");
    expect(getAdminMfaConfigurationIssue({ ADMIN_MFA_ENCRYPTION_KEY: "short" })).toBe("InvalidADMIN_MFA_ENCRYPTION_KEY");
    expect(getAdminMfaConfigurationIssue({ ADMIN_MFA_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toBe("InvalidADMIN_MFA_ENCRYPTION_KEY");
    expect(getAdminMfaConfigurationIssue({ ADMIN_MFA_ENCRYPTION_KEY: key, ADMIN_SESSION_SECRET: key })).toBe("ADMIN_MFA_ENCRYPTION_KEY_ReusesSessionSecret");
    expect(getAdminMfaConfigurationIssue(env)).toBeNull();
    expect(getAdminMfaConfigurationIssue({ ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64url") })).toBeNull();
  });
});

describe("TOTP secret sealing", () => {
  it("round-trips and never stores the secret in clear", () => {
    const sealed = sealMfaSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", "user_1", env);
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain("JBSWY3DP");
    expect(openMfaSecret(sealed, "user_1", env)).toBe("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP");
    expect(sealMfaSecret("JBSWY3DPEHPK3PXP", "user_1", env)).not.toBe(sealMfaSecret("JBSWY3DPEHPK3PXP", "user_1", env));
  });

  it("does not open for another account, another key, or after tampering", () => {
    const sealed = sealMfaSecret("JBSWY3DPEHPK3PXP", "user_1", env);
    expect(() => openMfaSecret(sealed, "user_2", env)).toThrow();
    expect(() => openMfaSecret(sealed, "user_1", { ...env, ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64") })).toThrow();
    const bytes = Buffer.from(sealed.slice(3), "base64url");
    bytes[bytes.length - 1] ^= 1;
    expect(() => openMfaSecret(`v1.${bytes.toString("base64url")}`, "user_1", env)).toThrow();
    expect(() => openMfaSecret("v2.abc", "user_1", env)).toThrow("InvalidSealedMfaSecret");
  });

  it("refuses to seal without a valid key", () => {
    expect(() => sealMfaSecret("JBSWY3DPEHPK3PXP", "user_1", {})).toThrow(AdminMfaConfigError);
  });
});

describe("recovery codes", () => {
  it("are strong, unique and readable", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  });

  it("normalize case and separators and reject anything else", () => {
    expect(normalizeRecoveryCode(" abcde-fgh23 ")).toBe("ABCDEFGH23");
    expect(normalizeRecoveryCode("ABCDE FGH23")).toBe("ABCDEFGH23");
    expect(normalizeRecoveryCode("ABCDE-FGH2O")).toBeNull();
    expect(normalizeRecoveryCode("123456")).toBeNull();
    expect(normalizeRecoveryCode(null)).toBeNull();
  });

  it("are stored as a keyed hash that depends on the server key", () => {
    const hash = hashRecoveryCode("ABCDEFGH23", env);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashRecoveryCode("ABCDEFGH23", env));
    expect(hash).not.toBe(hashRecoveryCode("ABCDEFGH24", env));
    expect(hash).not.toBe(hashRecoveryCode("ABCDEFGH23", { ...env, ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64") }));
  });
});
