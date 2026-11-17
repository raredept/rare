import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_PAUSED_SERVER_MESSAGE,
  CHECKOUT_PAUSED_SHOPPER_MESSAGE,
  CHECKOUT_TRANSIENT_SERVER_MESSAGE,
  CHECKOUT_TRANSIENT_SHOPPER_MESSAGE,
  formatCheckoutMessage,
} from "@/lib/checkout-messages";

describe("formatCheckoutMessage (UIUX-CHECKOUT-002)", () => {
  it("keeps a transient failure from reading as a paused store", () => {
    expect(formatCheckoutMessage(CHECKOUT_TRANSIENT_SERVER_MESSAGE)).toBe(CHECKOUT_TRANSIENT_SHOPPER_MESSAGE);
    expect(CHECKOUT_TRANSIENT_SHOPPER_MESSAGE).not.toMatch(/pausad/i);
  });

  it("still says paused when the server really paused checkout", () => {
    expect(formatCheckoutMessage(CHECKOUT_PAUSED_SERVER_MESSAGE)).toBe(CHECKOUT_PAUSED_SHOPPER_MESSAGE);
    expect(formatCheckoutMessage("Checkout temporariamente indisponível.")).toBe(CHECKOUT_PAUSED_SHOPPER_MESSAGE);
  });

  it("matches the exact texts the checkout route sends", () => {
    const route = readFileSync(path.resolve("src/app/api/checkout/route.ts"), "utf8");
    expect(route).toContain(JSON.stringify(CHECKOUT_PAUSED_SERVER_MESSAGE));
    expect(route).toContain(JSON.stringify(CHECKOUT_TRANSIENT_SERVER_MESSAGE));
  });

  it("passes every other message through untouched", () => {
    expect(formatCheckoutMessage("Escolha uma opção de entrega para continuar.")).toBe("Escolha uma opção de entrega para continuar.");
  });
});
