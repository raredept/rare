import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/store/product-detail-client";
import { buildProductOfferSnapshot } from "@/lib/product-offer";
import { buildProductMetadata, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { getStoreSettings } from "@/lib/settings";
import { buildBreadcrumbListJsonLd, buildProductJsonLdFromSnapshot, JsonLdScript } from "@/lib/structured-data";
import { getProductBySlug } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import { getStorefrontCardInstallmentRules } from "@/lib/storefront-installments";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ size?: string | string[] }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return buildProductMetadata(product);
}

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const settings = await getStoreSettings();
  const commerce = getStorefrontCommerceState();
  const appUrl = RARE_DEFAULT_SITE_URL;
  // RARE-SEO-GOOGLE-01: one offer snapshot feeds both this JSON-LD and the Merchant Center feed.
  const offer = buildProductOfferSnapshot(product, { siteUrl: appUrl, checkoutEnabled: commerce.checkoutEnabled });
  const productUrl = offer.url;
  const productJsonLd = buildProductJsonLdFromSnapshot(offer);
  // `?size=` (ProductGroup variant URLs) preselects that size when it is an active one.
  const requestedSize = typeof search?.size === "string" ? search.size.trim() : undefined;
  const initialSize = requestedSize && offer.variants.some((variant) => variant.size === requestedSize) ? requestedSize : undefined;
  const productCategories: Array<{ name: string; slug: string }> = [];
  for (const category of [product.category, product.subcategory]) {
    if (category && !productCategories.some((item) => item.slug === category.slug)) {
      productCategories.push({ name: category.name, slug: category.slug });
    }
  }
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(appUrl, [
    { name: "Início", path: "/" },
    ...productCategories.map((category) => ({ name: category.name, path: `/categoria/${category.slug}` })),
    { name: product.title, path: `/produto/${product.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <JsonLdScript id="rare-product-json-ld" data={productJsonLd} />
      <JsonLdScript id="rare-product-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <nav aria-label="Breadcrumb" className="scrollbar-none mb-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs font-bold text-neutral-500">
        <Link href="/" className="inline-flex min-h-6 items-center hover:text-neutral-950">Início</Link><span aria-hidden="true">/</span>
        {productCategories.map((category) => <span key={category.slug} className="contents"><Link href={`/categoria/${category.slug}`} className="inline-flex min-h-6 items-center hover:text-neutral-950">{category.name}</Link><span aria-hidden="true">/</span></span>)}
        <span aria-current="page" className="truncate text-neutral-700">{product.title}</span>
      </nav>
      <ProductDetailClient
        key={product.id}
        product={product}
        productUrl={productUrl}
        whatsappNumber={settings.whatsappNumber}
        whatsappMessage={settings.whatsappDefaultMessage}
        commerce={commerce}
        cardInstallmentRules={getStorefrontCardInstallmentRules(settings)}
        initialSize={initialSize}
      />
    </div>
  );
}
