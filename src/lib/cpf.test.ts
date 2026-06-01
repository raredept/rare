import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";

describe("CPF helpers", () => {
  it("validates a formatted CPF", () => {
    expect(isValidCpf("123.456.789-09")).toBe(true);
  });

  it("validates a digits-only CPF", () => {
    expect(isValidCpf("12345678909")).toBe(true);
  });

  it("rejects CPF values with invalid length", () => {
    expect(isValidCpf("1234567890")).toBe(false);
    expect(isValidCpf("123456789090")).toBe(false);
  });

  it("rejects CPF values with repeated digits", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("rejects CPF values with an invalid verifier digit", () => {
    expect(isValidCpf("12345678900")).toBe(false);
  });

  it("normalizes punctuation away", () => {
    expect(normalizeCpf("123.456.789-09")).toBe("12345678909");
  });

  it("formats CPF values with the visual mask", () => {
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });

  it("masks CPF values for operational screens", () => {
    expect(maskCpf("12345678909")).toBe("***.456.789-**");
  });
});
