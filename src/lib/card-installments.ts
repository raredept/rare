import { formatMoney } from "@/lib/money";

// Card installment pricing (RARE-CARD-INSTALLMENTS-01). Pure and shared: the checkout recalculates
// every plan on the server from the order's own base total and the store's rules; the browser only
// uses the same function to PREVIEW options. Nothing financial sent by a browser is ever trusted.
//
// Order of calculation (fixed by the business): products -> promotions -> coupon -> shipping ->
// baseTotal -> installment surcharge -> final total. Free-shipping eligibility and the coupon are
// decided BEFORE any surcharge exists, so a surcharge can never unlock either.
//
// Money is integer cents; rates are integer basis points (1% = 100 bps). No floats touch money.

/** Absolute ceiling of the store policy, whatever the card brand or the Asaas account allows. */
export const CARD_INSTALLMENTS_MAX = 6;
/** 1x, 2x and 3x are always interest-free: the store absorbs the card cost (business rule). */
export const CARD_INSTALLMENTS_INTEREST_FREE = 3;
/** Admin guard rail against a typo (e.g. 80 instead of 8,0): at most 30% total surcharge. */
export const CARD_INSTALLMENT_MAX_SURCHARGE_BPS = 3_000;
/** Asaas refuses any credit card charge (each installment is one) below R$ 5,00 — proven in Sandbox. */
export const ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS = 500;
/** Store default for the smallest installment; the Admin may only make it stricter. */
export const DEFAULT_MIN_INSTALLMENT_IN_CENTS = 1_000;

export const SURCHARGED_INSTALLMENT_COUNTS = [4, 5, 6] as const;
export type SurchargedInstallmentCount = (typeof SURCHARGED_INSTALLMENT_COUNTS)[number];

export type CardInstallmentRules = {
  /** Effective switch: CARD_INSTALLMENTS_ENABLED (deploy) AND the Admin toggle. */
  enabled: boolean;
  maxInstallments: number;
  minInstallmentInCents: number;
  /** Total surcharge for each count, in basis points. null = that count is not offered. */
  surchargeBps: Record<SurchargedInstallmentCount, number | null>;
};

export type CardInstallmentPlan = {
  installmentCount: number;
  rateBps: number;
  baseTotalInCents: number;
  feeInCents: number;
  financedTotalInCents: number;
  /** Value of each installment as Asaas splits it: the first ones; the rounding remainder goes last. */
  installmentValueInCents: number;
  lastInstallmentValueInCents: number;
  interestFree: boolean;
};

export class CardInstallmentError extends Error {
  constructor(readonly code: "INVALID_COUNT" | "COUNT_NOT_OFFERED" | "BELOW_MINIMUM_INSTALLMENT" | "INVALID_BASE" | "DISABLED") {
    super(code);
    this.name = "CardInstallmentError";
  }
}

export const DISABLED_CARD_INSTALLMENT_RULES: CardInstallmentRules = {
  enabled: false,
  maxInstallments: 1,
  minInstallmentInCents: DEFAULT_MIN_INSTALLMENT_IN_CENTS,
  surchargeBps: { 4: null, 5: null, 6: null },
};

export function isValidSurchargeBps(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= CARD_INSTALLMENT_MAX_SURCHARGE_BPS;
}

/** Surcharge in cents, rounded half up, in integer arithmetic only. */
export function calculateSurchargeInCents(baseTotalInCents: number, rateBps: number) {
  return Math.floor((baseTotalInCents * rateBps + 5_000) / 10_000);
}

/** Rate the rules give one installment count, or null when that count is not offered at all. */
function rateFor(count: number, rules: CardInstallmentRules): number | null {
  if (count <= CARD_INSTALLMENTS_INTEREST_FREE) return 0;
  const rate = rules.surchargeBps[count as SurchargedInstallmentCount];
  return isValidSurchargeBps(rate) ? rate : null;
}

/**
 * THE single place where an installment plan is priced. The count is the only input the shopper
 * chooses; rate, surcharge, totals and installment values always come from here.
 */
export function calculateCardInstallmentPlan(baseTotalInCents: number, installmentCount: number, rules: CardInstallmentRules): CardInstallmentPlan {
  if (!Number.isSafeInteger(baseTotalInCents) || baseTotalInCents <= 0) throw new CardInstallmentError("INVALID_BASE");
  if (!Number.isSafeInteger(installmentCount) || installmentCount < 1 || installmentCount > CARD_INSTALLMENTS_MAX) throw new CardInstallmentError("INVALID_COUNT");
  if (installmentCount === 1) {
    // Today's card flow, unchanged: one charge, no surcharge, whatever the installment rules say.
    return { installmentCount: 1, rateBps: 0, baseTotalInCents, feeInCents: 0, financedTotalInCents: baseTotalInCents, installmentValueInCents: baseTotalInCents, lastInstallmentValueInCents: baseTotalInCents, interestFree: true };
  }
  if (!rules.enabled) throw new CardInstallmentError("DISABLED");
  // Effective ceiling: the Admin maximum, cut at the first count without a valid rate.
  if (installmentCount > maxOfferedInstallments(rules)) throw new CardInstallmentError("COUNT_NOT_OFFERED");
  const rateBps = rateFor(installmentCount, rules);
  if (rateBps === null) throw new CardInstallmentError("COUNT_NOT_OFFERED");
  const feeInCents = calculateSurchargeInCents(baseTotalInCents, rateBps);
  const financedTotalInCents = baseTotalInCents + feeInCents;
  const installmentValueInCents = Math.floor(financedTotalInCents / installmentCount);
  const lastInstallmentValueInCents = financedTotalInCents - installmentValueInCents * (installmentCount - 1);
  const minimum = Math.max(ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS, rules.minInstallmentInCents);
  if (installmentValueInCents < minimum) throw new CardInstallmentError("BELOW_MINIMUM_INSTALLMENT");
  return { installmentCount, rateBps, baseTotalInCents, feeInCents, financedTotalInCents, installmentValueInCents, lastInstallmentValueInCents, interestFree: rateBps === 0 };
}

/** Every plan the shopper may pick for this base total (1x always, then only the valid ones). */
export function listCardInstallmentPlans(baseTotalInCents: number, rules: CardInstallmentRules): CardInstallmentPlan[] {
  const plans: CardInstallmentPlan[] = [];
  for (let count = 1; count <= CARD_INSTALLMENTS_MAX; count += 1) {
    try {
      plans.push(calculateCardInstallmentPlan(baseTotalInCents, count, rules));
    } catch {
      // Not offered for this total (disabled, above the maximum, no rate, or below the minimum).
    }
  }
  return plans;
}

/**
 * Effective rules from the deploy flag and the stored Admin settings. Any stored value outside the
 * policy is treated as "not offered" instead of being trusted.
 */
export function resolveCardInstallmentRules(flagEnabled: boolean, settings: {
  cardInstallmentsEnabled?: boolean | null;
  cardInstallmentsMax?: number | null;
  cardInstallmentsMinInCents?: number | null;
  cardInstallment4xBps?: number | null;
  cardInstallment5xBps?: number | null;
  cardInstallment6xBps?: number | null;
} | null | undefined): CardInstallmentRules {
  if (!flagEnabled || !settings?.cardInstallmentsEnabled) return DISABLED_CARD_INSTALLMENT_RULES;
  const max = settings.cardInstallmentsMax;
  const min = settings.cardInstallmentsMinInCents;
  const rate = (value: number | null | undefined) => (isValidSurchargeBps(value) ? value : null);
  return {
    enabled: true,
    maxInstallments: Number.isSafeInteger(max) && (max as number) >= 1 && (max as number) <= CARD_INSTALLMENTS_MAX ? (max as number) : 1,
    minInstallmentInCents: Number.isSafeInteger(min) && (min as number) >= ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS ? (min as number) : DEFAULT_MIN_INSTALLMENT_IN_CENTS,
    surchargeBps: { 4: rate(settings.cardInstallment4xBps), 5: rate(settings.cardInstallment5xBps), 6: rate(settings.cardInstallment6xBps) },
  };
}

/** Highest count offered at all (ignoring the total), for short storefront copy. */
export function maxOfferedInstallments(rules: CardInstallmentRules) {
  if (!rules.enabled || !Number.isSafeInteger(rules.maxInstallments)) return 1;
  let best = 1;
  for (let count = 2; count <= Math.min(CARD_INSTALLMENTS_MAX, rules.maxInstallments); count += 1) {
    if (rateFor(count, rules) !== null) best = count;
    else break; // Never advertise "até 6x" with a hole in the middle.
  }
  return best;
}

export function maxInterestFreeInstallments(rules: CardInstallmentRules) {
  return Math.min(CARD_INSTALLMENTS_INTEREST_FREE, maxOfferedInstallments(rules));
}

/** "4x de R$ 25,00" / "4x de R$ 25,00 (última R$ 25,01)". */
export function formatInstallmentValue(plan: Pick<CardInstallmentPlan, "installmentCount" | "installmentValueInCents" | "lastInstallmentValueInCents">) {
  const base = `${plan.installmentCount}x de ${formatMoney(plan.installmentValueInCents)}`;
  return plan.lastInstallmentValueInCents !== plan.installmentValueInCents ? `${base} (última ${formatMoney(plan.lastInstallmentValueInCents)})` : base;
}

/** Shopper-facing line for one option: interest-free says so, surcharged ones always show the total. */
export function describeCardInstallmentPlan(plan: CardInstallmentPlan) {
  if (plan.installmentCount === 1) return `1x de ${formatMoney(plan.financedTotalInCents)} sem juros`;
  if (plan.interestFree) return `${formatInstallmentValue(plan)} sem juros`;
  return `${formatInstallmentValue(plan)} com acréscimo · Total ${formatMoney(plan.financedTotalInCents)}`;
}

/** Percentage text for bps (850 -> "8,5%"), used by Admin and order displays. */
export function formatBpsAsPercent(bps: number) {
  const value = (bps / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${value.replace(".", ",")}%`;
}

/** Parses an Admin percentage ("8", "8,5", "8.50%") into bps; null for empty; NaN for invalid. */
export function parsePercentToBps(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(/%$/, "").trim();
  if (!text) return null;
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(text)) return Number.NaN;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
