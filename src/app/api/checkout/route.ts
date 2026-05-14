import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createCheckoutSession } from "@/lib/checkout";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { isCheckoutEnabled } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicCheckoutErrors = new Set([
  "Produto indisponivel.",
  "Estoque insuficiente para finalizar este carrinho.",
  "Variacao invalida.",
  "Informe um CEP valido para entrega.",
  "Endereco de entrega invalido.",
  "Selecione um endereco de entrega.",
  "Informe seus dados de contato para finalizar.",
  "Informe o endereco de entrega.",
  "Frete real ainda nao esta integrado. Use frete manual, fixo ou desativado nas configuracoes.",
]);

function getPublicCheckoutError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof ZodError) {
    return { message: "Revise os dados do checkout.", status: 400 };
  }

  if (error instanceof Error && publicCheckoutErrors.has(error.message)) {
    return { message: error.message, status: 400 };
  }

  return {
    message: "Checkout temporariamente indisponivel. Tente novamente em alguns minutos.",
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
    return NextResponse.json({ error: "Checkout temporariamente indisponivel." }, { status: 503 });
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
