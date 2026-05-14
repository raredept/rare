"use client";

import { ChevronLeft, ChevronRight, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/store/cart-context";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { formatMoney } from "@/lib/money";
import { getAvailableStock } from "@/lib/stock";

type ProductDetailClientProps = {
  product: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    priceInCents: number;
    images: { url: string; alt: string }[];
    variants: { id: string; size: string; stock: number; reservedStock: number; active: boolean }[];
  };
  productUrl: string;
  whatsappNumber?: string | null;
  whatsappMessage: string;
};

export function ProductDetailClient({ product, productUrl, whatsappNumber, whatsappMessage }: ProductDetailClientProps) {
  const { addItem } = useCart();
  const [imageIndex, setImageIndex] = useState(0);
  const purchasableVariants = product.variants.filter((variant) => variant.active);
  const firstAvailableVariant =
    purchasableVariants.find((variant) => getAvailableStock(variant.stock, variant.reservedStock) > 0) ?? purchasableVariants[0];
  const firstAvailableVariantId = firstAvailableVariant?.id ?? "";
  const [variantId, setVariantId] = useState(firstAvailableVariantId);
  const selectedVariant = purchasableVariants.find((variant) => variant.id === variantId);
  const availableStock = selectedVariant ? getAvailableStock(selectedVariant.stock, selectedVariant.reservedStock) : 0;
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const image = product.images[imageIndex];
  const soldOut = purchasableVariants.every((variant) => getAvailableStock(variant.stock, variant.reservedStock) <= 0);

  const selectedSize = selectedVariant?.size;
  const sizeText = selectedSize ? ` Tamanho: ${selectedSize}.` : "";
  const whatsappText = `${whatsappMessage} Produto: ${product.title}.${sizeText} Link: ${productUrl}`;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, "");
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappText)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  function addToCart() {
    if (!selectedVariant || availableStock <= 0) return;
    const safeQuantity = Math.min(quantity, availableStock);
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      title: product.title,
      slug: product.slug,
      size: selectedVariant.size,
      image: product.images[0]?.url,
      priceInCents: product.priceInCents,
      quantity: safeQuantity,
      maxQuantity: availableStock,
    });
    setFeedback("Produto adicionado ao carrinho.");
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,480px)] lg:gap-16">
      <section className="min-w-0">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-neutral-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {image ? (
            <img src={image.url} alt={image.alt} className="store-product-image h-full w-full rounded-lg object-cover" />
          ) : (
            <ProductMediaPlaceholder label="Produto sem imagem" className="rounded-lg" />
          )}
          {product.images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setImageIndex((current) => (current === 0 ? product.images.length - 1 : current - 1))}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setImageIndex((current) => (current + 1) % product.images.length)}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
      </section>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Produto RARE</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{product.title}</h1>
        <p className="mt-5 whitespace-nowrap text-3xl font-black text-success lg:text-4xl">{formatMoney(product.priceInCents)}</p>
        <p className="mt-5 text-base font-semibold leading-7 text-neutral-600">{product.shortDescription}</p>

        <div className="mt-8 space-y-5 rounded-lg border border-neutral-200 bg-white p-5">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Tamanho</span>
            <select
              value={variantId}
              onChange={(event) => {
                setVariantId(event.target.value);
                setQuantity(1);
                setFeedback(null);
              }}
              className="h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-black"
            >
              {purchasableVariants.map((variant) => {
                const available = getAvailableStock(variant.stock, variant.reservedStock);
                return (
                  <option key={variant.id} value={variant.id} disabled={available <= 0}>
                    {variant.size} {available <= 0 ? "(Esgotado)" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Quantidade</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, availableStock)}
              value={quantity}
              disabled={soldOut || !selectedVariant || availableStock <= 0}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value);
                const maxQuantity = Math.max(1, availableStock);
                setQuantity(Math.max(1, Math.min(maxQuantity, Number.isFinite(nextQuantity) ? nextQuantity : 1)));
              }}
              className="h-12 w-32 rounded-lg border border-neutral-300 px-3 text-sm font-bold outline-none transition focus:border-black disabled:bg-neutral-100 disabled:text-neutral-500"
            />
            {selectedVariant ? (
              <span className="ml-3 text-sm font-bold text-neutral-500">
                {availableStock} {availableStock === 1 ? "unidade disponível" : "unidades disponíveis"}
              </span>
            ) : null}
          </label>

          <button
            type="button"
            onClick={addToCart}
            disabled={soldOut || !selectedVariant || availableStock <= 0}
            className="h-12 w-full rounded-lg bg-black px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-neutral-800 hover:shadow-[0_10px_30px_rgba(15,23,42,0.16)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none"
          >
            {soldOut || availableStock <= 0 ? "ESGOTADO" : "ADICIONAR AO CARRINHO"}
          </button>

          {feedback ? <p className="text-sm font-bold text-success">{feedback}</p> : null}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-success px-6 text-sm font-black uppercase tracking-[0.14em] text-success transition-[background-color,box-shadow,transform] duration-150 hover:bg-green-50 hover:shadow-[0_10px_30px_rgba(22,128,60,0.1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            Tirar dúvida no WhatsApp
          </a>
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-sm font-black text-neutral-950">Frete e prazo</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">
            O frete é validado no checkout com CEP e endereço de entrega antes da finalização.
          </p>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-neutral-200 bg-white p-5 text-sm font-bold text-neutral-700">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-success" />
            Compra 100% segura
          </div>
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-success" />
            Envio para todo o Brasil
          </div>
        </div>
      </aside>
    </div>
  );
}
