import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getProductCardMediaPair, type ProductMediaAsset } from "@/lib/product-media";
import { getAvailableStock } from "@/lib/stock";
import { ProductCardHoverImage } from "@/components/store/product-card-hover-image";
import { ProductMedia } from "@/components/store/product-media";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { buildStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";
import styles from "./product-card.module.css";
import { InstallmentTerms } from "@/components/store/installment-terms";

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
  /** 3 when the grid sits under a section h2, so the outline nests products under it. */
  headingLevel?: 2 | 3;
  mediaSizes?: string;
};

export function ProductCard({ product, commerce, priority = false, headingLevel = 2, mediaSizes }: ProductCardProps) {
  const Title = headingLevel === 3 ? "h3" : "h2";
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
        className={`store-product-card flex h-full cursor-pointer flex-col bg-transparent pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4 focus-visible:ring-offset-background ${styles.card}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
          {image ? (
            <ProductMedia
              media={image}
              alt={image.alt}
              context="card"
              priority={priority}
              sizes={mediaSizes}
              placeholderLabel="Mídia indisponível"
              className={`store-product-image h-full w-full object-cover ${styles.image}`}
            />
          ) : (
            <ProductMediaPlaceholder />
          )}
          {hoverImage ? <ProductCardHoverImage media={hoverImage} sizes={mediaSizes} /> : null}
          {soldOut ? (
            <span className="absolute left-3 top-3 bg-neutral-950 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white">
              Esgotado
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col pt-3 sm:pt-4">
          <p className="line-clamp-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">
            {categoryName}
          </p>
          <Title className="mt-1.5 line-clamp-2 min-h-10 break-words text-[13px] font-semibold leading-5 text-neutral-950 sm:min-h-12 sm:text-base sm:leading-6">
            {product.title}
          </Title>
          <div className="mt-auto flex min-w-0 flex-col gap-1.5 pt-3">
            <p className="whitespace-nowrap text-base font-semibold leading-tight text-neutral-950 sm:text-lg">
              {formatMoney(product.priceInCents)}
            </p>
            <p className="text-[11px] font-normal leading-4 text-neutral-600 sm:text-xs">
              {soldOut ? "Esgotado" : commerceState.checkoutEnabled ? "Disponível" : "Consulte disponibilidade"}
            </p>
            <InstallmentTerms amountInCents={product.priceInCents} checkoutEnabled={commerceState.checkoutEnabled} className="text-xs font-normal leading-5 text-neutral-600" />
          </div>
        </div>
      </Link>
    </article>
  );
}
