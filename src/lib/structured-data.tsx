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
};

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

export function buildOrganizationJsonLd(appUrl: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "RARE",
    url: appUrl,
    logo: `${appUrl}/brand/rare-logo.png`,
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
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (input.priceInCents / 100).toFixed(2),
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: input.url,
    },
  };
}
