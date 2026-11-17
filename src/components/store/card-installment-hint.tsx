import {
  listCardInstallmentPlans,
  maxInterestFreeInstallments,
  maxOfferedInstallments,
  type CardInstallmentRules,
} from "@/lib/card-installments";

/**
 * Short card installment copy for the product page and the cart. It never shows a surcharged
 * amount: the final 4x-12x value depends on coupon, promotions and shipping and is calculated (by
 * the server) only at checkout.
 */
export function buildCardInstallmentHint({ amountInCents, rules, context }: {
  amountInCents: number;
  rules: CardInstallmentRules | null | undefined;
  context: "product" | "cart";
}): string | null {
  if (!rules?.enabled || !Number.isSafeInteger(amountInCents) || amountInCents <= 0) return null;
  const maxOffered = maxOfferedInstallments(rules);
  if (maxOffered < 2) return null;
  if (context === "cart") {
    const upToCard = maxOffered > maxInterestFreeInstallments(rules) ? `ou até ${maxOffered}x no cartão` : null;
    const free = maxInterestFreeInstallments(rules);
    return [free >= 2 ? `Até ${free}x sem juros` : null, upToCard].filter(Boolean).join(" · ") || null;
  }
  // Product: the largest counts THIS price allows on its own (minimum installment respected), so the
  // page never promises "até 12x" for an item the checkout can only split in 4 (UIUX-PDP-002). No
  // amounts: coupon, promotions, shipping and the cart can still change the final total.
  const plans = listCardInstallmentPlans(amountInCents, rules);
  const interestFree = plans.filter((plan) => plan.interestFree && plan.installmentCount >= 2).at(-1);
  const longest = plans.at(-1);
  const freeText = interestFree ? `ou em até ${interestFree.installmentCount}x sem juros` : null;
  const upToCard = longest && !longest.interestFree ? `ou até ${longest.installmentCount}x no cartão` : null;
  return [freeText, upToCard].filter(Boolean).join(" · ") || null;
}

export function CardInstallmentHint({ className = "mt-2 text-xs font-semibold leading-5 text-neutral-600", ...input }: {
  amountInCents: number;
  rules: CardInstallmentRules | null | undefined;
  context: "product" | "cart";
  className?: string;
}) {
  const text = buildCardInstallmentHint(input);
  return text ? <p className={className}>{text}</p> : null;
}
