import { formatMoney } from "@/lib/money";

// This presentation contract accepts an exact, verified provider offer. The current
// BRL integration supplies no offer: card acceptance alone does not prove installments.
export type VerifiedInstallmentOffer = {
  verified: true;
  currency: "brl";
  context: "product" | "order";
  amountInCents: number;
  installmentAmountsInCents: readonly number[];
  totalInCents: number;
  maximumApprovedInstallments: number;
  minimumInstallmentInCents: number;
  interest: "none" | "included";
  eligibility: string;
};

export function buildInstallmentTerms({ amountInCents, context = "product", offer }: {
  amountInCents: number;
  context?: "product" | "order";
  offer?: VerifiedInstallmentOffer | null;
}): string | null {
  if (!offer || offer.verified !== true || offer.currency !== "brl" || offer.context !== context) return null;
  const isAmount = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (!isAmount(amountInCents) || offer.amountInCents !== amountInCents || !isAmount(offer.totalInCents)) return null;
  const payments = offer.installmentAmountsInCents;
  if (!Array.isArray(payments) || payments.length < 2 || !Number.isSafeInteger(offer.maximumApprovedInstallments) || payments.length > offer.maximumApprovedInstallments) return null;
  if (!isAmount(offer.minimumInstallmentInCents) || payments.some((value) => !isAmount(value) || value < offer.minimumInstallmentInCents)) return null;
  const total = payments.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || total !== offer.totalInCents || total < amountInCents) return null;
  if (offer.interest !== "none" && offer.interest !== "included") return null;
  if ((offer.interest === "none" && total !== amountInCents) || (offer.interest === "included" && total <= amountInCents)) return null;
  if (typeof offer.eligibility !== "string" || !offer.eligibility.trim()) return null;
  const minimum = Math.min(...payments);
  const maximum = Math.max(...payments);
  const amounts = minimum === maximum ? `${payments.length}× de ${formatMoney(minimum)}` : `${payments.length} parcelas de ${formatMoney(minimum)} a ${formatMoney(maximum)}`;
  const interest = offer.interest === "none" ? "sem juros" : "com juros incluídos";
  return `Em ${amounts}, ${interest}. Total ${formatMoney(total)}. ${offer.eligibility.trim()}${context === "product" ? " Condição do produto; frete e descontos do pedido são calculados na finalização." : ""}`;
}
