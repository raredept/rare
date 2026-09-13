import { buildInstallmentTerms, type VerifiedInstallmentOffer } from "@/lib/installment-terms";

export function InstallmentTerms({ amountInCents, checkoutEnabled, context = "product", className = "mt-2 text-xs font-semibold leading-5 text-neutral-600", offer }: {
  amountInCents: number;
  checkoutEnabled: boolean;
  context?: "product" | "order";
  className?: string;
  offer?: VerifiedInstallmentOffer | null;
}) {
  const terms = checkoutEnabled ? buildInstallmentTerms({ amountInCents, context, offer }) : null;
  return terms ? <p className={className}>{terms}</p> : null;
}
