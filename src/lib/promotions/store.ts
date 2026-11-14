import type { Prisma, PrismaClient, Promotion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isHomepageCampaignEnabled, isPromotionsEnabled } from "@/lib/feature-flags";
import { getEffectivePromotionStatus, priceProduct, type PricingProduct, type ProductPrice, type PromotionRule } from "@/lib/promotions/engine";

type PromotionReader = Pick<PrismaClient, "promotion"> | Prisma.TransactionClient;

const ruleInclude = {
  products: { select: { productId: true } },
  categories: { select: { categoryId: true } },
} satisfies Prisma.PromotionInclude;

type PromotionWithTargets = Prisma.PromotionGetPayload<{ include: typeof ruleInclude }>;

export function toPromotionRule(promotion: PromotionWithTargets): PromotionRule {
  return {
    id: promotion.id,
    name: promotion.name,
    slug: promotion.slug,
    status: promotion.status,
    type: promotion.type,
    value: promotion.value,
    scope: promotion.scope,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    priority: promotion.priority,
    createdAt: promotion.createdAt,
    badgeText: promotion.badgeText,
    productIds: new Set(promotion.products.map((item) => item.productId)),
    categoryIds: new Set(promotion.categories.map((item) => item.categoryId)),
  };
}

/**
 * Promotions that can apply at `now`. The date filter runs in the database AND again in the
 * engine, so a promotion starts/ends exactly at its instant whatever is cached around it.
 */
export async function loadApplicablePromotionRules(client: PromotionReader = prisma, now = new Date()) {
  if (!isPromotionsEnabled()) return [];
  const promotions = await client.promotion.findMany({
    where: {
      status: { in: ["ACTIVE", "SCHEDULED"] },
      value: { not: null },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    include: ruleInclude,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return promotions.map(toPromotionRule).filter((rule) => getEffectivePromotionStatus(rule, now) === "ACTIVE");
}

export type PricedCatalogProduct<T> = T & { pricing: ProductPrice };

export async function withPromotionPricing<T extends PricingProduct>(products: readonly T[], now = new Date(), client?: PromotionReader) {
  if (!products.length) return [] as PricedCatalogProduct<T>[];
  const rules = await loadApplicablePromotionRules(client, now);
  return products.map((product) => ({ ...product, pricing: priceProduct(rules, product, now) }));
}

export type HomepageCampaign = Pick<
  Promotion,
  "id" | "name" | "slug" | "type" | "value" | "startsAt" | "endsAt" | "badgeText" | "headline" | "subheadline" | "ctaLabel" | "ctaHref" | "bannerImageUrl" | "bannerMobileImageUrl" | "bannerAlt"
>;

const campaignSelect = {
  id: true, name: true, slug: true, type: true, value: true, startsAt: true, endsAt: true, badgeText: true,
  headline: true, subheadline: true, ctaLabel: true, ctaHref: true, bannerImageUrl: true, bannerMobileImageUrl: true, bannerAlt: true,
  status: true, priority: true, createdAt: true,
} satisfies Prisma.PromotionSelect;

/** The ACTIVE + homepageFeatured campaign with the highest priority, or null. */
export async function getHomepageCampaign(now = new Date(), client: PromotionReader = prisma): Promise<HomepageCampaign | null> {
  if (!isHomepageCampaignEnabled()) return null;
  const candidates = await client.promotion.findMany({
    where: {
      homepageFeatured: true,
      status: { in: ["ACTIVE", "SCHEDULED"] },
      value: { not: null },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    select: campaignSelect,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 5,
  });
  const active = candidates.find((candidate) => getEffectivePromotionStatus(candidate, now) === "ACTIVE");
  return active ?? null;
}
