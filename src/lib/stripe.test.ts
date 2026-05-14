import { describe, expect, it } from "vitest";
import { normalizePaymentMethodTypes } from "@/lib/stripe";

describe("stripe helpers", () => {
  it("uses dynamic payment methods when no override is configured", () => {
    expect(normalizePaymentMethodTypes("")).toBeUndefined();
  });

  it("accepts explicit card and pix override", () => {
    expect(normalizePaymentMethodTypes("card,pix")).toEqual(["card", "pix"]);
  });

  it("rejects unsupported payment methods", () => {
    expect(() => normalizePaymentMethodTypes("card,boleto")).toThrow("Unsupported");
  });
});
