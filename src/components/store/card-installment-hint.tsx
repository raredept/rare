import { listCardInstallmentPlans, type CardInstallmentRules } from "@/lib/card-installments";

/**
 * Short card installment copy for the product page and the cart. It never shows a surcharged
 * amount: the final 4x-12x value depends on coupon, promotions and shipping and is calculated (by
 * the server) only at checkout.
 *
 * Both contexts read the plans THIS amount allows from listCardInstallmentPlans — the very function
 * the checkout lists its options with — so neither page promises "até 12x" for an amount the checkout
 * can only split in 4 (UIUX-PDP-002 for the product page; RARE-COLLECTIONS-CART-01 for the cart).
 * In the cart the amount is the total shown before delivery: shipping can only raise it, so the
 * hint is conservative and the checkout may offer more once the delivery is chosen.
 */
export function buildCardInstallmentHint({ amountInCents, rules, context }: {
  amountInCents: number;
  rules: CardInstallmentRules | null | undefined;
  context: "product" | "cart";
}): string | null {
  if (!rules?.enabled || !Number.isSafeInteger(amountInCents) || amountInCents <= 0) return null;
  const plans = listCardInstallmentPlans(amountInCents, rules);
  const interestFree = plans.filter((plan) => plan.interestFree && plan.installmentCount >= 2).at(-1);
  const longest = plans.at(-1);
  // Only 1x: no installment promise at all. Longest interest-free: no redundant "no cartão" part.
  const upToCard = longest && !longest.interestFree && longest.installmentCount >= 2 ? `ou até ${longest.installmentCount}x no cartão` : null;
  const freeText = interestFree ? `${context === "cart" ? "Até" : "ou em até"} ${interestFree.installmentCount}x sem juros` : null;
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
