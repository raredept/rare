// Shopper-facing wording for checkout errors returned by /api/checkout and the shipping preview.
// Only presentation: the server decides when checkout is paused or failed; this maps its text.

/** The real pause: checkout switched off (or payment credentials refused) — see api/checkout/route.ts. */
export const CHECKOUT_PAUSED_SERVER_MESSAGE =
  "Checkout temporariamente indisponível. Fale com a RARE para concluir seu pedido por enquanto.";

/** Any unmapped exception (provider timeout, transient database error). Not a pause. */
export const CHECKOUT_TRANSIENT_SERVER_MESSAGE = "Checkout temporariamente indisponível. Tente novamente em alguns minutos.";

export const CHECKOUT_PAUSED_SHOPPER_MESSAGE =
  "O checkout está temporariamente pausado. Consulte a RARE para verificar disponibilidade.";

export const CHECKOUT_TRANSIENT_SHOPPER_MESSAGE =
  "Não conseguimos iniciar o pagamento agora. Seu carrinho foi mantido — tente de novo em alguns instantes.";

export function formatCheckoutMessage(message: string) {
  if (message === CHECKOUT_TRANSIENT_SERVER_MESSAGE) {
    return CHECKOUT_TRANSIENT_SHOPPER_MESSAGE;
  }
  if (message === CHECKOUT_PAUSED_SERVER_MESSAGE || message === "Checkout temporariamente indisponível.") {
    return CHECKOUT_PAUSED_SHOPPER_MESSAGE;
  }
  return message;
}
