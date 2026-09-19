import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { checkoutRequiresCpfMessage, checkoutRequiresLoginMessage, createCheckoutSession } from "@/lib/checkout";
import { getClientIp } from "@/lib/client-ip";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { isValidCpf } from "@/lib/cpf";
import { getStripeSecretKey, isCheckoutEnabled } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { isInternalShippingConfigurationError, shopperShippingErrors, toShopperShippingError } from "@/lib/shipping-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicCheckoutErrors = new Set([
  checkoutRequiresLoginMessage,
  checkoutRequiresCpfMessage,
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
]);

const checkoutUnavailableMessage =
  "Checkout temporariamente indisponível. Fale com a RARE para concluir seu pedido por enquanto.";

function getPublicCheckoutError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof ZodError) {
    return { message: "Revise os dados do checkout.", status: 400, log: false };
  }

  if (error instanceof Error && publicCheckoutErrors.has(error.message)) {
    return { message: error.message, status: error.message === checkoutRequiresLoginMessage ? 401 : 400, log: false };
  }

  if (error instanceof Error) {
    const shipping = toShopperShippingError(error.message);
    if (shopperShippingErrors.has(error.message) || isInternalShippingConfigurationError(error.message) || error.message.startsWith("Esse produto ainda precisa")) {
      return shipping;
    }
  }

  return {
    message: "Checkout temporariamente indisponível. Tente novamente em alguns minutos.",
    status: 503,
    log: true,
  };
}

function getSafeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown checkout error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:sk|rk)_(live|test)_[A-Za-z0-9_]+/g, "stripe_$1_[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9_]+/g, "whsec_[redacted]");
}

export async function POST(request: NextRequest) {
  if (!isCheckoutEnabled()) {
    return NextResponse.json({ error: checkoutUnavailableMessage }, { status: 503 });
  }

  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`checkout:${ip}`, 20, 60_000);

  if (!limit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: checkoutRequiresLoginMessage }, { status: 401 });
  }

  // Every session creation reserves stock for the checkout window. An identity
  // based ceiling keeps one account from hoarding inventory by looping requests.
  const customerLimit = await rateLimit(`checkout-customer:${customer.id}`, 6, 10 * 60_000);
  if (!customerLimit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  if (!isValidCpf(customer.cpf)) {
    return NextResponse.json({ error: checkoutRequiresCpfMessage }, { status: 400 });
  }

  try {
    getStripeSecretKey();
  } catch {
    return NextResponse.json({ error: checkoutUnavailableMessage }, { status: 503 });
  }

  try {
    const body = await request.json();
    const session = await createCheckoutSession(body, { customerId: customer.id });
    return NextResponse.json(session);
  } catch (error) {
    const publicError = getPublicCheckoutError(error);
    if (publicError.log) {
      console.error("[checkout] session creation failed", { message: getSafeLogMessage(error) });
    }
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
