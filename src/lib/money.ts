export function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(cents / 100)
    .replace(/\s/g, "\u00a0");
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return 0;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function calculateShipping(subtotalInCents: number, manualShippingInCents: number, freeShippingMinInCents?: number | null) {
  if (freeShippingMinInCents && subtotalInCents >= freeShippingMinInCents) {
    return 0;
  }

  return Math.max(0, manualShippingInCents);
}
