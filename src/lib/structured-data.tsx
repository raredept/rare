import { getInstagramUrl } from "@/lib/store-social";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];

export type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

type ProductJsonLdInput = {
  name: string;
  description?: string | null;
  imageUrls: string[];
  priceInCents: number;
  inStock: boolean;
  url: string;
  brand?: string | null;
  sku?: string | null;
  checkoutEnabled: boolean;
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

export function buildProductJsonLd(input: ProductJsonLdInput): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description ?? undefined,
    image: input.imageUrls,
    url: input.url,
    sku: input.sku ?? undefined,
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    // The price is the one rendered on the page; InStock is only claimed while online checkout can take the order.
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (input.priceInCents / 100).toFixed(2),
      availability: !input.inStock
        ? "https://schema.org/OutOfStock"
        : input.checkoutEnabled
          ? "https://schema.org/InStock"
          : undefined,
      url: input.url,
    },
  };
}
