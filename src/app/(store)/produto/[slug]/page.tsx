import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/store/product-detail-client";
import { getAppUrl } from "@/lib/env";
import { isProductVideoUrl } from "@/lib/product-media";
import { getStoreSettings } from "@/lib/settings";
import { buildBreadcrumbListJsonLd, buildProductJsonLd, JsonLdScript } from "@/lib/structured-data";
import { getProductBySlug } from "@/lib/storefront";

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

  const description = product.shortDescription || product.description;
  const openGraphImage = product.images.find((image) => !isProductVideoUrl(image.url) && image.url.startsWith("http"));

  return {
    title: product.title,
    description,
    alternates: {
      canonical: `/produto/${product.slug}`,
    },
    openGraph: {
      title: `${product.title} | RARE`,
      description,
      type: "website",
      images: openGraphImage ? [{ url: openGraphImage.url, alt: openGraphImage.alt || product.title }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const settings = await getStoreSettings();
  const appUrl = getAppUrl();
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
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <JsonLdScript id="rare-product-json-ld" data={productJsonLd} />
      <JsonLdScript id="rare-product-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <ProductDetailClient
        key={product.id}
        product={product}
        productUrl={productUrl}
        whatsappNumber={settings.whatsappNumber}
        whatsappMessage={settings.whatsappDefaultMessage}
      />
    </div>
  );
}
