import { isValidCep, normalizeCep as normalizeCepValue, parseCep } from "@/lib/cep";

export const shippingProviders = ["manual", "correios", "melhor_envio", "frenet"] as const;
export const shippingModes = ["disabled", "manual", "fixed", "future_provider", "correios", "melhor_envio", "frenet"] as const;
export const shippingServiceCodes = ["PAC", "SEDEX"] as const;

export type ShippingProvider = (typeof shippingProviders)[number];
export type ShippingMode = (typeof shippingModes)[number];
export type ShippingServiceCode = (typeof shippingServiceCodes)[number];

export type ShippingPackageItem = {
  productId: string;
  title: string;
  quantity: number;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

export type ShippingPackage = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  items: Array<{
    productId: string;
    title: string;
    quantity: number;
    weightGrams: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  }>;
};

export type ShippingOption = {
  id: string;
  provider: ShippingProvider;
  service: ShippingServiceCode;
  label: string;
  amountCents: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  deliveryEstimateText: string;
  originCep: string;
  destinationCep: string;
  expiresAt?: string;
  raw?: unknown;
};

export type ShippingQuoteRequest = {
  provider?: ShippingProvider;
  originCep: string;
  destinationCep: string;
  package: ShippingPackage;
  subtotalInCents?: number;
  freeShippingThresholdInCents?: number | null;
};

export type ShippingProviderResult = {
  options: ShippingOption[];
  warnings: string[];
};

export type ProvisionalShippingSettings = {
  shippingMode?: string | null;
  manualShippingInCents?: number | null;
  fixedShippingInCents?: number | null;
  freeShippingMinInCents?: number | null;
  freeShippingThresholdInCents?: number | null;
  checkoutRequiresAddress?: boolean | null;
  originCep?: string | null;
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

const disabledValues = new Set(["0", "false", "off", "disabled", "no"]);

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = clean(process.env[name]);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function normalizeCep(value: string | null | undefined) {
  return normalizeCepValue(value);
}

export function validateCep(value: string | null | undefined, label = "CEP") {
  const cep = parseCep(value);
  if (!cep) {
    throw new Error(`${label} inválido.`);
  }
  return cep;
}

export function normalizeShippingMode(value: string | null | undefined): ShippingMode {
  return shippingModes.includes(value as ShippingMode) ? (value as ShippingMode) : "fixed";
}

export function normalizeShippingProvider(value: string | null | undefined): ShippingProvider | null {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return null;
  return shippingProviders.includes(normalized as ShippingProvider) ? (normalized as ShippingProvider) : null;
}

export function isShippingEnabled(settings?: ProvisionalShippingSettings | null) {
  const envValue = clean(process.env.SHIPPING_ENABLED);
  if (envValue) {
    return !disabledValues.has(envValue.toLowerCase());
  }

  return normalizeShippingMode(settings?.shippingMode) !== "disabled";
}

export function getConfiguredShippingProvider(settings?: ProvisionalShippingSettings | null): ShippingProvider {
  const envProvider = clean(process.env.SHIPPING_PROVIDER);
  if (envProvider) {
    const provider = normalizeShippingProvider(envProvider);
    if (!provider) {
      throw new Error("Provedor de frete inválido.");
    }
    return provider;
  }

  const mode = normalizeShippingMode(settings?.shippingMode);
  if (normalizeShippingProvider(mode)) return mode as ShippingProvider;
  return "manual";
}

export function getConfiguredShippingOriginCep(settings?: ProvisionalShippingSettings | null) {
  const originCep = clean(process.env.SHIPPING_ORIGIN_CEP) ?? clean(settings?.originCep);
  if (!originCep) {
    throw new Error("Configure o CEP de origem da loja para calcular o frete.");
  }
  return validateCep(originCep, "CEP de origem");
}

export function getShippingPublicConfig(settings?: ProvisionalShippingSettings | null) {
  const enabled = isShippingEnabled(settings);
  let provider: ShippingProvider = "manual";
  let originCepConfigured = false;

  try {
    provider = getConfiguredShippingProvider(settings);
  } catch {
    provider = "manual";
  }

  try {
    getConfiguredShippingOriginCep(settings);
    originCepConfigured = true;
  } catch {
    originCepConfigured = false;
  }

  return {
    enabled,
    provider,
    originCepConfigured,
  };
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

  if (["future_provider", "correios", "melhor_envio", "frenet"].includes(mode)) {
    throw new Error("Escolha uma opção de entrega para continuar.");
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

function requirePositiveDimension(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function buildPackageFromCart(items: ShippingPackageItem[]): ShippingPackage {
  if (!items.length) {
    throw new Error("Carrinho vazio.");
  }

  let weightGrams = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let stackedHeightCm = 0;
  const normalizedItems: ShippingPackage["items"] = [];

  for (const item of items) {
    const itemWeightGrams = Number(item.weightGrams);
    const itemLengthCm = Number(item.lengthCm);
    const itemWidthCm = Number(item.widthCm);
    const itemHeightCm = Number(item.heightCm);

    if (
      !requirePositiveDimension(itemWeightGrams) ||
      !requirePositiveDimension(itemLengthCm) ||
      !requirePositiveDimension(itemWidthCm) ||
      !requirePositiveDimension(itemHeightCm)
    ) {
      throw new Error("Esse produto ainda precisa de peso e medidas para calcular o frete.");
    }

    const quantity = Math.max(1, item.quantity);
    const normalized = {
      productId: item.productId,
      title: item.title,
      quantity,
      weightGrams: itemWeightGrams,
      lengthCm: itemLengthCm,
      widthCm: itemWidthCm,
      heightCm: itemHeightCm,
    };
    normalizedItems.push(normalized);
    weightGrams += normalized.weightGrams * quantity;
    lengthCm = Math.max(lengthCm, normalized.lengthCm);
    widthCm = Math.max(widthCm, normalized.widthCm);
    stackedHeightCm += normalized.heightCm * quantity;
  }

  return {
    weightGrams,
    lengthCm,
    widthCm,
    heightCm: Math.max(1, stackedHeightCm),
    items: normalizedItems,
  };
}

function getBillableWeightKg(pkg: ShippingPackage) {
  const volumetricWeightGrams = Math.ceil((pkg.lengthCm * pkg.widthCm * pkg.heightCm * 1000) / 6000);
  return Math.max(1, Math.ceil(Math.max(pkg.weightGrams, volumetricWeightGrams) / 1000));
}

function getDestinationSurcharge(originCep: string, destinationCep: string, service: ShippingServiceCode) {
  const sameRegion = originCep[0] === destinationCep[0];
  const adjacentRegion = Math.abs(Number(originCep[0]) - Number(destinationCep[0])) <= 2;

  if (sameRegion) return service === "PAC" ? 0 : 200;
  if (adjacentRegion) return service === "PAC" ? 500 : 800;
  return service === "PAC" ? 900 : 1300;
}

function buildManualOption(params: {
  service: ShippingServiceCode;
  originCep: string;
  destinationCep: string;
  pkg: ShippingPackage;
  baseCents: number;
  perKgCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}): ShippingOption {
  const billableWeightKg = getBillableWeightKg(params.pkg);
  const amountCents =
    params.baseCents +
    Math.max(0, billableWeightKg - 1) * params.perKgCents +
    getDestinationSurcharge(params.originCep, params.destinationCep, params.service);

  return {
    id: `manual:${params.service}`,
    provider: "manual",
    service: params.service,
    label: `${params.service} - cálculo manual`,
    amountCents,
    estimatedDaysMin: params.estimatedDaysMin,
    estimatedDaysMax: params.estimatedDaysMax,
    deliveryEstimateText:
      params.estimatedDaysMin === params.estimatedDaysMax
        ? `Chega em até ${params.estimatedDaysMax} dias úteis`
        : `Chega em ${params.estimatedDaysMin} a ${params.estimatedDaysMax} dias úteis`,
    originCep: params.originCep,
    destinationCep: params.destinationCep,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    raw: {
      fallback: true,
      billableWeightKg,
      baseCents: params.baseCents,
      perKgCents: params.perKgCents,
    },
  };
}

export async function getManualShippingQuotes(request: ShippingQuoteRequest): Promise<ShippingProviderResult> {
  const originCep = validateCep(request.originCep, "CEP de origem");
  const destinationCep = validateCep(request.destinationCep, "CEP de destino");
  const pacBaseCents = readPositiveIntEnv("MANUAL_SHIPPING_PAC_BASE_CENTS", 1990);
  const pacPerKgCents = readPositiveIntEnv("MANUAL_SHIPPING_PAC_PER_KG_CENTS", 650);
  const sedexBaseCents = readPositiveIntEnv("MANUAL_SHIPPING_SEDEX_BASE_CENTS", 2990);
  const sedexPerKgCents = readPositiveIntEnv("MANUAL_SHIPPING_SEDEX_PER_KG_CENTS", 1000);
  const freeShippingApplied = Boolean(
    request.freeShippingThresholdInCents && request.subtotalInCents && request.subtotalInCents >= request.freeShippingThresholdInCents,
  );
  const options = [
    buildManualOption({
      service: "PAC",
      originCep,
      destinationCep,
      pkg: request.package,
      baseCents: pacBaseCents,
      perKgCents: pacPerKgCents,
      estimatedDaysMin: readPositiveIntEnv("MANUAL_SHIPPING_PAC_DAYS_MIN", 5),
      estimatedDaysMax: readPositiveIntEnv("MANUAL_SHIPPING_PAC_DAYS_MAX", 9),
    }),
    buildManualOption({
      service: "SEDEX",
      originCep,
      destinationCep,
      pkg: request.package,
      baseCents: sedexBaseCents,
      perKgCents: sedexPerKgCents,
      estimatedDaysMin: readPositiveIntEnv("MANUAL_SHIPPING_SEDEX_DAYS_MIN", 2),
      estimatedDaysMax: readPositiveIntEnv("MANUAL_SHIPPING_SEDEX_DAYS_MAX", 5),
    }),
  ].map((option) =>
    freeShippingApplied
      ? {
          ...option,
          label: `${option.service} - frete grátis`,
          amountCents: 0,
          raw: {
            ...(typeof option.raw === "object" && option.raw ? option.raw : {}),
            freeShippingApplied: true,
            freeShippingThresholdInCents: request.freeShippingThresholdInCents,
          },
        }
      : option,
  );

  return {
    options,
    warnings: ["Frete em modo manual/fallback. Ative um provedor real por variáveis de ambiente para produção."],
  };
}

export async function getCorreiosShippingQuotes(): Promise<ShippingProviderResult> {
  if (!clean(process.env.CORREIOS_USER) || !clean(process.env.CORREIOS_TOKEN)) {
    throw new Error("Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.");
  }
  throw new Error("Provider Correios preparado, mas a integração externa ainda não está ativada nesta versão.");
}

export async function getMelhorEnvioShippingQuotes(): Promise<ShippingProviderResult> {
  if (!clean(process.env.MELHOR_ENVIO_TOKEN)) {
    throw new Error("Frete Melhor Envio precisa de MELHOR_ENVIO_TOKEN configurado.");
  }
  throw new Error("Provider Melhor Envio preparado, mas a integração externa ainda não está ativada nesta versão.");
}

export async function getFrenetShippingQuotes(): Promise<ShippingProviderResult> {
  if (!clean(process.env.FRENET_TOKEN)) {
    throw new Error("Frete Frenet precisa de FRENET_TOKEN configurado.");
  }
  throw new Error("Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.");
}

export async function getShippingQuotes(request: ShippingQuoteRequest): Promise<ShippingProviderResult> {
  const provider = request.provider ?? "manual";

  if (provider === "manual") return getManualShippingQuotes(request);
  if (provider === "correios") return getCorreiosShippingQuotes();
  if (provider === "melhor_envio") return getMelhorEnvioShippingQuotes();
  return getFrenetShippingQuotes();
}

export function formatShippingLabel(option: ShippingOption) {
  return `${option.service} — ${option.deliveryEstimateText}`;
}

export function findShippingOption(options: ShippingOption[], optionId: string | null | undefined) {
  if (!optionId) return null;
  return options.find((option) => option.id === optionId) ?? null;
}

export function buildShippingQuoteSnapshot(option: ShippingOption, pkg: ShippingPackage, quotedAt = new Date()) {
  return {
    provider: option.provider,
    service: option.service,
    label: option.label,
    amountCents: option.amountCents,
    estimatedDaysMin: option.estimatedDaysMin ?? null,
    estimatedDaysMax: option.estimatedDaysMax ?? null,
    deliveryEstimateText: option.deliveryEstimateText,
    originCep: option.originCep,
    destinationCep: option.destinationCep,
    package: {
      weightGrams: pkg.weightGrams,
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
      items: pkg.items,
    },
    quotedAt: quotedAt.toISOString(),
    expiresAt: option.expiresAt ?? null,
    raw: option.raw ?? null,
  };
}
