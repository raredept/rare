import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getProductCardMediaPair, type ProductMediaAsset } from "@/lib/product-media";
import { getAvailableStock } from "@/lib/stock";
import { ProductCardHoverImage } from "@/components/store/product-card-hover-image";
import { ProductMedia } from "@/components/store/product-media";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { buildStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";

type ProductCardProps = {
  product: {
    id: string;
    title: string;
    slug: string;
    priceInCents: number;
    category: { name: string } | null;
    subcategory: { name: string } | null;
    images: Array<ProductMediaAsset & { alt: string }>;
    variants: { stock: number; reservedStock: number; active: boolean }[];
  };
  commerce?: StorefrontCommerceState;
  priority?: boolean;
};

export function ProductCard({ product, commerce, priority = false }: ProductCardProps) {
  const commerceState = commerce ?? buildStorefrontCommerceState(true);
  const { primary: image, hover: hoverImage } = getProductCardMediaPair(product.images);
  const availableStock = product.variants
    .filter((variant) => variant.active)
    .reduce((sum, variant) => sum + getAvailableStock(variant.stock, variant.reservedStock), 0);
  const soldOut = availableStock <= 0;
  const categoryName = product.subcategory?.name ?? product.category?.name ?? "Produto";

  return (
    <article className="group h-full min-w-0">
      <Link
        href={`/produto/${product.slug}`}
        className="store-product-card flex h-full cursor-pointer flex-col border-b border-neutral-200 bg-transparent pb-4 transition-[border-color,transform] duration-200 ease-out hover:-translate-y-1 hover:border-neutral-950 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-neutral-100">
          {image ? (
            <ProductMedia
              media={image}
              alt={image.alt}
              context="card"
              priority={priority}
              placeholderLabel="Mídia indisponível"
              className="store-product-image h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] group-active:scale-[1.015]"
            />
          ) : (
            <ProductMediaPlaceholder />
          )}
          {hoverImage ? <ProductCardHoverImage media={hoverImage} /> : null}
          {soldOut ? (
            <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
              Esgotado
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-0.5 pt-3 sm:pt-4">
          <p className="line-clamp-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500 sm:tracking-[0.2em]">
            {categoryName}
          </p>
          <h2 className="mt-2 line-clamp-2 min-h-10 break-words text-[13px] font-black leading-5 text-neutral-950 sm:min-h-12 sm:text-base sm:leading-6">
            {product.title}
          </h2>
          <div className="mt-auto flex min-w-0 flex-col gap-1 pt-3">
            <p className="whitespace-nowrap text-[1rem] font-black leading-tight text-neutral-950 sm:text-lg sm:leading-none">
              {formatMoney(product.priceInCents)}
            </p>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase leading-4 tracking-wide text-neutral-500 sm:text-xs">
              {commerceState.checkoutEnabled ? "3x sem juros" : "Consulte disponibilidade"}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
