import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/store/product-detail-client";
import { isProductVideoUrl } from "@/lib/product-media";
import { buildProductMetadata, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { getStoreSettings } from "@/lib/settings";
import { buildBreadcrumbListJsonLd, buildProductJsonLd, JsonLdScript } from "@/lib/structured-data";
import { getProductBySlug } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return buildProductMetadata(product);
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const settings = await getStoreSettings();
  const commerce = getStorefrontCommerceState();
  const appUrl = RARE_DEFAULT_SITE_URL;
  const productUrl = `${appUrl}/produto/${product.slug}`;
  const productJsonLd = buildProductJsonLd({
    name: product.title,
    description: product.shortDescription,
    imageUrls: product.images
      .filter((image) => !isProductVideoUrl(image.url))
      .map((image) => (image.url.startsWith("http") ? image.url : `${appUrl}${image.url}`)),
    priceInCents: product.priceInCents,
    inStock: product.variants.some((variant) => variant.stock - variant.reservedStock > 0),
    url: productUrl,
    brand: product.brand,
    sku: product.variants.find((variant) => variant.active && variant.sku)?.sku,
    checkoutEnabled: commerce.checkoutEnabled,
  });
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
    <div className="store-shell py-5 pb-16 sm:py-6 sm:pb-20 lg:py-8 lg:pb-24">
      <JsonLdScript id="rare-product-json-ld" data={productJsonLd} />
      <JsonLdScript id="rare-product-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <nav aria-label="Breadcrumb" className="scrollbar-none mb-5 flex min-h-11 items-center gap-2 overflow-x-auto whitespace-nowrap text-xs font-normal text-neutral-600 sm:mb-7">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-neutral-950">Início</Link><span aria-hidden="true">/</span>
        {productCategories.map((category) => <span key={category.slug} className="contents"><Link href={`/categoria/${category.slug}`} className="inline-flex min-h-11 items-center hover:text-neutral-950">{category.name}</Link><span aria-hidden="true">/</span></span>)}
        <span aria-current="page" className="truncate text-neutral-700">{product.title}</span>
      </nav>
      <ProductDetailClient
        key={product.id}
        product={product}
        productUrl={productUrl}
        whatsappNumber={settings.whatsappNumber}
        whatsappMessage={settings.whatsappDefaultMessage}
        commerce={commerce}
      />
    </div>
  );
}
