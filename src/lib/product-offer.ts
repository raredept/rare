import type { ProductPrice } from "@/lib/promotions/engine";
import { getProductMediaExtension, getProductMediaTypeFromUrl } from "@/lib/product-media";
import { isVariantPurchasable } from "@/lib/stock";

/**
 * RARE-SEO-GOOGLE-01 — ONE description of what a product page offers, shared by the Product /
 * ProductGroup JSON-LD and the Google Merchant Center feed, so the two can never disagree with each
 * other or with the storefront (title, price, availability, brand, image, link).
 *
 * Every value comes from data the page already renders:
 * - price = `pricing.finalPriceInCents` (automatic promotion applied by the promotions engine, only
 *   READ here). Coupons, shipping and card-installment surcharges are never part of it.
 * - the strikethrough (base) price only exists while a real promotion discounts the product — the
 *   page shows it struck through (PriceTag).
 * - a sale end date only exists when the promotion has `endsAt`; nothing is invented otherwise.
 * - availability per size = the same purchasable rule as the cart (active, stock - reserved > 0).
 * No colour, gender, age group, GTIN, MPN or condition is produced: the catalog does not store them.
 */

export type OfferSourceCategory = { name: string; slug: string; active?: boolean } | null | undefined;

export type OfferSourceProduct = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  brand?: string | null;
  category?: OfferSourceCategory;
  subcategory?: OfferSourceCategory;
  images: Array<{ url: string; alt?: string | null }>;
  variants: Array<{ id: string; size: string; sku?: string | null; stock: number; reservedStock: number; active: boolean }>;
  pricing: ProductPrice;
};

export type ProductOfferVariant = {
  id: string;
  size: string;
  sku: string | null;
  inStock: boolean;
  /** Landing URL of this size (`?size=` preselects it on the product page). */
  url: string;
};

export type ProductOfferSnapshot = {
  productId: string;
  slug: string;
  name: string;
  description: string;
  brand: string | null;
  /** Real taxonomy (category > subcategory); promotional categories are left out. */
  categoryPath: string[];
  url: string;
  /** Product media for structured data (videos excluded — same rule as before this cycle), absolute. */
  imageUrls: string[];
  /** Images Merchant Center accepts (JPEG, PNG, WebP), absolute. */
  feedImageUrls: string[];
  /** What the shopper pays now. */
  priceInCents: number;
  /** Catalog price; differs from priceInCents only while a promotion discounts the product. */
  basePriceInCents: number;
  onSale: boolean;
  /** YYYY-MM-DD (America/Sao_Paulo) of the last day of the promotional price, when the promotion has an end. */
  saleLastDay: string | null;
  checkoutEnabled: boolean;
  inStock: boolean;
  /** More than one active size: published as ProductGroup / item_group_id. */
  isVariantGroup: boolean;
  variants: ProductOfferVariant[];
};

const PROMOTIONAL_CATEGORY_SLUG = /(^|-)(sale|black|blackfriday|promo|promocao|promocoes|oferta|ofertas|liquida|liquidacao|outlet|desconto|descontos)(-|$)/;
const FEED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function clean(value: string | null | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || null;
}

export function isPromotionalCategorySlug(slug: string) {
  return PROMOTIONAL_CATEGORY_SLUG.test(slug.toLowerCase());
}

export function getProductCategoryPath(product: Pick<OfferSourceProduct, "category" | "subcategory">) {
  const path: string[] = [];
  for (const category of [product.category, product.subcategory]) {
    if (!category || category.active === false || isPromotionalCategorySlug(category.slug)) continue;
    const name = clean(category.name);
    if (name && !path.includes(name)) path.push(name);
  }
  return path;
}

function toAbsoluteUrl(siteUrl: string, url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** The last calendar day (São Paulo) on which a price ending at `endsAt` (exclusive) still applies. */
export function getLastValidDay(endsAt: Date | null | undefined) {
  if (!endsAt || Number.isNaN(endsAt.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(endsAt.getTime() - 1));
}

export function getVariantUrl(productUrl: string, size: string) {
  return `${productUrl}?size=${encodeURIComponent(size)}`;
}

export function buildProductOfferSnapshot(
  product: OfferSourceProduct,
  options: { siteUrl: string; checkoutEnabled: boolean },
): ProductOfferSnapshot {
  const url = `${options.siteUrl}/produto/${encodeURIComponent(product.slug)}`;
  const activeVariants = product.variants.filter((variant) => variant.active);
  const isVariantGroup = activeVariants.length > 1;
  const variants = activeVariants.map((variant) => ({
    id: variant.id,
    size: variant.size,
    sku: clean(variant.sku),
    inStock: isVariantPurchasable(variant),
    url: isVariantGroup ? getVariantUrl(url, variant.size) : url,
  }));
  const mediaUrls = product.images.map((image) => image.url.trim()).filter(Boolean);
  const imageUrls = mediaUrls
    .filter((mediaUrl) => getProductMediaTypeFromUrl(mediaUrl) !== "video")
    .map((mediaUrl) => toAbsoluteUrl(options.siteUrl, mediaUrl));
  const feedImageUrls = mediaUrls
    .filter((mediaUrl) => FEED_IMAGE_EXTENSIONS.has(getProductMediaExtension(mediaUrl)))
    .map((mediaUrl) => toAbsoluteUrl(options.siteUrl, mediaUrl));
  const onSale = Boolean(product.pricing.promotion) && product.pricing.discountInCents > 0
    && product.pricing.finalPriceInCents < product.pricing.basePriceInCents;

  return {
    productId: product.id,
    slug: product.slug,
    name: clean(product.title) ?? product.slug,
    description: clean(product.description) ?? clean(product.shortDescription) ?? clean(product.title) ?? product.slug,
    brand: clean(product.brand),
    categoryPath: getProductCategoryPath(product),
    url,
    imageUrls,
    feedImageUrls,
    priceInCents: product.pricing.finalPriceInCents,
    basePriceInCents: onSale ? product.pricing.basePriceInCents : product.pricing.finalPriceInCents,
    onSale,
    saleLastDay: onSale ? getLastValidDay(product.pricing.promotion?.endsAt) : null,
    checkoutEnabled: options.checkoutEnabled,
    inStock: variants.some((variant) => variant.inStock),
    isVariantGroup,
    variants,
  };
}

/** Display name of one size, shared by the ProductGroup variant and the feed item title. */
export function getVariantDisplayName(snapshot: Pick<ProductOfferSnapshot, "name" | "isVariantGroup">, size: string) {
  return snapshot.isVariantGroup ? `${snapshot.name} - Tamanho ${size}` : snapshot.name;
}

export function formatCentsAsDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}
