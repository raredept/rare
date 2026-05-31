import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createCheckoutSession } from "@/lib/checkout";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getStripeSecretKey, isCheckoutEnabled } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicCheckoutErrors = new Set([
  "Produto indisponível.",
  "Estoque insuficiente para finalizar este carrinho.",
  "Variação inválida.",
  "Informe um CEP válido para entrega.",
  "CEP de destino inválido.",
  "Carrinho vazio.",
  "Endereço de entrega inválido.",
  "Selecione um endereço de entrega.",
  "Informe seus dados de contato para finalizar.",
  "Informe o endereço de entrega.",
  "Escolha uma opção de entrega para continuar.",
  "Escolha uma opção de entrega válida para continuar.",
  "Esse produto ainda precisa de peso e medidas para calcular o frete.",
  "Configure o CEP de origem da loja para calcular o frete.",
  "Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.",
  "Configure MELHOR_ENVIO_TOKEN ou finalize a autorização OAuth do Melhor Envio.",
  "Informe um CEP válido para calcular o frete.",
  "Não foi possível autenticar no Melhor Envio. Verifique o token.",
  "Não foi possível calcular o frete com os dados informados.",
  "Nenhuma opção de frete disponível para este CEP.",
  "Frete indisponível no momento. Tente novamente em alguns instantes.",
  "Provedor de frete inválido.",
  "Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.",
  "Frete Melhor Envio precisa de MELHOR_ENVIO_TOKEN configurado.",
  "Frete Frenet precisa de FRENET_TOKEN configurado.",
  "Configure um valor de frete fixo para habilitar o checkout.",
  "Provider Correios preparado, mas a integração externa ainda não está ativada nesta versão.",
  "Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.",
]);

const checkoutUnavailableMessage =
  "Checkout temporariamente indisponível. Fale com a RARE para concluir seu pedido por enquanto.";

const serviceUnavailableCheckoutErrors = new Set([
  "Configure o CEP de origem da loja para calcular o frete.",
  "Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.",
  "Configure MELHOR_ENVIO_TOKEN ou finalize a autorização OAuth do Melhor Envio.",
  "Não foi possível autenticar no Melhor Envio. Verifique o token.",
  "Frete indisponível no momento. Tente novamente em alguns instantes.",
  "Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.",
  "Frete Melhor Envio precisa de MELHOR_ENVIO_TOKEN configurado.",
  "Frete Frenet precisa de FRENET_TOKEN configurado.",
  "Configure um valor de frete fixo para habilitar o checkout.",
  "Provider Correios preparado, mas a integração externa ainda não está ativada nesta versão.",
  "Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.",
]);

function getPublicCheckoutError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof ZodError) {
    return { message: "Revise os dados do checkout.", status: 400 };
  }

  if (error instanceof Error && publicCheckoutErrors.has(error.message)) {
    const status = serviceUnavailableCheckoutErrors.has(error.message) ? 503 : 400;
    return { message: error.message, status };
  }

  return {
    message: "Checkout temporariamente indisponível. Tente novamente em alguns minutos.",
    status: 503,
  };
}

function getSafeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown checkout error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\bsk_(live|test)_[A-Za-z0-9_]+/g, "sk_$1_[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9_]+/g, "whsec_[redacted]");
}

export async function POST(request: NextRequest) {
  if (!isCheckoutEnabled()) {
    return NextResponse.json({ error: checkoutUnavailableMessage }, { status: 503 });
  }

  try {
    getStripeSecretKey();
  } catch {
    return NextResponse.json({ error: checkoutUnavailableMessage }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`checkout:${ip}`, 20, 60_000);

  if (!limit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const customer = await getCurrentCustomer();
    const session = await createCheckoutSession(body, { customerId: customer?.id });
    return NextResponse.json(session);
  } catch (error) {
    const publicError = getPublicCheckoutError(error);
    if (publicError.status >= 500) {
      console.error("[checkout] session creation failed", { message: getSafeLogMessage(error) });
    }
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
