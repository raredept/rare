import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getPreferredProductCardMedia } from "@/lib/product-media";
import { getAvailableStock } from "@/lib/stock";
import { ProductMedia } from "@/components/store/product-media";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";

type ProductCardProps = {
  product: {
    id: string;
    title: string;
    slug: string;
    priceInCents: number;
    category: { name: string } | null;
    subcategory: { name: string } | null;
    images: { url: string; alt: string }[];
    variants: { stock: number; reservedStock: number; active: boolean }[];
  };
};

export function ProductCard({ product }: ProductCardProps) {
  const image = getPreferredProductCardMedia(product.images);
  const availableStock = product.variants
    .filter((variant) => variant.active)
    .reduce((sum, variant) => sum + getAvailableStock(variant.stock, variant.reservedStock), 0);
  const soldOut = availableStock <= 0;
  const categoryName = product.subcategory?.name ?? product.category?.name ?? "Produto";

  return (
    <article className="group h-full min-w-0">
      <Link
        href={`/produto/${product.slug}`}
        className="store-product-card flex h-full cursor-pointer flex-col rounded-lg border border-neutral-200 bg-white p-2 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-1 hover:border-neutral-950/30 hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-neutral-100">
          {image ? (
            <ProductMedia
              url={image.url}
              alt={image.alt}
              loading="lazy"
              placeholderLabel="Mídia indisponível"
              className="store-product-image h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] group-active:scale-[1.015]"
            />
          ) : (
            <ProductMediaPlaceholder />
          )}
          {soldOut ? (
            <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
              Esgotado
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col px-1 pb-2 pt-3 sm:pt-4">
          <p className="line-clamp-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500 sm:tracking-[0.2em]">
            {categoryName}
          </p>
          <h2 className="mt-2 line-clamp-2 min-h-10 break-words text-[13px] font-black leading-5 text-neutral-950 sm:min-h-12 sm:text-base sm:leading-6">
            {product.title}
          </h2>
          <div className="mt-auto flex min-w-0 flex-col gap-1 pt-3">
            <p className="whitespace-nowrap text-[1rem] font-black leading-tight text-success sm:text-lg sm:leading-none">
              {formatMoney(product.priceInCents)}
            </p>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase leading-4 tracking-wide text-neutral-500 sm:text-xs">
              3x sem juros
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
