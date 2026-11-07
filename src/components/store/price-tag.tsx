import { formatMoney } from "@/lib/money";
import type { ProductPrice } from "@/lib/promotions/engine";

// Price presentation shared by card, product page and campaign. The discount is never conveyed
// by colour alone: the old price is struck through AND labelled for screen readers, and the
// percentage is text. All numbers come from the server-side pricing.

type PriceTagProps = {
  pricing: ProductPrice;
  size?: "card" | "detail";
  className?: string;
};

export function PriceTag({ pricing, size = "card", className = "" }: PriceTagProps) {
  const finalClass = size === "detail" ? "text-2xl font-medium text-neutral-950 sm:text-3xl" : "text-base font-semibold leading-tight text-neutral-950 sm:text-lg";
  if (!pricing.promotion || pricing.discountInCents <= 0) {
    return <p className={`whitespace-nowrap ${finalClass} ${className}`}>{formatMoney(pricing.finalPriceInCents)}</p>;
  }

  const label = `Preço original ${formatMoney(pricing.basePriceInCents)}, preço promocional ${formatMoney(pricing.finalPriceInCents)}, economia de ${pricing.percentOff}%`;
  return (
    <div className={`flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className="sr-only">{label}</span>
      <s aria-hidden="true" className={`whitespace-nowrap font-normal text-neutral-600 ${size === "detail" ? "text-base" : "text-xs sm:text-sm"}`}>
        {formatMoney(pricing.basePriceInCents)}
      </s>
      <span aria-hidden="true" className={`whitespace-nowrap ${finalClass}`}>{formatMoney(pricing.finalPriceInCents)}</span>
      {pricing.percentOff > 0 ? (
        <span aria-hidden="true" className="whitespace-nowrap bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white sm:text-xs">
          -{pricing.percentOff}%
        </span>
      ) : null}
    </div>
  );
}

export function PromotionBadge({ pricing }: { pricing: ProductPrice }) {
  if (!pricing.promotion) return null;
  const text = pricing.promotion.badgeText ?? (pricing.percentOff > 0 ? `-${pricing.percentOff}%` : "Promoção");
  return (
    <span className="inline-block max-w-full bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.14em] text-neutral-950 ring-1 ring-neutral-950/10">
      {text}
    </span>
  );
}
