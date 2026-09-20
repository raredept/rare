import { describe, expect, it } from "vitest";
import { SHIPPING_PRODUCT_DATA_MESSAGE, SHIPPING_UNAVAILABLE_MESSAGE, toShopperShippingError } from "@/lib/shipping-errors";

describe("toShopperShippingError", () => {
  it.each([
    "Não foi possível autenticar no Melhor Envio. Verifique o token.",
    "Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.",
    "Configure MELHOR_ENVIO_TOKEN ou finalize a autorização OAuth do Melhor Envio.",
    "Configure o CEP de origem da loja para calcular o frete.",
    "MELHOR_ENVIO_BASE_URL inválida.",
    "Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.",
    "Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.",
    "connect ECONNREFUSED 10.0.0.1:5432",
    "",
  ])("hides configuration and provider detail from shoppers: %s", (message) => {
    const result = toShopperShippingError(message);
    expect(result).toEqual({ message: SHIPPING_UNAVAILABLE_MESSAGE, status: 503, log: true });
  });

  it.each([
    "CEP de destino inválido.",
    "Nenhuma opção de frete disponível para este CEP.",
    "Não foi possível calcular o frete com os dados informados.",
    "Produto indisponível.",
    "Variação inválida.",
  ])("keeps an actionable client error: %s", (message) => {
    expect(toShopperShippingError(message)).toEqual({ message, status: 400, log: false });
  });

  it("replaces the catalog-data message with one that does not talk about product data", () => {
    expect(toShopperShippingError("Esse produto ainda precisa de peso e medidas para calcular o frete.")).toEqual({
      message: SHIPPING_PRODUCT_DATA_MESSAGE,
      status: 400,
      log: true,
    });
  });
});
