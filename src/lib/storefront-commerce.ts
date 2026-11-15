import { isCheckoutEnabled } from "@/lib/env";
import { getAvailableCheckoutMethods } from "@/lib/payment-provider-config";

export type StorefrontCommerceState = {
  checkoutEnabled: boolean;
  checkoutActionLabel: string;
  checkoutStatusTitle: string;
  checkoutStatusText: string;
  paymentTitle: string;
  paymentText: string;
};

// Payment copy describes only methods offered by the active provider.
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
  // Claim only the methods actually offered by the active gateway.
  const methods = getAvailableCheckoutMethods(env);
  return buildStorefrontCommerceState(isCheckoutEnabled(env), methods);
}
