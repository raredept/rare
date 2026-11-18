import { getVariantDisplayName, type ProductOfferSnapshot } from "@/lib/product-offer";
import { getInstagramUrl } from "@/lib/store-social";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];

export type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type ProductJsonLdVariantInput = {
  name: string;
  size: string;
  sku?: string | null;
  inStock: boolean;
  url: string;
};

type ProductJsonLdInput = {
  name: string;
  description?: string | null;
  imageUrls: string[];
  /** The price the shopper pays now (automatic promotion applied), as rendered on the page. */
  priceInCents: number;
  /** Catalog price shown struck through while a promotion applies; omitted otherwise. */
  basePriceInCents?: number;
  /** YYYY-MM-DD: last day of a promotional price whose promotion has a real end date. */
  priceValidUntil?: string | null;
  inStock: boolean;
  url: string;
  brand?: string | null;
  sku?: string | null;
  /** Real taxonomy path ("Acessórios > Bags"); never a promotional name. */
  category?: string | null;
  checkoutEnabled: boolean;
  /** Stable group id (the product id) when the product has several sizes. */
  productGroupId?: string;
  /** Two or more sizes: published as a ProductGroup varying by size. */
  variants?: ProductJsonLdVariantInput[];
};

// Brand as registered in the web manifest and the domain; lets Google match "rare dept" queries to the site name.
const RARE_ALTERNATE_NAMES = ["RARE Dept", "raredept"];

function absoluteUrl(appUrl: string, path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${appUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function stringifyJsonLd(data: JsonLdObject) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLdScript({ data, id }: { data: JsonLdObject; id: string }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }} />;
}

export function buildOrganizationJsonLd(appUrl: string, instagramUrl?: string | null): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "RARE",
    alternateName: RARE_ALTERNATE_NAMES,
    url: appUrl,
    logo: `${appUrl}/brand/rare-logo.png`,
    sameAs: [getInstagramUrl(instagramUrl)],
  };
}

export function buildWebsiteJsonLd(appUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "RARE",
    alternateName: RARE_ALTERNATE_NAMES,
    url: appUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${appUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbListJsonLd(appUrl: string, items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(appUrl, item.path),
    })),
  };
}

/**
 * Availability claim of an Offer. InStock is only claimed while online checkout can take the order
 * (release guard `checkFeatureFlags` keeps this the only InStock in this file).
 */
function offerAvailability(input: { inStock: boolean; checkoutEnabled: boolean }) {
  return !input.inStock
    ? "https://schema.org/OutOfStock"
    : input.checkoutEnabled
      ? "https://schema.org/InStock"
      : undefined;
}

function toSchemaPrice(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function buildOffer(input: ProductJsonLdInput, offer: { inStock: boolean; url: string }): JsonLdObject {
  const onSale = typeof input.basePriceInCents === "number" && input.basePriceInCents > input.priceInCents;
  return {
    "@type": "Offer",
    priceCurrency: "BRL",
    // Google merchant listings: the active (sale) price carries no priceType; the struck-through
    // catalog price is a StrikethroughPrice specification. Coupons/shipping never enter the price.
    price: toSchemaPrice(input.priceInCents),
    priceSpecification: onSale
      ? {
          "@type": "UnitPriceSpecification",
          priceType: "https://schema.org/StrikethroughPrice",
          price: toSchemaPrice(input.basePriceInCents!),
          priceCurrency: "BRL",
        }
      : undefined,
    priceValidUntil: onSale && input.priceValidUntil ? input.priceValidUntil : undefined,
    availability: offerAvailability({ inStock: offer.inStock, checkoutEnabled: input.checkoutEnabled }),
    url: offer.url,
  };
}

export function buildProductJsonLd(input: ProductJsonLdInput): JsonLdObject {
  const brand = input.brand ? { "@type": "Brand", name: input.brand } : undefined;
  const category = input.category || undefined;
  const description = input.description ?? undefined;

  if (input.variants && input.variants.length > 1) {
    // Sizes are selected on the same page; each size keeps its own Offer, availability and URL
    // (`?size=` preselects it). Google "product variants": ProductGroup + hasVariant + variesBy.
    return {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      name: input.name,
      description,
      url: input.url,
      brand,
      category,
      productGroupID: input.productGroupId,
      variesBy: ["https://schema.org/size"],
      hasVariant: input.variants.map((variant) => ({
        "@type": "Product",
        name: variant.name,
        size: variant.size,
        sku: variant.sku ?? undefined,
        image: input.imageUrls.length ? input.imageUrls : undefined,
        offers: buildOffer(input, { inStock: variant.inStock, url: variant.url }),
      })),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description,
    image: input.imageUrls,
    url: input.url,
    sku: input.sku ?? undefined,
    brand,
    category,
    // The price is the one rendered on the page; InStock is only claimed while online checkout can take the order.
    offers: buildOffer(input, { inStock: input.inStock, url: input.url }),
  };
}

/** Product / ProductGroup JSON-LD from the shared offer snapshot (same source as the Merchant feed). */
export function buildProductJsonLdFromSnapshot(snapshot: ProductOfferSnapshot): JsonLdObject {
  const singleVariant = snapshot.variants.length === 1 ? snapshot.variants[0] : undefined;
  return buildProductJsonLd({
    name: snapshot.name,
    description: snapshot.description,
    imageUrls: snapshot.imageUrls,
    priceInCents: snapshot.priceInCents,
    basePriceInCents: snapshot.onSale ? snapshot.basePriceInCents : undefined,
    priceValidUntil: snapshot.saleLastDay,
    inStock: snapshot.inStock,
    url: snapshot.url,
    brand: snapshot.brand,
    sku: singleVariant?.sku ?? null,
    category: snapshot.categoryPath.length ? snapshot.categoryPath.join(" > ") : null,
    checkoutEnabled: snapshot.checkoutEnabled,
    productGroupId: snapshot.productId,
    variants: snapshot.isVariantGroup
      ? snapshot.variants.map((variant) => ({
          name: getVariantDisplayName(snapshot, variant.size),
          size: variant.size,
          sku: variant.sku,
          inStock: variant.inStock,
          url: variant.url,
        }))
      : undefined,
  });
}
