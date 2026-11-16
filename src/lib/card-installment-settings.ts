import {
  ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS,
  CARD_INSTALLMENT_MAX_SURCHARGE_BPS,
  CARD_INSTALLMENTS_INTEREST_FREE,
  CARD_INSTALLMENTS_MAX,
  parsePercentToBps,
} from "@/lib/card-installments";
import { parseMoneyToCents } from "@/lib/money";

// Admin form for card installments (Configurações → Pagamentos → Cartão de crédito). Pure: parses and
// validates the submitted values; the server action saves them and writes the audit log.

export type CardInstallmentSettingsInput = {
  cardInstallmentsEnabled: boolean;
  cardInstallmentsMax: number;
  cardInstallmentsMinInCents: number;
  cardInstallment4xBps: number | null;
  cardInstallment5xBps: number | null;
  cardInstallment6xBps: number | null;
};

/** Upper bound for the minimum installment, against a typo such as 10000 instead of 100,00. */
export const MAX_MIN_INSTALLMENT_IN_CENTS = 100_000;

export type CardInstallmentSettingsResult =
  | { ok: true; value: CardInstallmentSettingsInput }
  | { ok: false; code: CardInstallmentSettingsErrorCode };

export type CardInstallmentSettingsErrorCode = "max" | "min" | `range-${4 | 5 | 6}` | `missing-${4 | 5 | 6}`;

/** Only fixed messages reach the page (the URL carries a code, never free text). */
export function cardInstallmentSettingsErrorMessage(code: string | null | undefined) {
  switch (code) {
    case "max": return `O máximo de parcelas deve ficar entre 1x e ${CARD_INSTALLMENTS_MAX}x.`;
    case "min": return "O valor mínimo por parcela deve ficar entre R$ 5,00 (mínimo do Asaas) e R$ 1.000,00.";
    case "range-4": case "range-5": case "range-6":
      return `O acréscimo de ${code.slice(-1)}x deve ser um percentual entre 0% e ${CARD_INSTALLMENT_MAX_SURCHARGE_BPS / 100}%.`;
    case "missing-4": case "missing-5": case "missing-6": {
      const count = Number(code.slice(-1));
      return `Defina o acréscimo de ${count}x ou reduza o máximo de parcelas para ${count - 1}x.`;
    }
    default: return null;
  }
}

const RATE_FIELDS = [
  [4, "cardInstallment4xBps", "rate4x"],
  [5, "cardInstallment5xBps", "rate5x"],
  [6, "cardInstallment6xBps", "rate6x"],
] as const;

export function parseCardInstallmentSettings(form: { get(name: string): FormDataEntryValue | null }): CardInstallmentSettingsResult {
  const enabled = form.get("cardInstallmentsEnabled") === "on";
  const max = Number(String(form.get("cardInstallmentsMax") ?? ""));
  if (!Number.isSafeInteger(max) || max < 1 || max > CARD_INSTALLMENTS_MAX) {
    return { ok: false, code: "max" };
  }
  const minRaw = form.get("cardInstallmentsMin");
  const min = typeof minRaw === "string" && minRaw.trim() ? parseMoneyToCents(minRaw) : Number.NaN;
  if (!Number.isSafeInteger(min) || min < ASAAS_MIN_CARD_INSTALLMENT_IN_CENTS || min > MAX_MIN_INSTALLMENT_IN_CENTS) {
    return { ok: false, code: "min" };
  }
  const rates: Record<string, number | null> = {};
  for (const [count, key, field] of RATE_FIELDS) {
    const bps = parsePercentToBps(form.get(field));
    if (bps !== null && (!Number.isSafeInteger(bps) || bps < 0 || bps > CARD_INSTALLMENT_MAX_SURCHARGE_BPS)) {
      return { ok: false, code: `range-${count}` };
    }
    // Every count up to the maximum needs its own rate: no silent hole, no "até 6x" without 5x.
    if (count <= max && bps === null) {
      return { ok: false, code: `missing-${count}` };
    }
    // Rates above the maximum are kept (not offered while the maximum is lower).
    rates[key] = bps;
  }
  return {
    ok: true,
    value: {
      cardInstallmentsEnabled: enabled,
      cardInstallmentsMax: max,
      cardInstallmentsMinInCents: min,
      cardInstallment4xBps: rates.cardInstallment4xBps,
      cardInstallment5xBps: rates.cardInstallment5xBps,
      cardInstallment6xBps: rates.cardInstallment6xBps,
    },
  };
}

/**
 * Audit view. The audit sanitizer drops any key containing "card" (defence against card data), so
 * these business fields use neutral names. No secret or personal data is involved here.
 */
export function cardInstallmentAuditView(settings: Partial<CardInstallmentSettingsInput> | null | undefined) {
  if (!settings) return null;
  return {
    enabled: settings.cardInstallmentsEnabled ?? false,
    maxInstallments: settings.cardInstallmentsMax ?? null,
    interestFreeInstallments: CARD_INSTALLMENTS_INTEREST_FREE,
    minInstallmentInCents: settings.cardInstallmentsMinInCents ?? null,
    surcharge4xBps: settings.cardInstallment4xBps ?? null,
    surcharge5xBps: settings.cardInstallment5xBps ?? null,
    surcharge6xBps: settings.cardInstallment6xBps ?? null,
  };
}
