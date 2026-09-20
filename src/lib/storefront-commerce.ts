import { isCheckoutEnabled } from "@/lib/env";

export type StorefrontCommerceState = {
  checkoutEnabled: boolean;
  checkoutActionLabel: string;
  checkoutStatusTitle: string;
  checkoutStatusText: string;
  paymentTitle: string;
  paymentText: string;
};

// Payment copy must match what Stripe will actually offer. Only claim Pix when it is
// explicitly enabled; when the methods are managed in the Dashboard, stay generic.
function getPaymentCopy(paymentMethods?: readonly string[]) {
  const methods = new Set((paymentMethods ?? []).map((method) => method.trim().toLowerCase()).filter(Boolean));
  if (methods.has("pix") && methods.has("card")) return { title: "Pix e cartão", text: "Pagamento por Pix ou cartão no checkout da loja." };
  if (methods.has("pix")) return { title: "Pix", text: "Pagamento por Pix no checkout da loja." };
  if (methods.has("card")) return { title: "Cartão", text: "Pagamento por cartão no checkout da loja." };
  return { title: "Pagamento seguro", text: "Pagamento no checkout seguro da loja." };
}

export function buildStorefrontCommerceState(checkoutEnabled: boolean, paymentMethods?: readonly string[]): StorefrontCommerceState {
  if (checkoutEnabled) {
    const payment = getPaymentCopy(paymentMethods);
    return {
      checkoutEnabled: true,
      checkoutActionLabel: "Finalizar compra",
      checkoutStatusTitle: "Compra segura",
      checkoutStatusText: "Ambiente protegido para revisar e concluir seu pedido.",
      paymentTitle: payment.title,
      paymentText: payment.text,
    };
  }

  return {
    checkoutEnabled: false,
    checkoutActionLabel: "Compras temporariamente pausadas",
    checkoutStatusTitle: "Catálogo disponível",
    checkoutStatusText: "Explore as peças e fale com a RARE para consultar disponibilidade.",
    paymentTitle: "Compras pausadas",
    paymentText: "O checkout está pausado. Nenhum pagamento será solicitado pela loja agora.",
  };
}

export function getStorefrontCommerceState(
  env: Record<string, string | undefined> = process.env,
): StorefrontCommerceState {
  return buildStorefrontCommerceState(isCheckoutEnabled(env), env.STRIPE_PAYMENT_METHOD_TYPES?.split(","));
}
