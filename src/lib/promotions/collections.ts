import { getEffectivePromotionStatus, type PromotionStatusValue } from "@/lib/promotions/engine";

/**
 * Storefront collections (RARE-COLLECTIONS-CART-01). A collection is a PROMOTION also shown as a
 * public selection — "SALE BLACK", "Drop especial" — at /colecao/<promotion slug> and in the store
 * menu. Categories stay the taxonomy (Camisetas, Jaquetas...): joining or leaving a collection never
 * changes Product.categoryId / subcategoryId. Pure helpers only; the queries live in storefront.ts.
 */

export const COLLECTION_LABEL_MAX_LENGTH = 40;
export const COLLECTION_SORT_ORDER_MIN = 0;
export const COLLECTION_SORT_ORDER_MAX = 999;
/** The same pattern the promotion code (slug) is built with: lowercase, digits and dashes. */
const COLLECTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CollectionSource = {
  id: string;
  name: string;
  slug: string;
  storefrontCollectionLabel: string | null;
  storefrontCollectionSortOrder: number;
};

export type NavigationCollection = { id: string; label: string; slug: string; href: string; sortOrder: number };

export function isCollectionSlug(value: string) {
  return value.length <= 80 && COLLECTION_SLUG_PATTERN.test(value);
}

/** Menu / page title: the label when filled, otherwise the promotion name (never an empty link). */
export function getCollectionLabel(promotion: Pick<CollectionSource, "name" | "storefrontCollectionLabel">) {
  return promotion.storefrontCollectionLabel?.trim() || promotion.name.trim();
}

export function getCollectionHref(slug: string) {
  return `/colecao/${encodeURIComponent(slug)}`;
}

/** Case/spacing-insensitive key, so "SALE BLACK" and "Sale  black" count as the same menu entry. */
export function getCollectionLabelKey(label: string) {
  return label.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Deterministic menu order: sort order, then label, then id. */
export function compareCollections(a: NavigationCollection, b: NavigationCollection) {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function toNavigationCollection(promotion: CollectionSource): NavigationCollection {
  return {
    id: promotion.id,
    label: getCollectionLabel(promotion),
    slug: promotion.slug,
    href: getCollectionHref(promotion.slug),
    sortOrder: promotion.storefrontCollectionSortOrder,
  };
}

/**
 * Whether the collection may be public right now, BEFORE looking at its products: the flag is on,
 * it has a discount and its EFFECTIVE status (dates included) is ACTIVE. A SCHEDULED promotion before
 * its start, a PAUSED or ENDED one, or a DRAFT never shows. The caller still requires >= 1 product
 * whose winning promotion is this one.
 */
export function isCollectionLive(
  promotion: { storefrontCollectionEnabled: boolean; value: number | null; status: PromotionStatusValue; startsAt: Date | null; endsAt: Date | null },
  now: Date,
) {
  return promotion.storefrontCollectionEnabled && promotion.value !== null && getEffectivePromotionStatus(promotion, now) === "ACTIVE";
}

/** Page description from the promotion's own copy (subheadline, then headline); null when there is none. */
export function getCollectionDescription(promotion: { subheadline: string | null; headline: string | null }) {
  return promotion.subheadline?.trim() || promotion.headline?.trim() || null;
}
