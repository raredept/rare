import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import {
  buildPackageFromCart,
  getConfiguredShippingOriginCep,
  getConfiguredShippingProvider,
  getEffectiveFreeShippingThresholdInCents,
  getShippingQuotes,
  isShippingEnabled,
  validateCep,
  type ShippingOption,
} from "@/lib/shipping";
import { checkoutItemSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const quoteRequestSchema = z.object({
  cep: z.string().trim().min(1).max(20),
  items: z.array(checkoutItemSchema).min(1).max(50),
});

const publicQuoteErrors = new Set([
  "CEP de destino inválido.",
  "Carrinho vazio.",
  "Produto indisponível.",
  "Variação inválida.",
  "Esse produto ainda precisa de peso e medidas para calcular o frete.",
  "Configure o CEP de origem da loja para calcular o frete.",
  "Provedor de frete inválido.",
  "Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.",
  "Frete Melhor Envio precisa de MELHOR_ENVIO_TOKEN configurado.",
  "Frete Frenet precisa de FRENET_TOKEN configurado.",
  "Provider Correios preparado, mas a integração externa ainda não está ativada nesta versão.",
  "Provider Melhor Envio preparado, mas a integração externa ainda não está ativada nesta versão.",
  "Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.",
]);

function consolidateItems(items: z.infer<typeof checkoutItemSchema>[]) {
  const byVariant = new Map<string, z.infer<typeof checkoutItemSchema>>();
  for (const item of items) {
    const current = byVariant.get(item.variantId);
    if (current) {
      current.quantity += item.quantity;
    } else {
      byVariant.set(item.variantId, { ...item });
    }
  }
  return [...byVariant.values()];
}

function toPublicOption(option: ShippingOption) {
  return {
    id: option.id,
    provider: option.provider,
    service: option.service,
    label: option.label,
    amountCents: option.amountCents,
    estimatedDaysMin: option.estimatedDaysMin,
    estimatedDaysMax: option.estimatedDaysMax,
    deliveryEstimateText: option.deliveryEstimateText,
    originCep: option.originCep,
    destinationCep: option.destinationCep,
    expiresAt: option.expiresAt,
  };
}

function getSafeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown shipping quote error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted-token]");
}

function getPublicError(error: unknown) {
  if (error instanceof SyntaxError || error instanceof ZodError) {
    return { message: "Revise os dados para calcular o frete.", status: 400 };
  }

  if (error instanceof Error && publicQuoteErrors.has(error.message)) {
    const status = error.message.startsWith("Frete ") || error.message.startsWith("Provider ") ? 503 : 400;
    return { message: error.message, status };
  }

  return { message: "Frete indisponível no momento. Tente novamente em alguns minutos.", status: 503 };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`shipping-quote:${ip}`, 60, 60_000);

  if (!limit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  try {
    const body = quoteRequestSchema.parse(await request.json());
    const settings = await getStoreSettings();

    if (!isShippingEnabled(settings)) {
      return NextResponse.json({
        options: [],
        disabled: true,
        message: "Frete automático desativado; entrega combinada manualmente.",
      });
    }

    const destinationCep = validateCep(body.cep, "CEP de destino");
    const items = consolidateItems(body.items);
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: items.map((item) => item.variantId) },
      },
      include: {
        product: true,
      },
    });
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    let subtotalInCents = 0;
    const packageItems = items.map((item) => {
      const variant = variantsById.get(item.variantId);
      if (!variant) {
        throw new Error("Variação inválida.");
      }

      if (variant.productId !== item.productId || !variant.active || !variant.product.active) {
        throw new Error("Produto indisponível.");
      }

      subtotalInCents += variant.product.priceInCents * item.quantity;

      return {
        productId: variant.productId,
        title: variant.product.title,
        quantity: item.quantity,
        weightGrams: variant.product.weightGrams,
        lengthCm: variant.product.lengthCm,
        widthCm: variant.product.widthCm,
        heightCm: variant.product.heightCm,
      };
    });

    const pkg = buildPackageFromCart(packageItems);
    const provider = getConfiguredShippingProvider(settings);
    const originCep = getConfiguredShippingOriginCep(settings);
    const result = await getShippingQuotes({
      provider,
      originCep,
      destinationCep,
      package: pkg,
      subtotalInCents,
      freeShippingThresholdInCents: getEffectiveFreeShippingThresholdInCents(settings),
    });

    return NextResponse.json({
      options: result.options.map(toPublicOption),
      warnings: result.warnings,
    });
  } catch (error) {
    const publicError = getPublicError(error);
    if (publicError.status >= 500) {
      console.error("[shipping-quote] failed", { message: getSafeLogMessage(error) });
    }
    return NextResponse.json({ error: publicError.message }, { status: publicError.status });
  }
}
