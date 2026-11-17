import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKOUT_BAD_RESPONSE_MESSAGE,
  CHECKOUT_NETWORK_MESSAGE,
  describeCheckoutFailure,
  readJsonSafely,
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

  it("never shows a parser error for an HTML error page (UIUX-CHECKOUT-003)", async () => {
    const html = new Response("<!doctype html><title>502</title>", { status: 502, headers: { "content-type": "text/html" } });
    expect(await readJsonSafely(html)).toBeNull();
    expect(describeCheckoutFailure({ message: null, status: 502 }).text).toBe(CHECKOUT_BAD_RESPONSE_MESSAGE);
    expect(describeCheckoutFailure({ network: true }).text).toBe(CHECKOUT_NETWORK_MESSAGE);
    expect(await readJsonSafely(new Response(JSON.stringify({ error: "x" })))).toEqual({ error: "x" });
  });

  it("gives every known checkout failure a next step (UIUX-CHECKOUT-004)", () => {
    expect(describeCheckoutFailure({ message: "Para finalizar sua compra, entre ou crie sua conta.", status: 401 })).toEqual({
      text: "Sua sessão expirou ou você saiu da conta. Entre de novo — seu carrinho foi mantido.",
      action: { href: "/entrar?next=%2Ffinalizar-compra", label: "Entrar" },
    });
    expect(describeCheckoutFailure({ message: "Variação inválida.", status: 400 }).text).toMatch(/tamanhos escolhidos não está mais disponível/);
    expect(describeCheckoutFailure({ message: "Estoque insuficiente para finalizar este carrinho.", status: 400 }).text).toMatch(/Diminua a quantidade/);
    expect(describeCheckoutFailure({ message: "Produto indisponível.", status: 400 }).text).toMatch(/Revise os itens/);
    expect(describeCheckoutFailure({ message: "Frete indisponível no momento. Tente novamente em alguns instantes.", status: 400 }).text).toMatch(/WhatsApp/);
    expect(describeCheckoutFailure({ message: "Você já tem um checkout em andamento. Aguarde alguns instantes e tente novamente.", status: 409 }).text).toMatch(/Continuar pagamento/);
    expect(describeCheckoutFailure({ message: CHECKOUT_TRANSIENT_SERVER_MESSAGE, status: 503 }).text).toBe(CHECKOUT_TRANSIENT_SHOPPER_MESSAGE);
    // The minimum-payment message is already clear: unchanged.
    expect(describeCheckoutFailure({ message: "O valor mínimo para pagamento é de R$ 10,00.", status: 400 }).text).toBe("O valor mínimo para pagamento é de R$ 10,00.");
  });

  it("passes every other message through untouched", () => {
    expect(formatCheckoutMessage("Escolha uma opção de entrega para continuar.")).toBe("Escolha uma opção de entrega para continuar.");
  });
});
