import { describe, expect, it } from "vitest";
import { buildInstallmentTerms, type VerifiedInstallmentOffer } from "@/lib/installment-terms";

const verifiedOffer: VerifiedInstallmentOffer = {
  verified: true, currency: "brl", context: "product", amountInCents: 10000,
  installmentAmountsInCents: [3334, 3333, 3333], totalInCents: 10000,
  maximumApprovedInstallments: 3, minimumInstallmentInCents: 3000,
  interest: "none", eligibility: "Somente cartões elegíveis na oferta confirmada.",
};
const render = (offer: VerifiedInstallmentOffer | null = verifiedOffer, amountInCents = 10000) => buildInstallmentTerms({ amountInCents, offer })?.replace(/\u00a0/g, " ") ?? null;

describe("verified installment presentation", () => {
  it("does not advertise installments without a verified provider offer", () => {
    expect(render(null)).toBeNull();
    expect(render({ ...verifiedOffer, verified: false } as unknown as VerifiedInstallmentOffer)).toBeNull();
  });
  it("uses exact provider cents including the remainder and the total", () => {
    const terms = render();
    expect(terms).toContain("3 parcelas de R$ 33,33 a R$ 33,34");
    expect(terms).toContain("Total R$ 100,00");
    expect(terms).toContain("sem juros");
    expect(terms).toContain("frete e descontos");
  });
  it("discloses interest only when verified payments sum to the higher total", () => {
    const terms = render({ ...verifiedOffer, installmentAmountsInCents: [3600, 3600, 3600], totalInCents: 10800, interest: "included" });
    expect(terms).toContain("3× de R$ 36,00, com juros incluídos");
    expect(terms).toContain("Total R$ 108,00");
    expect(render({ ...verifiedOffer, interest: "included" })).toBeNull();
  });
  it("rejects mismatched discount, order scope, currency, totals and unapproved limits", () => {
    expect(render(verifiedOffer, 9000)).toBeNull();
    expect(buildInstallmentTerms({ amountInCents: 10000, context: "order", offer: verifiedOffer })).toBeNull();
    for (const patch of [
      { currency: "mxn" }, { totalInCents: 9999 }, { minimumInstallmentInCents: 3400 },
      { maximumApprovedInstallments: 2 }, { installmentAmountsInCents: [5000, 5000.1] },
      { eligibility: "" }, { interest: "unknown" }, { installmentAmountsInCents: [10000] },
    ]) expect(render({ ...verifiedOffer, ...patch } as VerifiedInstallmentOffer)).toBeNull();
  });
});
