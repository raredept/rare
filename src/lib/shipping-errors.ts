// Shopper-facing shipping/checkout errors must never expose provider or configuration
// details (variable names, tokens, OAuth, provider status). Those messages stay in the
// server log; the shopper receives a neutral, actionable sentence.
export const SHIPPING_UNAVAILABLE_MESSAGE = "Frete indisponível no momento. Tente novamente em alguns instantes.";
export const SHIPPING_PRODUCT_DATA_MESSAGE = "Não foi possível calcular o frete de um dos itens agora. Fale com a RARE para concluir seu pedido.";

/** Messages that are safe and useful to show to a shopper as-is (client errors, HTTP 400). */
export const shopperShippingErrors = new Set([
  "CEP de destino inválido.",
  "Informe um CEP válido para calcular o frete.",
  "Carrinho vazio.",
  "Produto indisponível.",
  "Variação inválida.",
  "Não foi possível calcular o frete com os dados informados.",
  "Nenhuma opção de frete disponível para este CEP.",
  SHIPPING_UNAVAILABLE_MESSAGE,
]);

const productDataErrors = new Set(["Esse produto ainda precisa de peso e medidas para calcular o frete."]);

const internalConfigurationPatterns = [
  /^Configure /,
  /^Não foi possível autenticar no Melhor Envio/,
  /^MELHOR_ENVIO_/,
  /^Frete (Correios|Melhor Envio|Frenet) precisa/,
  /^Provider (Correios|Frenet) preparado/,
  /^Provedor de frete inválido\.$/,
];

export function isInternalShippingConfigurationError(message: string) {
  return internalConfigurationPatterns.some((pattern) => pattern.test(message));
}

/** Map a thrown shipping error to what the shopper may see. `log` is the server-side reason. */
export function toShopperShippingError(message: string): { message: string; status: 400 | 503; log: boolean } {
  if (productDataErrors.has(message)) return { message: SHIPPING_PRODUCT_DATA_MESSAGE, status: 400, log: true };
  if (message === SHIPPING_UNAVAILABLE_MESSAGE) return { message, status: 503, log: false };
  if (shopperShippingErrors.has(message)) return { message, status: 400, log: false };
  if (isInternalShippingConfigurationError(message)) return { message: SHIPPING_UNAVAILABLE_MESSAGE, status: 503, log: true };
  return { message: SHIPPING_UNAVAILABLE_MESSAGE, status: 503, log: true };
}
