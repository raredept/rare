import { Prisma, type Promotion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paidOrderStatuses } from "@/lib/coupons";
import { getEffectivePromotionStatus, type PromotionStatusValue } from "@/lib/promotions/engine";

export const PROMOTION_STATUS_LABELS: Record<PromotionStatusValue, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Programada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
};

export const PROMOTION_SCOPE_LABELS = {
  ALL_PRODUCTS: "Todos os produtos",
  SELECTED_PRODUCTS: "Produtos selecionados",
  SELECTED_CATEGORIES: "Categorias selecionadas",
} as const;

/** Prisma filter matching the EFFECTIVE status (what the storefront applies right now). */
export function effectiveStatusWhere(status: PromotionStatusValue, now: Date): Prisma.PromotionWhereInput {
  const live: Prisma.PromotionWhereInput = { status: { in: ["ACTIVE", "SCHEDULED"] } };
  switch (status) {
    case "DRAFT":
    case "PAUSED":
      return { status };
    case "ENDED":
      return { OR: [{ status: "ENDED" }, { AND: [live, { endsAt: { lte: now } }] }] };
    case "SCHEDULED":
      return { AND: [live, { startsAt: { gt: now } }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
    case "ACTIVE":
      return { AND: [live, { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
  }
}

type ActivationCandidate = Pick<Promotion, "value" | "type" | "scope" | "startsAt" | "endsAt" | "homepageFeatured" | "headline"> & {
  productCount: number;
  categoryCount: number;
};

/** Reasons a promotion cannot go live; empty when it can. */
export function getActivationIssues(promotion: ActivationCandidate, now: Date) {
  const issues: string[] = [];
  if (!promotion.value || promotion.value <= 0) issues.push("Defina o valor do desconto.");
  if (promotion.type === "PERCENTAGE" && promotion.value && promotion.value > 100) issues.push("Percentual acima de 100%.");
  if (promotion.scope === "SELECTED_PRODUCTS" && promotion.productCount === 0) issues.push("Selecione ao menos um produto.");
  if (promotion.scope === "SELECTED_CATEGORIES" && promotion.categoryCount === 0) issues.push("Selecione ao menos uma categoria.");
  if (promotion.startsAt && promotion.endsAt && promotion.endsAt <= promotion.startsAt) issues.push("O fim deve ser depois do início.");
  if (promotion.endsAt && promotion.endsAt <= now) issues.push("O fim da promoção já passou.");
  if (promotion.homepageFeatured && !promotion.headline) issues.push("Campanha em destaque na home precisa de um título.");
  return issues;
}

/** Number of active products a promotion targets (eligibility before price checks). */
export async function countTargetedProducts(promotion: Pick<Promotion, "id" | "scope">) {
  if (promotion.scope === "ALL_PRODUCTS") return prisma.product.count({ where: { active: true } });
  if (promotion.scope === "SELECTED_PRODUCTS") return prisma.promotionProduct.count({ where: { promotionId: promotion.id, product: { active: true } } });
  const categories = await prisma.promotionCategory.findMany({ where: { promotionId: promotion.id }, select: { categoryId: true } });
  const ids = categories.map((item) => item.categoryId);
  if (!ids.length) return 0;
  return prisma.product.count({ where: { active: true, OR: [{ categoryId: { in: ids } }, { subcategoryId: { in: ids } }] } });
}

export type PromotionSalesSummary = {
  orders: number;
  revenueInCents: number;
  discountInCents: number;
  itemsSold: number;
  topProducts: Array<{ title: string; quantity: number; revenueInCents: number }>;
};

/**
 * Real sales of items that carried this promotion, from the order snapshots of PAID orders only
 * (paid, processing, shipped, delivered). Revenue is the item value charged (after the promotion,
 * before an order-level coupon or shipping). No traffic or conversion is inferred.
 */
export async function getPromotionSalesSummary(promotionId: string): Promise<PromotionSalesSummary> {
  const statuses = Prisma.join(paidOrderStatuses.map((status) => Prisma.sql`${status}::"OrderStatus"`));
  const [totals] = await prisma.$queryRaw<Array<{ orders: bigint; revenue: bigint | null; discount: bigint | null; items: bigint | null }>>`
    SELECT COUNT(DISTINCT oi."orderId") AS orders,
           SUM(oi."totalInCents") AS revenue,
           SUM(oi."promotionDiscountInCents" * oi."quantity") AS discount,
           SUM(oi."quantity") AS items
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE oi."promotionId" = ${promotionId} AND o."status" IN (${statuses})
  `;
  const top = await prisma.$queryRaw<Array<{ title: string; quantity: bigint; revenue: bigint }>>`
    SELECT oi."productTitleSnapshot" AS title, SUM(oi."quantity") AS quantity, SUM(oi."totalInCents") AS revenue
    FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
    WHERE oi."promotionId" = ${promotionId} AND o."status" IN (${statuses})
    GROUP BY oi."productTitleSnapshot"
    ORDER BY quantity DESC, revenue DESC
    LIMIT 5
  `;
  return {
    orders: Number(totals?.orders ?? 0),
    revenueInCents: Number(totals?.revenue ?? 0),
    discountInCents: Number(totals?.discount ?? 0),
    itemsSold: Number(totals?.items ?? 0),
    topProducts: top.map((row) => ({ title: row.title, quantity: Number(row.quantity), revenueInCents: Number(row.revenue) })),
  };
}

export type PromotionDashboardSummary = {
  active: number;
  scheduled: number;
  endingSoon: Array<{ id: string; name: string; endsAt: Date }>;
  alerts: Array<{ id: string; name: string; kind: "no_products" | "expired_still_active" }>;
};

/** Operational card for the Admin dashboard. "Encerrando em breve" = within 48 hours. */
export async function getPromotionDashboardSummary(now = new Date()): Promise<PromotionDashboardSummary> {
  const live = await prisma.promotion.findMany({
    where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
    select: { id: true, name: true, status: true, scope: true, startsAt: true, endsAt: true, _count: { select: { products: true, categories: true } } },
    take: 200,
  });
  const summary: PromotionDashboardSummary = { active: 0, scheduled: 0, endingSoon: [], alerts: [] };
  for (const promotion of live) {
    const effective = getEffectivePromotionStatus(promotion, now);
    if (effective === "ACTIVE") summary.active += 1;
    if (effective === "SCHEDULED") summary.scheduled += 1;
    if (effective === "ENDED") summary.alerts.push({ id: promotion.id, name: promotion.name, kind: "expired_still_active" });
    if (effective === "ACTIVE" && promotion.endsAt && promotion.endsAt.getTime() - now.getTime() <= 48 * 3_600_000) {
      summary.endingSoon.push({ id: promotion.id, name: promotion.name, endsAt: promotion.endsAt });
    }
    const empty = (promotion.scope === "SELECTED_PRODUCTS" && promotion._count.products === 0) || (promotion.scope === "SELECTED_CATEGORIES" && promotion._count.categories === 0);
    if (effective !== "ENDED" && empty) summary.alerts.push({ id: promotion.id, name: promotion.name, kind: "no_products" });
  }
  return summary;
}
