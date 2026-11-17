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

export const CHECKOUT_NETWORK_MESSAGE =
  "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo — seu carrinho foi mantido.";
export const CHECKOUT_BAD_RESPONSE_MESSAGE =
  "Não conseguimos falar com o servidor agora. Tente de novo em instantes — seu carrinho foi mantido.";

/**
 * UIUX-CHECKOUT-003: a 502 page from a proxy is HTML, and `response.json()` would surface the parser's
 * own text ("Unexpected token '<'…"). Null means "no usable body"; the caller shows a human message.
 */
export async function readJsonSafely(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await response.json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type ShopperMessage = { text: string; action?: { href: string; label: string } };

const LOGIN_MESSAGE = "Para finalizar sua compra, entre ou crie sua conta.";
const IN_PROGRESS_MESSAGES = new Set([
  "Você já tem um checkout em andamento. Aguarde alguns instantes e tente novamente.",
  "Você já tem um pagamento em andamento. Aguarde a confirmação antes de iniciar outra compra.",
]);

/**
 * UIUX-CHECKOUT-004: what the shopper reads when starting the payment fails — always a next step.
 * The server's messages stay the contract (nothing changes there); only their wording here does.
 */
export function describeCheckoutFailure({ message, status, network = false }: { message?: string | null; status?: number; network?: boolean }): ShopperMessage {
  if (network) return { text: CHECKOUT_NETWORK_MESSAGE };
  if (status === 401 || message === LOGIN_MESSAGE) {
    return { text: "Sua sessão expirou ou você saiu da conta. Entre de novo — seu carrinho foi mantido.", action: { href: "/entrar?next=%2Ffinalizar-compra", label: "Entrar" } };
  }
  if (!message) return { text: CHECKOUT_BAD_RESPONSE_MESSAGE };
  if (message === "Produto indisponível.") return { text: "Uma peça do carrinho esgotou ou saiu do catálogo agora. Revise os itens e tente de novo." };
  if (message === "Estoque insuficiente para finalizar este carrinho.") return { text: "Uma das peças não tem mais a quantidade escolhida. Diminua a quantidade e tente de novo." };
  if (message === "Variação inválida.") return { text: "Um dos tamanhos escolhidos não está mais disponível. Remova o item e escolha outro tamanho na página do produto." };
  if (message === "Revise os dados do checkout.") return { text: "Não conseguimos ler os dados do pedido. Atualize a página e confira entrega e pagamento." };
  if (IN_PROGRESS_MESSAGES.has(message)) return { text: `${message} Se o aviso de reserva aparecer no topo da página, use “Continuar pagamento”.` };
  if (message.startsWith("Frete indisponível")) return { text: `${message} Se continuar, fale com a RARE pelo WhatsApp.` };
  return { text: formatCheckoutMessage(message) };
}

export function formatCheckoutMessage(message: string) {
  if (message === CHECKOUT_TRANSIENT_SERVER_MESSAGE) {
    return CHECKOUT_TRANSIENT_SHOPPER_MESSAGE;
  }
  if (message === CHECKOUT_PAUSED_SERVER_MESSAGE || message === "Checkout temporariamente indisponível.") {
    return CHECKOUT_PAUSED_SHOPPER_MESSAGE;
  }
  return message;
}
