import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/store/product-detail-client";
import { getAppUrl } from "@/lib/env";
import { isProductVideoUrl } from "@/lib/product-media";
import { getStoreSettings } from "@/lib/settings";
import { getProductBySlug } from "@/lib/storefront";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Produto não encontrado",
      robots: {
        index: false,
      },
    };
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
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    image: product.images
      .filter((image) => !isProductVideoUrl(image.url))
      .map((image) => (image.url.startsWith("http") ? image.url : `${appUrl}${image.url}`)),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (product.priceInCents / 100).toFixed(2),
      availability: product.variants.some((variant) => variant.stock - variant.reservedStock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${appUrl}/produto/${product.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ProductDetailClient
        key={product.id}
        product={product}
        productUrl={`${appUrl}/produto/${product.slug}`}
        whatsappNumber={settings.whatsappNumber}
        whatsappMessage={settings.whatsappDefaultMessage}
      />
      <section className="mt-14 grid gap-6 border-t border-neutral-200 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Detalhes</p>
          <h2 className="mt-2 text-2xl font-black text-neutral-950">Descrição</h2>
        </div>
        <p className="max-w-4xl text-base font-semibold leading-8 text-neutral-600">{product.description}</p>
      </section>
    </div>
  );
}
