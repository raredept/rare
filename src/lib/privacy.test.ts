import { describe, expect, it } from "vitest";
import { isValidCpf, maskCpf, normalizeCpf, normalizePhone, toCustomerProfileView } from "@/lib/privacy";

describe("privacy helpers", () => {
  it("normalizes and validates CPF without keeping punctuation", () => {
    expect(normalizeCpf("123.456.789-09")).toBe("12345678909");
    expect(isValidCpf("123.456.789-09")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("masks CPF for screens that do not need the full value", () => {
    expect(maskCpf("12345678909")).toBe("***.456.789-**");
    expect(maskCpf("123")).toBe("");
  });

  it("builds customer profile props without serializing the full CPF", () => {
    const view = toCustomerProfileView({
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: "11999998888",
      cpf: "12345678909",
    });

    expect(view).toEqual({
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: "11999998888",
      cpfMasked: "***.456.789-**",
    });
    expect(JSON.stringify(view)).not.toContain("12345678909");
  });

  it("keeps phone as digits only", () => {
    expect(normalizePhone("(11) 99999-8888")).toBe("11999998888");
  });
});
