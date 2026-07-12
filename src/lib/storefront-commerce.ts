import { isCheckoutEnabled } from "@/lib/env";

export type StorefrontCommerceState = {
  checkoutEnabled: boolean;
  checkoutActionLabel: string;
  checkoutStatusTitle: string;
  checkoutStatusText: string;
  paymentTitle: string;
  paymentText: string;
};

export function buildStorefrontCommerceState(checkoutEnabled: boolean): StorefrontCommerceState {
  if (checkoutEnabled) {
    return {
      checkoutEnabled: true,
      checkoutActionLabel: "Finalizar compra",
      checkoutStatusTitle: "Compra segura",
      checkoutStatusText: "Ambiente protegido para revisar e concluir seu pedido.",
      paymentTitle: "Pix e cartão",
      paymentText: "Pagamento por Pix ou cartão no checkout da loja.",
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
  return buildStorefrontCommerceState(isCheckoutEnabled(env));
}
