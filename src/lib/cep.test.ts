import { describe, expect, it } from "vitest";
import { formatCep, isValidCep, normalizeCep, parseCep } from "@/lib/cep";

describe("cep helpers", () => {
  it("normalizes Brazilian CEP values to digits", () => {
    expect(normalizeCep("01001-000")).toBe("01001000");
    expect(normalizeCep(" 01001 000 ")).toBe("01001000");
  });

  it("validates exactly 8 digits", () => {
    expect(isValidCep("01001-000")).toBe(true);
    expect(isValidCep("0100100")).toBe(false);
    expect(parseCep("0100100")).toBeNull();
  });

  it("formats CEP for display", () => {
    expect(formatCep("01001000")).toBe("01001-000");
  });
});
