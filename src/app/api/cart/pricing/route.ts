import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { priceProduct } from "@/lib/promotions/engine";
import { loadApplicablePromotionRules } from "@/lib/promotions/store";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Current server price of the variants in a cart, so the cart displays what the checkout will
// charge. Read-only and public data (the same prices the catalog shows); it charges nothing and
// accepts no price from the client.

const requestSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1).max(40), variantId: z.string().min(1).max(40) })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const limit = await rateLimit(`cart-pricing:${getClientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: parsed.items.map((item) => item.variantId) } },
    select: { id: true, productId: true, product: { select: { id: true, priceInCents: true, categoryId: true, subcategoryId: true, active: true } } },
  });
  const now = new Date();
  const rules = await loadApplicablePromotionRules(prisma, now);
  const prices: Record<string, { priceInCents: number; basePriceInCents: number; promotional: boolean }> = {};
  for (const item of parsed.items) {
    const variant = variants.find((candidate) => candidate.id === item.variantId && candidate.productId === item.productId);
    if (!variant || !variant.product.active) continue;
    const price = priceProduct(rules, variant.product, now);
    prices[variant.id] = { priceInCents: price.finalPriceInCents, basePriceInCents: price.basePriceInCents, promotional: Boolean(price.promotion) };
  }
  return NextResponse.json({ prices }, { headers: { "cache-control": "no-store" } });
}
