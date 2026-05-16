import { isValidCep, parseCep } from "@/lib/cep";

export const shippingModes = ["disabled", "manual", "fixed", "future_provider"] as const;

export type ShippingMode = (typeof shippingModes)[number];

export type ProvisionalShippingSettings = {
  shippingMode?: string | null;
  manualShippingInCents?: number | null;
  fixedShippingInCents?: number | null;
  freeShippingMinInCents?: number | null;
  freeShippingThresholdInCents?: number | null;
  checkoutRequiresAddress?: boolean | null;
};

export type ProvisionalShippingInput = {
  subtotalInCents: number;
  cep?: string | null;
  settings: ProvisionalShippingSettings;
};

export type ProvisionalShippingResult = {
  shippingInCents: number;
  shippingMethod: string;
  shippingCep: string | null;
  warnings: string[];
  metadata: {
    mode: ShippingMode;
    freeShippingApplied: boolean;
  };
};

export function normalizeShippingMode(value: string | null | undefined): ShippingMode {
  return shippingModes.includes(value as ShippingMode) ? (value as ShippingMode) : "fixed";
}

export function getEffectiveFixedShippingInCents(settings: ProvisionalShippingSettings) {
  const fixed = settings.fixedShippingInCents ?? 0;
  if (fixed > 0) return fixed;
  return Math.max(0, settings.manualShippingInCents ?? 0);
}

export function getEffectiveFreeShippingThresholdInCents(settings: ProvisionalShippingSettings) {
  return settings.freeShippingThresholdInCents ?? settings.freeShippingMinInCents ?? null;
}

export function calculateProvisionalShipping(input: ProvisionalShippingInput): ProvisionalShippingResult {
  const mode = normalizeShippingMode(input.settings.shippingMode);
  const addressRequired = input.settings.checkoutRequiresAddress ?? true;
  const shippingCep = parseCep(input.cep);
  const warnings: string[] = [];

  if (addressRequired && !isValidCep(input.cep)) {
    throw new Error("Informe um CEP válido para entrega.");
  }

  if (mode === "future_provider") {
    throw new Error("Frete real ainda não está integrado. Use frete manual, fixo ou desativado nas configurações.");
  }

  if (mode === "disabled") {
    warnings.push("Frete automático desativado; entrega combinada manualmente.");
    return {
      shippingInCents: 0,
      shippingMethod: "Entrega a combinar",
      shippingCep,
      warnings,
      metadata: {
        mode,
        freeShippingApplied: false,
      },
    };
  }

  const threshold = getEffectiveFreeShippingThresholdInCents(input.settings);
  if (threshold && input.subtotalInCents >= threshold) {
    return {
      shippingInCents: 0,
      shippingMethod: "Frete grátis",
      shippingCep,
      warnings,
      metadata: {
        mode,
        freeShippingApplied: true,
      },
    };
  }

  return {
    shippingInCents: getEffectiveFixedShippingInCents(input.settings),
    shippingMethod: mode === "manual" ? "Frete manual provisório" : "Frete fixo provisório",
    shippingCep,
    warnings,
    metadata: {
      mode,
      freeShippingApplied: false,
    },
  };
}
