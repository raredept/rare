import {
  CARD_INSTALLMENT_MAX_SURCHARGE_BPS,
  CARD_INSTALLMENTS_INTEREST_FREE,
  CARD_INSTALLMENTS_MAX,
  parsePercentToBps,
  parseSurchargeTable,
  STORE_MIN_INSTALLMENT_FLOOR_IN_CENTS,
  SURCHARGED_INSTALLMENT_COUNTS,
  type SurchargedInstallmentCount,
  type SurchargeTable,
} from "@/lib/card-installments";
import { parseMoneyToCents } from "@/lib/money";

// Admin form for card installments (Configurações → Pagamentos → Cartão de crédito). Pure: parses and
// validates the submitted values; the server action saves them and writes the audit log.
// 1x-3x are interest-free by rule and have no input at all; 4x-12x carry a TOTAL surcharge (%).

export type CardInstallmentSettingsInput = {
  cardInstallmentsEnabled: boolean;
  cardInstallmentsMax: number;
  cardInstallmentsMinInCents: number;
  /** Stored as JSON { "4": bps, ..., "12": bps }; null = not offered. */
  cardInstallmentSurchargesBps: Record<string, number | null>;
};

/** Upper bound for the minimum installment, against a typo such as 10000 instead of 100,00. */
export const MAX_MIN_INSTALLMENT_IN_CENTS = 100_000;

export type CardInstallmentSettingsErrorCode = "max" | "min" | `range-${SurchargedInstallmentCount}` | `missing-${SurchargedInstallmentCount}`;

export type CardInstallmentSettingsResult =
  | { ok: true; value: CardInstallmentSettingsInput }
  | { ok: false; code: CardInstallmentSettingsErrorCode };

/** Form field of each surcharged count ("rate4x" ... "rate12x"). */
export const surchargeFieldName = (count: SurchargedInstallmentCount) => `rate${count}x`;

/** Only fixed messages reach the page (the URL carries a code, never free text). */
export function cardInstallmentSettingsErrorMessage(code: string | null | undefined) {
  if (code === "max") return `O máximo de parcelas deve ficar entre 1x e ${CARD_INSTALLMENTS_MAX}x.`;
  if (code === "min") return "O valor mínimo por parcela deve ficar entre R$ 10,00 (mínimo da conta Asaas) e R$ 1.000,00.";
  const match = /^(range|missing)-(\d{1,2})$/.exec(code ?? "");
  const count = match ? Number(match[2]) : Number.NaN;
  if (!match || !(SURCHARGED_INSTALLMENT_COUNTS as readonly number[]).includes(count)) return null;
  return match[1] === "range"
    ? `O acréscimo de ${count}x deve ser um percentual entre 0% e ${CARD_INSTALLMENT_MAX_SURCHARGE_BPS / 100}%.`
    : `Defina o acréscimo de ${count}x ou reduza o máximo de parcelas para ${count - 1}x.`;
}

export function parseCardInstallmentSettings(form: { get(name: string): FormDataEntryValue | null }): CardInstallmentSettingsResult {
  const enabled = form.get("cardInstallmentsEnabled") === "on";
  const max = Number(String(form.get("cardInstallmentsMax") ?? ""));
  if (!Number.isSafeInteger(max) || max < 1 || max > CARD_INSTALLMENTS_MAX) return { ok: false, code: "max" };
  const minRaw = form.get("cardInstallmentsMin");
  const min = typeof minRaw === "string" && minRaw.trim() ? parseMoneyToCents(minRaw) : Number.NaN;
  if (!Number.isSafeInteger(min) || min < STORE_MIN_INSTALLMENT_FLOOR_IN_CENTS || min > MAX_MIN_INSTALLMENT_IN_CENTS) return { ok: false, code: "min" };
  const table: Record<string, number | null> = {};
  for (const count of SURCHARGED_INSTALLMENT_COUNTS) {
    const bps = parsePercentToBps(form.get(surchargeFieldName(count)));
    if (bps !== null && (!Number.isSafeInteger(bps) || bps < 0 || bps > CARD_INSTALLMENT_MAX_SURCHARGE_BPS)) return { ok: false, code: `range-${count}` };
    // Every count up to the maximum needs its own rate: no silent hole, no "até 12x" without 11x.
    if (count <= max && bps === null) return { ok: false, code: `missing-${count}` };
    // Rates above the maximum are kept (not offered while the maximum is lower).
    table[String(count)] = bps;
  }
  return { ok: true, value: { cardInstallmentsEnabled: enabled, cardInstallmentsMax: max, cardInstallmentsMinInCents: min, cardInstallmentSurchargesBps: table } };
}

/**
 * Audit view. The audit sanitizer drops any key containing "card" (defence against card data), so
 * these business fields use neutral names. No secret or personal data is involved here.
 */
export function cardInstallmentAuditView(settings: {
  cardInstallmentsEnabled?: boolean | null;
  cardInstallmentsMax?: number | null;
  cardInstallmentsMinInCents?: number | null;
  cardInstallmentSurchargesBps?: unknown;
} | null | undefined) {
  if (!settings) return null;
  const table: SurchargeTable = parseSurchargeTable(settings.cardInstallmentSurchargesBps);
  return {
    enabled: settings.cardInstallmentsEnabled ?? false,
    maxInstallments: settings.cardInstallmentsMax ?? null,
    interestFreeInstallments: CARD_INSTALLMENTS_INTEREST_FREE,
    minInstallmentInCents: settings.cardInstallmentsMinInCents ?? null,
    surchargesBps: Object.fromEntries(SURCHARGED_INSTALLMENT_COUNTS.map((count) => [`${count}x`, table[count]])),
  };
}
