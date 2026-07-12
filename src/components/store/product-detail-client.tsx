"use client";

import { ChevronLeft, ChevronRight, CircleHelp, Loader2, Maximize2, Minus, PackageCheck, Plus, RotateCcw, ShieldCheck, Truck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useCart, useCartDrawer } from "@/components/store/cart-context";
import { ProductMedia } from "@/components/store/product-media";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { formatMoney } from "@/lib/money";
import {
  getPreferredProductCardMedia,
  getProductMediaLabel,
  getProductMediaTypeFromUrl,
  getProductVideoPoster,
  isZoomableProductMediaUrl,
  type ProductMediaAsset,
} from "@/lib/product-media";
import { getAvailableStock } from "@/lib/stock";
import { buildStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";

type ProductDetailClientProps = {
  product: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    priceInCents: number;
    images: Array<ProductMediaAsset & { alt: string }>;
    variants: { id: string; size: string; stock: number; reservedStock: number; active: boolean }[];
  };
  productUrl: string;
  whatsappNumber?: string | null;
  whatsappMessage: string;
  commerce?: StorefrontCommerceState;
};

type ShippingQuoteOption = {
  id: string;
  provider?: string;
  service: string;
  label: string;
  amountCents: number;
  deliveryEstimateText: string;
};

type ProductImageZoomDialogProps = {
  productTitle: string;
  zoomedImage: ProductMediaAsset & { alt: string };
  zoomedImagePosition: number;
  zoomableImageCount: number;
  hasZoomNavigation: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  dialogRef?: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

const productLensSize = 208;
const productLensZoomFactor = 2.1;

type ProductLensFrame = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function calculateProductLensPosition(
  event: Pick<MouseEvent<HTMLDivElement>, "clientX" | "clientY">,
  frame: ProductLensFrame,
  lensSize = productLensSize,
) {
  const pointerX = Math.max(0, Math.min(frame.width, event.clientX - frame.left));
  const pointerY = Math.max(0, Math.min(frame.height, event.clientY - frame.top));
  const maxLeft = Math.max(0, frame.width - lensSize);
  const maxTop = Math.max(0, frame.height - lensSize);

  return {
    left: Math.max(0, Math.min(maxLeft, pointerX - lensSize / 2)),
    top: Math.max(0, Math.min(maxTop, pointerY - lensSize / 2)),
    pointerX,
    pointerY,
  };
}

type ProductLensPosition = ReturnType<typeof calculateProductLensPosition> & {
  imageOffsetLeft: number;
  imageOffsetTop: number;
  imageWidth: number;
  imageHeight: number;
};

export function ProductImageZoomDialog({
  productTitle,
  zoomedImage,
  zoomedImagePosition,
  zoomableImageCount,
  hasZoomNavigation,
  closeRef,
  dialogRef,
  onClose,
  onPrevious,
  onNext,
}: ProductImageZoomDialogProps) {
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Imagem ampliada de ${productTitle}`}
      className="fixed inset-0 z-[90] h-dvh overflow-hidden bg-neutral-950/92 px-4 py-4 text-white backdrop-blur-sm sm:px-6"
    >
      <button type="button" tabIndex={-1} className="absolute inset-0 cursor-zoom-out" onClick={onClose} aria-label="Fechar zoom da imagem" />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fechar visualização ampliada"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center py-4">
          {hasZoomNavigation ? (
            <button
              type="button"
              onClick={onPrevious}
              className="absolute left-0 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-2"
              aria-label="Imagem ampliada anterior"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
          <ProductMedia
            media={zoomedImage}
            alt={zoomedImage.alt || productTitle}
            context="zoom"
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_22px_80px_rgba(0,0,0,0.42)]"
          />
          {hasZoomNavigation ? (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-0 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-2"
              aria-label="Próxima imagem ampliada"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {hasZoomNavigation ? (
          <p className="pb-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white/70">
            {zoomedImagePosition + 1} / {zoomableImageCount}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatCepInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatProductShippingError(message: string) {
  if (message.includes("peso e medidas")) {
    return "Frete indisponível para este produto. Fale com a RARE para calcular o envio.";
  }
  return message;
}

export function ProductDetailClient({ product, productUrl, whatsappNumber, whatsappMessage, commerce }: ProductDetailClientProps) {
  const commerceState = commerce ?? buildStorefrontCommerceState(true);
  const { addItem } = useCart();
  const { openCart } = useCartDrawer();
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomImageIndex, setZoomImageIndex] = useState<number | null>(null);
  const [lensPosition, setLensPosition] = useState<ProductLensPosition | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const mainImageRef = useRef<HTMLImageElement | null>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement | null>(null);
  const zoomCloseRef = useRef<HTMLButtonElement | null>(null);
  const zoomDialogRef = useRef<HTMLDivElement | null>(null);
  const purchasableVariants = product.variants.filter((variant) => variant.active);
  const firstAvailableVariant =
    purchasableVariants.find((variant) => getAvailableStock(variant.stock, variant.reservedStock) > 0) ?? purchasableVariants[0];
  const firstAvailableVariantId = firstAvailableVariant?.id ?? "";
  const [variantId, setVariantId] = useState(firstAvailableVariantId);
  const selectedVariant = purchasableVariants.find((variant) => variant.id === variantId);
  const availableStock = selectedVariant ? getAvailableStock(selectedVariant.stock, selectedVariant.reservedStock) : 0;
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shippingCep, setShippingCep] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const image = product.images[imageIndex];
  const mainMediaType = image ? getProductMediaTypeFromUrl(image.url) : null;
  const mainVideoPoster = image && mainMediaType === "video" ? getProductVideoPoster(product.images, image.url) : undefined;
  const mainMediaCanZoom = image ? isZoomableProductMediaUrl(image.url) : false;
  const showProductLens = mainMediaCanZoom && mainMediaType !== "video";
  const zoomableImageIndexes = useMemo(
    () => product.images.flatMap((media, index) => (isZoomableProductMediaUrl(media.url) ? [index] : [])),
    [product.images],
  );
  const zoomedImage = zoomImageIndex === null ? null : product.images[zoomImageIndex] ?? null;
  const zoomedImagePosition = zoomImageIndex === null ? -1 : zoomableImageIndexes.indexOf(zoomImageIndex);
  const hasZoomNavigation = zoomableImageIndexes.length > 1;
  const cartImage = getPreferredProductCardMedia(product.images);
  const soldOut = purchasableVariants.every((variant) => getAvailableStock(variant.stock, variant.reservedStock) <= 0);
  const fullDescription = product.description.trim();
  const shortDescription = product.shortDescription.trim();
  const mainDescription = shortDescription || fullDescription;

  const selectedSize = selectedVariant?.size;
  const sizeText = selectedSize ? ` Tamanho: ${selectedSize}.` : "";
  const whatsappText = `${whatsappMessage} Produto: ${product.title}.${sizeText} Link: ${productUrl}`;
  const whatsappDigits = whatsappNumber?.replace(/\D/g, "");
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappText)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const getNextZoomImageIndex = useCallback((currentIndex: number, direction: -1 | 1) => {
    const currentZoomPosition = zoomableImageIndexes.indexOf(currentIndex);
    if (currentZoomPosition === -1) return zoomableImageIndexes[0] ?? null;

    const nextZoomPosition = (currentZoomPosition + direction + zoomableImageIndexes.length) % zoomableImageIndexes.length;
    return zoomableImageIndexes[nextZoomPosition] ?? null;
  }, [zoomableImageIndexes]);

  const closeZoom = useCallback(() => {
    setZoomImageIndex(null);
    window.setTimeout(() => zoomTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (zoomImageIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    zoomCloseRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeZoom();
        return;
      }

      if (event.key === "Tab" && zoomDialogRef.current) {
        const focusable = Array.from(
          zoomDialogRef.current.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled]):not([tabindex='-1']),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])",
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);

        if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
          return;
        }

        if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
          return;
        }
      }

      if (!hasZoomNavigation) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setZoomImageIndex((currentIndex) => (currentIndex === null ? currentIndex : getNextZoomImageIndex(currentIndex, 1)));
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setZoomImageIndex((currentIndex) => (currentIndex === null ? currentIndex : getNextZoomImageIndex(currentIndex, -1)));
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeZoom, getNextZoomImageIndex, hasZoomNavigation, zoomImageIndex]);

  const showPreviousZoomImage = useCallback(() => {
    setZoomImageIndex((currentIndex) => (currentIndex === null ? currentIndex : getNextZoomImageIndex(currentIndex, -1)));
  }, [getNextZoomImageIndex]);

  const showNextZoomImage = useCallback(() => {
    setZoomImageIndex((currentIndex) => (currentIndex === null ? currentIndex : getNextZoomImageIndex(currentIndex, 1)));
  }, [getNextZoomImageIndex]);

  function addToCart() {
    if (!selectedVariant || availableStock <= 0) return;
    const safeQuantity = Math.min(quantity, availableStock);
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      title: product.title,
      slug: product.slug,
      size: selectedVariant.size,
      image: cartImage?.url,
      priceInCents: product.priceInCents,
      quantity: safeQuantity,
      maxQuantity: availableStock,
    });
    setFeedback("Peça adicionada ao carrinho.");
    openCart();
  }

  function handleImageMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!showProductLens || !imageFrameRef.current) return;
    const imageElement = mainImageRef.current;
    const imageFrame = imageElement ?? imageFrameRef.current;
    const imageRect = imageFrame.getBoundingClientRect();
    const wrapperRect = imageFrameRef.current.getBoundingClientRect();
    const position = calculateProductLensPosition(event, imageRect);
    setLensPosition({
      ...position,
      imageOffsetLeft: imageRect.left - wrapperRect.left,
      imageOffsetTop: imageRect.top - wrapperRect.top,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
    });
  }

  async function calculateShipping() {
    if (!selectedVariant) {
      setShippingError("Escolha uma variação para calcular o frete.");
      return;
    }

    setShippingLoading(true);
    setShippingError(null);
    setShippingOptions([]);

    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: shippingCep,
          items: [
            {
              productId: product.id,
              variantId: selectedVariant.id,
              quantity,
            },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Frete indisponível.");
      setShippingOptions(data.options ?? []);
      if (data.disabled) {
        setShippingError(data.message ?? "Frete automático desativado; entrega combinada manualmente.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Frete indisponível.";
      setShippingError(formatProductShippingError(message));
    } finally {
      setShippingLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:gap-10 xl:grid-cols-[minmax(0,700px)_minmax(360px,420px)] xl:gap-14">
      <section className="min-w-0">
        <div
          ref={imageFrameRef}
          onMouseMove={handleImageMouseMove}
          onMouseEnter={handleImageMouseMove}
          onMouseLeave={() => setLensPosition(null)}
          className={`relative aspect-[4/5] overflow-hidden rounded-lg border border-neutral-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ${
            mainMediaCanZoom ? "group cursor-zoom-in" : ""
          }`}
        >
          {image ? (
            <ProductMedia
              media={image}
              alt={image.alt}
              context="detail"
              controls={mainMediaType === "video"}
              poster={mainVideoPoster}
              preload={mainMediaType === "video" ? "metadata" : undefined}
              priority
              imageRef={mainImageRef}
              placeholderLabel="Mídia indisponível"
              className={`store-product-image h-full w-full rounded-lg object-cover ${
                mainMediaCanZoom
                  ? "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:md:group-hover:scale-[1.08]"
                  : ""
              }`}
            />
          ) : (
            <ProductMediaPlaceholder label="Produto sem imagem" className="rounded-lg" />
          )}
          {image && mainMediaCanZoom ? (
            <button
              ref={zoomTriggerRef}
              type="button"
              onClick={() => setZoomImageIndex(imageIndex)}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] backdrop-blur-sm transition hover:bg-black/80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:cursor-zoom-in"
              aria-label="Ampliar imagem do produto"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          {showProductLens && lensPosition ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 hidden overflow-hidden rounded-full border-4 border-white/95 bg-neutral-200 shadow-[0_12px_35px_rgba(15,23,42,0.38)] lg:block"
              style={{
                width: productLensSize,
                height: productLensSize,
                left: lensPosition.imageOffsetLeft + lensPosition.left,
                top: lensPosition.imageOffsetTop + lensPosition.top,
              }}
            >
              <img
                src={image.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none object-cover"
                style={{
                  width: lensPosition.imageWidth * productLensZoomFactor,
                  height: lensPosition.imageHeight * productLensZoomFactor,
                  left: productLensSize / 2 - lensPosition.pointerX * productLensZoomFactor,
                  top: productLensSize / 2 - lensPosition.pointerY * productLensZoomFactor,
                }}
              />
            </div>
          ) : null}
          {product.images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setLensPosition(null);
                  setImageIndex((current) => (current === 0 ? product.images.length - 1 : current - 1));
                }}
                className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLensPosition(null);
                  setImageIndex((current) => (current + 1) % product.images.length);
                }}
                className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
        {product.images.length > 1 ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {product.images.map((media, index) => {
              const mediaType = getProductMediaTypeFromUrl(media.url);
              return (
                <button
                  key={media.url}
                  type="button"
                  className={`relative aspect-square overflow-hidden rounded-lg border bg-white p-1 transition-[border-color,box-shadow,transform] duration-150 hover:border-neutral-950/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 ${
                    index === imageIndex ? "border-neutral-950 shadow-[0_10px_30px_rgba(15,23,42,0.12)]" : "border-neutral-200"
                  }`}
                  onClick={() => {
                    setLensPosition(null);
                    setImageIndex(index);
                  }}
                  aria-label={`Selecionar ${getProductMediaLabel(mediaType).toLowerCase()} ${index + 1}`}
                >
                  <ProductMedia
                    media={media}
                    alt=""
                    context="thumbnail"
                    poster={mediaType === "video" ? getProductVideoPoster(product.images, media.url) : undefined}
                    preload="none"
                    placeholderLabel="Mídia indisponível"
                    className="h-full w-full rounded-md object-cover"
                  />
                  {mediaType === "video" ? (
                    <span className="absolute bottom-1 left-1 rounded bg-black px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                      Vídeo
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {showProductLens ? (
          <p className="mt-3 hidden text-center text-xs font-black uppercase tracking-[0.16em] text-neutral-600 lg:block">
            Passe o mouse para ampliar · clique para abrir
          </p>
        ) : null}
      </section>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Seleção RARE</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-4xl">{product.title}</h1>
        {mainDescription ? (
          <p className="mt-4 max-w-xl whitespace-pre-line text-sm font-semibold leading-6 text-neutral-600">{mainDescription}</p>
        ) : null}
        <p className="mt-4 whitespace-nowrap text-3xl font-black text-neutral-950 lg:text-3xl">{formatMoney(product.priceInCents)}</p>

        <div className="mt-6 space-y-5 rounded-lg border border-neutral-200 bg-white p-5">
          <fieldset>
            <legend className="mb-3 block text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Tamanho</legend>
            <div className="flex flex-wrap gap-2">
              {purchasableVariants.map((variant) => {
                const available = getAvailableStock(variant.stock, variant.reservedStock);
                const selected = variant.id === variantId;
                return <button
                  key={variant.id}
                  type="button"
                  disabled={available <= 0}
                  aria-pressed={selected}
                  aria-label={`${variant.size}${available <= 0 ? ", esgotado" : ""}`}
                  onClick={() => {
                    setVariantId(variant.id);
                    setQuantity(1);
                    setFeedback(null);
                    setShippingOptions([]);
                    setShippingError(null);
                  }}
                  className={`relative min-h-11 min-w-12 rounded-md border px-4 text-sm font-black transition ${selected ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-neutral-950 hover:border-black"} disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-600 disabled:line-through`}
                >{variant.size}</button>;
              })}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-neutral-500">Quantidade</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center rounded-md border border-neutral-300" role="group" aria-label="Controle de quantidade">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1 || soldOut} className="flex h-12 w-12 items-center justify-center disabled:text-neutral-500" aria-label="Diminuir quantidade"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center text-sm font-black" aria-live="polite">{quantity}</span>
                <button type="button" onClick={() => setQuantity((current) => Math.min(availableStock, current + 1))} disabled={quantity >= availableStock || soldOut} className="flex h-12 w-12 items-center justify-center disabled:text-neutral-500" aria-label="Aumentar quantidade"><Plus className="h-4 w-4" /></button>
              </div>
              {selectedVariant ? <span className="text-sm font-bold text-neutral-500">{availableStock} {availableStock === 1 ? "unidade disponível" : "unidades disponíveis"}</span> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={addToCart}
            disabled={!commerceState.checkoutEnabled || soldOut || !selectedVariant || availableStock <= 0}
            className="h-12 w-full rounded-lg bg-black px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition-[background-color,box-shadow,transform] duration-150 hover:bg-neutral-800 hover:shadow-[0_10px_30px_rgba(15,23,42,0.16)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-none"
          >
            {!commerceState.checkoutEnabled ? commerceState.checkoutActionLabel : soldOut || availableStock <= 0 ? "ESGOTADO" : "ADICIONAR AO CARRINHO"}
          </button>

          {!commerceState.checkoutEnabled ? <p className="rounded-md bg-neutral-100 px-4 py-3 text-sm font-semibold leading-6 text-neutral-600">O catálogo continua disponível. Fale com a RARE para consultar esta peça; nenhum pagamento será solicitado pela loja agora.</p> : null}

          {feedback ? <p className="text-sm font-bold text-success" role="status" aria-live="polite">{feedback}</p> : null}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-success px-6 text-sm font-black uppercase tracking-[0.14em] text-success transition-[background-color,box-shadow,transform] duration-150 hover:bg-green-50 hover:shadow-[0_10px_30px_rgba(22,128,60,0.1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            Fale com a RARE pelo WhatsApp
          </a>
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-sm font-black text-neutral-950">Frete e prazo</p>
          {commerceState.checkoutEnabled ? <>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={shippingCep}
              onChange={(event) => {
                setShippingCep(formatCepInput(event.target.value));
                setShippingOptions([]);
                setShippingError(null);
              }}
              placeholder="Digite seu CEP"
              inputMode="numeric"
              className="admin-input h-11"
              aria-label="Digite seu CEP para calcular o frete"
            />
            <button
              type="button"
              onClick={calculateShipping}
              disabled={shippingLoading || !selectedVariant}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-black px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-500"
            >
              {shippingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Calcular frete
            </button>
          </div>
          {shippingOptions.length ? (
            <div className="mt-4 grid gap-2">
              {shippingOptions.map((option) => (
                <div key={option.id} className="rounded-lg border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-black text-neutral-950">
                      {option.provider === "fixed" || option.provider === "melhor_envio" ? option.label : option.service}
                    </span>
                    <span className="whitespace-nowrap font-black text-success">{formatMoney(option.amountCents)}</span>
                  </div>
                  <p className="mt-1">{option.deliveryEstimateText}</p>
                </div>
              ))}
            </div>
          ) : null}
          {shippingError ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">{shippingError}</p> : null}
          <p className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
            Frete e prazo podem variar conforme endereço e disponibilidade.
          </p>
          </> : <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">A consulta automática está indisponível enquanto as compras estiverem pausadas. Fale com a RARE para tirar dúvidas gerais sobre envio.</p>}
          <Link href="/politica-de-envio" className="mt-3 inline-flex text-sm font-black text-neutral-950 underline underline-offset-4">
            Ver política de envio
          </Link>
        </div>

        <div className="mt-5 grid gap-4 rounded-lg border border-neutral-200 bg-white p-5 text-sm font-bold text-neutral-700">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
            <span>
              <span className="block font-black text-neutral-950">{commerceState.checkoutStatusTitle}</span>
              <span className="mt-1 block font-semibold leading-6 text-neutral-600">{commerceState.checkoutStatusText}</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 text-success" />
            <span>
              <span className="block font-black text-neutral-950">{commerceState.checkoutEnabled ? "Envio para todo o Brasil" : "Consulta de envio"}</span>
              <span className="mt-1 block font-semibold leading-6 text-neutral-600">{commerceState.checkoutEnabled ? "Frete e prazo dependem do CEP e da disponibilidade da operação." : "Condições de envio serão confirmadas quando a operação de compras voltar."}</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-0.5 h-5 w-5 text-success" />
            <span>
              <span className="block font-black text-neutral-950">Estoque limitado</span>
              <span className="mt-1 block font-semibold leading-6 text-neutral-600">Disponibilidade conforme o tamanho escolhido.</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 h-5 w-5 text-success" />
            <span>
              <Link href="/trocas-e-devolucoes" className="block font-black text-neutral-950 underline underline-offset-4">
                Troca e devolução em até 7 dias
              </Link>
              <span className="mt-1 block font-semibold leading-6 text-neutral-600">Consulte as regras antes da compra.</span>
            </span>
          </div>
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 h-5 w-5 text-success" />
            <span>
              <span className="block font-black text-neutral-950">Atendimento direto</span>
              <span className="mt-1 block font-semibold leading-6 text-neutral-600">Fale com a RARE pelo WhatsApp para tirar dúvidas sobre tamanho ou disponibilidade.</span>
            </span>
          </div>
        </div>
      </aside>
      {fullDescription && fullDescription !== mainDescription ? (
        <section className="border-t border-neutral-200 pt-8 lg:col-span-2 lg:pt-10" aria-labelledby="product-details-title">
          <p className="store-section-label">Sobre a peça</p>
          <h2 id="product-details-title" className="mt-3 text-2xl font-black tracking-tight text-neutral-950">Detalhes do produto</h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-base font-semibold leading-8 text-neutral-600">{fullDescription}</p>
        </section>
      ) : null}
      {zoomedImage && typeof document !== "undefined"
        ? createPortal(
            <ProductImageZoomDialog
              productTitle={product.title}
              zoomedImage={zoomedImage}
              zoomedImagePosition={zoomedImagePosition}
              zoomableImageCount={zoomableImageIndexes.length}
              hasZoomNavigation={hasZoomNavigation}
              closeRef={zoomCloseRef}
              dialogRef={zoomDialogRef}
              onClose={closeZoom}
              onPrevious={showPreviousZoomImage}
              onNext={showNextZoomImage}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
