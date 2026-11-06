// Pure promotion pricing. No I/O: the same function prices the catalog, the cart, the shipping
// quote and the checkout, so what the shopper sees is what the server charges. The server is the
// only source of truth; nothing the browser sends (price, discount, percentage, total) is used.

export type PromotionStatusValue = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED";
export type PromotionTypeValue = "PERCENTAGE" | "FIXED_AMOUNT";
export type PromotionScopeValue = "ALL_PRODUCTS" | "SELECTED_PRODUCTS" | "SELECTED_CATEGORIES";

export type PromotionRule = {
  id: string;
  name: string;
  slug: string;
  status: PromotionStatusValue;
  type: PromotionTypeValue;
  value: number | null;
  scope: PromotionScopeValue;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  createdAt: Date;
  badgeText: string | null;
  productIds: ReadonlySet<string>;
  categoryIds: ReadonlySet<string>;
};

export type PricingProduct = {
  id: string;
  priceInCents: number;
  categoryId: string | null;
  subcategoryId: string | null;
};

export type AppliedPromotion = {
  id: string;
  name: string;
  slug: string;
  badgeText: string | null;
  endsAt: Date | null;
};

export type ProductPrice = {
  basePriceInCents: number;
  finalPriceInCents: number;
  /** Per unit. */
  discountInCents: number;
  /** Rounded down for display ("-25%"); never derived from anything the client sends. */
  percentOff: number;
  promotion: AppliedPromotion | null;
};

/**
 * Smallest unit price a promotion may produce. A rule that would push a product below it simply
 * does not apply to that product (it is never clamped into a different discount than configured).
 */
export const MIN_PROMOTIONAL_PRICE_IN_CENTS = 100;

/** What the shopper experiences now, derived from the stored status and the dates. */
export function getEffectivePromotionStatus(
  rule: Pick<PromotionRule, "status" | "startsAt" | "endsAt">,
  now: Date,
): PromotionStatusValue {
  if (rule.status === "DRAFT" || rule.status === "PAUSED" || rule.status === "ENDED") return rule.status;
  if (rule.endsAt && now.getTime() >= rule.endsAt.getTime()) return "ENDED";
  if (rule.startsAt && now.getTime() < rule.startsAt.getTime()) return "SCHEDULED";
  return "ACTIVE";
}

export function isPromotionTargetingProduct(rule: PromotionRule, product: PricingProduct) {
  if (rule.scope === "ALL_PRODUCTS") return true;
  if (rule.scope === "SELECTED_PRODUCTS") return rule.productIds.has(product.id);
  return Boolean(
    (product.categoryId && rule.categoryIds.has(product.categoryId)) ||
      (product.subcategoryId && rule.categoryIds.has(product.subcategoryId)),
  );
}

/** Discount per unit, or null when the rule is unusable for this price. */
export function computePromotionDiscount(rule: Pick<PromotionRule, "type" | "value">, basePriceInCents: number) {
  if (!Number.isSafeInteger(basePriceInCents) || basePriceInCents <= 0) return null;
  const value = rule.value;
  if (value === null || !Number.isSafeInteger(value) || value <= 0) return null;
  let discount: number;
  if (rule.type === "PERCENTAGE") {
    if (value > 100) return null;
    discount = Math.floor((basePriceInCents * value) / 100);
  } else {
    discount = value;
  }
  if (discount <= 0) return null;
  if (basePriceInCents - discount < MIN_PROMOTIONAL_PRICE_IN_CENTS) return null;
  return discount;
}

/**
 * Stacking policy: exactly one automatic promotion per item. Among the rules that are active now,
 * target the product and produce a valid price, the winner is chosen deterministically:
 * priority DESC, then larger discount, then the older promotion, then id.
 */
export function selectPromotionForProduct(rules: readonly PromotionRule[], product: PricingProduct, now: Date) {
  let best: { rule: PromotionRule; discount: number } | null = null;
  for (const rule of rules) {
    if (getEffectivePromotionStatus(rule, now) !== "ACTIVE") continue;
    if (!isPromotionTargetingProduct(rule, product)) continue;
    const discount = computePromotionDiscount(rule, product.priceInCents);
    if (discount === null) continue;
    if (!best || compareCandidates({ rule, discount }, best) < 0) best = { rule, discount };
  }
  return best;
}

function compareCandidates(a: { rule: PromotionRule; discount: number }, b: { rule: PromotionRule; discount: number }) {
  if (a.rule.priority !== b.rule.priority) return b.rule.priority - a.rule.priority;
  if (a.discount !== b.discount) return b.discount - a.discount;
  const created = a.rule.createdAt.getTime() - b.rule.createdAt.getTime();
  if (created !== 0) return created;
  return a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0;
}

export function priceProduct(rules: readonly PromotionRule[], product: PricingProduct, now: Date): ProductPrice {
  const base = product.priceInCents;
  const selected = selectPromotionForProduct(rules, product, now);
  if (!selected) return { basePriceInCents: base, finalPriceInCents: base, discountInCents: 0, percentOff: 0, promotion: null };
  const final = base - selected.discount;
  return {
    basePriceInCents: base,
    finalPriceInCents: final,
    discountInCents: selected.discount,
    percentOff: Math.floor((selected.discount * 100) / base),
    promotion: {
      id: selected.rule.id,
      name: selected.rule.name,
      slug: selected.rule.slug,
      badgeText: selected.rule.badgeText,
      endsAt: selected.rule.endsAt,
    },
  };
}
