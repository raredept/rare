import {
  formatCentsAsDecimal,
  getVariantDisplayName,
  type ProductOfferSnapshot,
} from "@/lib/product-offer";

/**
 * RARE-SEO-GOOGLE-01 — Google Merchant Center product feed (RSS 2.0 + `g:` namespace), served at
 * /feeds/google-products.xml and fetched by a Merchant Center "scheduled fetch" file data source.
 * The Content API for Shopping is NOT used (sunset 2026-08-18); a later move to the Merchant API can
 * reuse `buildGoogleMerchantFeedItems` unchanged.
 *
 * One item per active size (`item_group_id` = product id when there are several sizes), built from
 * the same `ProductOfferSnapshot` as the page JSON-LD, so title, price, availability, brand, image
 * and link always match the storefront. Only public catalog data is exported: no stock quantity,
 * cost, supplier, internal note or customer data.
 *
 * Attributes the catalog does not store are NOT invented (MERCHANT_ATTRIBUTE_GAPS): color, gender
 * and age_group (required by Google for apparel targeted to Brazil), GTIN/MPN, condition and
 * google_product_category. See docs/cycles/RARE_SEO_GOOGLE_01.md.
 */

export const GOOGLE_MERCHANT_FEED_PATH = "/feeds/google-products.xml";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const BRAND_MAX = 70;
const PRODUCT_TYPE_MAX = 750;
const ID_MAX = 50;
const ADDITIONAL_IMAGES_MAX = 10;
const ONE_SIZE = /^(u|un|unico|único|tamanho unico|tamanho único|one size|os)$/i;

export type GoogleMerchantAvailability = "in_stock" | "out_of_stock";

export type GoogleMerchantFeedItem = {
  id: string;
  itemGroupId: string | null;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: GoogleMerchantAvailability;
  /** "199.90 BRL" — the catalog price (the non-sale price while a promotion applies). */
  price: string;
  /** "179.91 BRL" — present only while a real promotion discounts the product. */
  salePrice: string | null;
  brand: string | null;
  productType: string | null;
  size: string | null;
};

export type GoogleMerchantFeedExclusion = { productId: string; slug: string; reason: "no-feed-image" | "no-active-variant" | "invalid-price" };

export type GoogleMerchantFeed = {
  items: GoogleMerchantFeedItem[];
  exclusions: GoogleMerchantFeedExclusion[];
  productsExported: number;
};

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function formatPrice(cents: number) {
  return `${formatCentsAsDecimal(cents)} BRL`;
}

/**
 * Merchant availability of one size. A size can be in stock while online checkout is paused; it
 * cannot be bought then, so it is exported as out_of_stock (the page JSON-LD omits availability in
 * that state and never claims InStock).
 */
export function getMerchantAvailability(inStock: boolean, checkoutEnabled: boolean): GoogleMerchantAvailability {
  return inStock && checkoutEnabled ? "in_stock" : "out_of_stock";
}

export function buildGoogleMerchantFeedItems(snapshots: ProductOfferSnapshot[]): GoogleMerchantFeed {
  const items: GoogleMerchantFeedItem[] = [];
  const exclusions: GoogleMerchantFeedExclusion[] = [];
  let productsExported = 0;

  for (const snapshot of snapshots) {
    const exclude = (reason: GoogleMerchantFeedExclusion["reason"]) => exclusions.push({ productId: snapshot.productId, slug: snapshot.slug, reason });
    if (!snapshot.variants.length) { exclude("no-active-variant"); continue; }
    if (!snapshot.feedImageUrls.length) { exclude("no-feed-image"); continue; }
    if (!Number.isSafeInteger(snapshot.priceInCents) || snapshot.priceInCents <= 0) { exclude("invalid-price"); continue; }

    productsExported += 1;
    const [imageLink, ...otherImages] = snapshot.feedImageUrls;
    for (const variant of snapshot.variants) {
      items.push({
        id: variant.id.slice(0, ID_MAX),
        itemGroupId: snapshot.isVariantGroup ? snapshot.productId.slice(0, ID_MAX) : null,
        title: truncate(getVariantDisplayName(snapshot, variant.size), TITLE_MAX),
        description: truncate(snapshot.description, DESCRIPTION_MAX),
        link: variant.url,
        imageLink: imageLink!,
        additionalImageLinks: otherImages.slice(0, ADDITIONAL_IMAGES_MAX),
        availability: getMerchantAvailability(variant.inStock, snapshot.checkoutEnabled),
        price: formatPrice(snapshot.onSale ? snapshot.basePriceInCents : snapshot.priceInCents),
        salePrice: snapshot.onSale ? formatPrice(snapshot.priceInCents) : null,
        brand: snapshot.brand ? truncate(snapshot.brand, BRAND_MAX) : null,
        productType: snapshot.categoryPath.length ? truncate(snapshot.categoryPath.join(" > "), PRODUCT_TYPE_MAX) : null,
        size: snapshot.isVariantGroup || !ONE_SIZE.test(variant.size.trim()) ? variant.size : null,
      });
    }
  }

  return { items, exclusions, productsExported };
}

// XML 1.0 forbids most control characters; they are dropped, then the five entities are escaped.
function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(name: string, value: string | null | undefined) {
  return value ? `      <${name}>${escapeXml(value)}</${name}>\n` : "";
}

export function renderGoogleMerchantFeedXml(items: GoogleMerchantFeedItem[], channel: { siteUrl: string; title?: string; description?: string }) {
  const body = items.map((item) => [
    "    <item>\n",
    tag("g:id", item.id),
    tag("g:item_group_id", item.itemGroupId),
    tag("g:title", item.title),
    tag("g:description", item.description),
    tag("g:link", item.link),
    tag("g:image_link", item.imageLink),
    ...item.additionalImageLinks.map((link) => tag("g:additional_image_link", link)),
    tag("g:availability", item.availability),
    tag("g:price", item.price),
    tag("g:sale_price", item.salePrice),
    tag("g:brand", item.brand),
    tag("g:product_type", item.productType),
    tag("g:size", item.size),
    "    </item>\n",
  ].join("")).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(channel.title ?? "RARE")}</title>
    <link>${escapeXml(channel.siteUrl)}</link>
    <description>${escapeXml(channel.description ?? "Catálogo RARE para o Google Merchant Center")}</description>
${body}  </channel>
</rss>
`;
}
