import { isValidCep, normalizeCep as normalizeCepValue, parseCep } from "@/lib/cep";
import { assessProductShippingReadiness, type ProductShippingField } from "@/lib/product-shipping-readiness";

export const shippingProviders = ["manual", "correios", "melhor_envio", "frenet"] as const;
export const shippingModes = ["disabled", "manual", "fixed", "future_provider", "correios", "melhor_envio", "frenet"] as const;
export const shippingServiceCodes = ["PAC", "SEDEX"] as const;
export const fixedShippingOptionId = "fixed";
export const DEFAULT_SHIPPING_ORIGIN_CEP = "31170350";
export const MELHOR_ENVIO_DEFAULT_PRODUCTION_BASE_URL = "https://www.melhorenvio.com.br";
export const MELHOR_ENVIO_DEFAULT_SANDBOX_BASE_URL = "https://sandbox.melhorenvio.com.br";
export const MELHOR_ENVIO_DEFAULT_SERVICES = "1,2";
export const MELHOR_ENVIO_DEFAULT_TIMEOUT_MS = 8_000;

export type ShippingProvider = (typeof shippingProviders)[number];
export type ShippingMode = (typeof shippingModes)[number];
export type ShippingServiceCode = (typeof shippingServiceCodes)[number];
export type ShippingOptionProvider = ShippingProvider | "fixed";
export type ShippingOptionService = string;

export type ShippingPackageItem = {
  productId: string;
  title: string;
  quantity: number;
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  priceInCents?: number | null;
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
    priceInCents: number;
    usedFallbackWeight: boolean;
    usedFallbackDimensions: boolean;
    usedFallback: boolean;
  }>;
  usedFallbackWeight: boolean;
  usedFallbackDimensions: boolean;
  usedFallback: boolean;
};

export type ShippingOption = {
  id: string;
  provider: ShippingOptionProvider;
  service: ShippingOptionService;
  label: string;
  amountCents: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  deliveryEstimateText: string;
  originCep: string | null;
  destinationCep: string;
  expiresAt?: string;
  companyName?: string;
  rawServiceId?: string | number;
  raw?: unknown;
};

export type ShippingQuoteRequest = {
  provider?: ShippingProvider;
  originCep?: string | null;
  destinationCep: string;
  package: ShippingPackage;
  subtotalInCents?: number;
  freeShippingThresholdInCents?: number | null;
};

export type ShippingProviderResult = {
  options: ShippingOption[];
  warnings: string[];
};

export type FixedShippingQuoteRequest = {
  settings: ProvisionalShippingSettings;
  destinationCep: string;
  package: ShippingPackage;
  subtotalInCents?: number;
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

export const DEFAULT_PRODUCT_PACKAGE = {
  heightCm: 10,
  widthCm: 35,
  lengthCm: 35,
} as const;
export const DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS = 1000;
export const AUTOMATIC_SHIPPING_DATA_ERROR = "Esse produto ainda precisa de peso e medidas para calcular o frete.";

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
  const mode = normalizeShippingMode(settings?.shippingMode);
  if (mode === "disabled") return false;

  const envValue = clean(process.env.SHIPPING_ENABLED);
  if (envValue) {
    return !disabledValues.has(envValue.toLowerCase());
  }

  return true;
}

export function getConfiguredShippingProvider(settings?: ProvisionalShippingSettings | null): ShippingProvider {
  const mode = normalizeShippingMode(settings?.shippingMode);
  const modeProvider = normalizeShippingProvider(mode);
  if (modeProvider) return modeProvider;

  const envProvider = clean(process.env.SHIPPING_PROVIDER);
  if (envProvider) {
    const provider = normalizeShippingProvider(envProvider);
    if (!provider) {
      throw new Error("Provedor de frete inválido.");
    }
    return provider;
  }

  return "manual";
}

export function isFixedShippingModeActive(settings?: ProvisionalShippingSettings | null) {
  return normalizeShippingMode(settings?.shippingMode) === "fixed";
}

export function getConfiguredShippingOriginCep(settings?: ProvisionalShippingSettings | null) {
  const originCep = clean(settings?.originCep) ?? clean(process.env.SHIPPING_ORIGIN_CEP) ?? DEFAULT_SHIPPING_ORIGIN_CEP;
  return validateCep(originCep, "CEP de origem");
}

export function isUsingDefaultShippingOriginCep(settings?: ProvisionalShippingSettings | null) {
  return !clean(process.env.SHIPPING_ORIGIN_CEP) && !clean(settings?.originCep);
}

export function getShippingPublicConfig(settings?: ProvisionalShippingSettings | null) {
  const enabled = isShippingEnabled(settings);
  const mode = normalizeShippingMode(settings?.shippingMode);
  const fixedModeActive = isFixedShippingModeActive(settings);
  let provider: ShippingProvider = "manual";
  let originCepConfigured = false;

  if (!fixedModeActive) {
    try {
      provider = getConfiguredShippingProvider(settings);
    } catch {
      provider = "manual";
    }
  }

  if (!fixedModeActive && mode !== "disabled") {
    try {
      getConfiguredShippingOriginCep(settings);
      originCepConfigured = true;
    } catch {
      originCepConfigured = false;
    }
  }

  return {
    enabled,
    mode: mode === "disabled" ? mode : fixedModeActive ? "fixed" : provider,
    provider,
    originCepConfigured,
  };
}

export function getEffectiveFixedShippingInCents(settings: ProvisionalShippingSettings) {
  const fixed = settings.fixedShippingInCents ?? 0;
  if (fixed > 0) return fixed;
  return Math.max(0, settings.manualShippingInCents ?? 0);
}

export function getRequiredFixedShippingInCents(settings: ProvisionalShippingSettings) {
  const amount = getEffectiveFixedShippingInCents(settings);
  if (amount <= 0) {
    throw new Error("Configure um valor de frete fixo para habilitar o checkout.");
  }
  return amount;
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

function getVolumetricWeightGrams(lengthCm: number, widthCm: number, heightCm: number) {
  return Math.max(1, Math.ceil((lengthCm * widthCm * heightCm * 1000) / 6000));
}

function resolvePositiveInt(value: number | null | undefined, fallback: number) {
  const numeric = Number(value);
  return requirePositiveDimension(numeric) ? numeric : fallback;
}

export function buildPackageFromCart(items: ShippingPackageItem[]): ShippingPackage {
  if (!items.length) {
    throw new Error("Carrinho vazio.");
  }

  let weightGrams = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let stackedHeightCm = 0;
  let usedFallbackWeight = false;
  let usedFallbackDimensions = false;
  const normalizedItems: ShippingPackage["items"] = [];

  for (const item of items) {
    const readiness = assessProductShippingReadiness(item);
    const invalidFields = new Set(
      readiness.issues.filter((issue) => issue.severity === "error").map((issue) => issue.field),
    );
    const invalid = (field: ProductShippingField) => invalidFields.has(field);
    const itemUsedFallbackLength = invalid("lengthCm");
    const itemUsedFallbackWidth = invalid("widthCm");
    const itemUsedFallbackHeight = invalid("heightCm");
    const itemUsedFallbackWeight = invalid("weightGrams");
    const itemLengthCm = resolvePositiveInt(itemUsedFallbackLength ? null : item.lengthCm, DEFAULT_PRODUCT_PACKAGE.lengthCm);
    const itemWidthCm = resolvePositiveInt(itemUsedFallbackWidth ? null : item.widthCm, DEFAULT_PRODUCT_PACKAGE.widthCm);
    const itemHeightCm = resolvePositiveInt(itemUsedFallbackHeight ? null : item.heightCm, DEFAULT_PRODUCT_PACKAGE.heightCm);
    const itemWeightGrams = resolvePositiveInt(itemUsedFallbackWeight ? null : item.weightGrams, DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS);
    const itemUsedFallbackDimensions = itemUsedFallbackLength || itemUsedFallbackWidth || itemUsedFallbackHeight;

    const quantity = Math.max(1, item.quantity);
    const normalized = {
      productId: item.productId,
      title: item.title,
      quantity,
      weightGrams: itemWeightGrams,
      lengthCm: itemLengthCm,
      widthCm: itemWidthCm,
      heightCm: itemHeightCm,
      priceInCents: Math.max(0, Math.round(Number(item.priceInCents ?? 0))),
      usedFallbackWeight: itemUsedFallbackWeight,
      usedFallbackDimensions: itemUsedFallbackDimensions,
      usedFallback: itemUsedFallbackWeight || itemUsedFallbackDimensions,
    };
    normalizedItems.push(normalized);
    usedFallbackWeight ||= itemUsedFallbackWeight;
    usedFallbackDimensions ||= itemUsedFallbackDimensions;
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
    usedFallbackWeight,
    usedFallbackDimensions,
    usedFallback: usedFallbackWeight || usedFallbackDimensions,
  };
}

function getBillableWeightKg(pkg: ShippingPackage) {
  const volumetricWeightGrams = getVolumetricWeightGrams(pkg.lengthCm, pkg.widthCm, pkg.heightCm);
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
    warnings: [
      "Frete em modo manual/fallback. Ative um provedor real por variáveis de ambiente para produção.",
      ...(request.package.usedFallback
        ? ["Pacote calculado com fallback explícito porque há produto sem peso ou dimensões válidas."]
        : []),
    ],
  };
}

export function getFixedShippingQuotes(request: FixedShippingQuoteRequest): ShippingProviderResult {
  const destinationCep = validateCep(request.destinationCep, "CEP de destino");
  const threshold = getEffectiveFreeShippingThresholdInCents(request.settings);
  const freeShippingApplied = Boolean(
    threshold && request.subtotalInCents && request.subtotalInCents >= threshold,
  );
  const amountCents = freeShippingApplied ? 0 : getRequiredFixedShippingInCents(request.settings);

  return {
    options: [
      {
        id: fixedShippingOptionId,
        provider: "fixed",
        service: "fixed",
        label: freeShippingApplied ? "Frete grátis" : "Frete fixo",
        amountCents,
        deliveryEstimateText: freeShippingApplied
          ? "Entrega combinada com frete grátis para este pedido."
          : "Entrega combinada com valor fixo para este pedido.",
        originCep: null,
        destinationCep,
        raw: {
          mode: "fixed",
          freeShippingApplied,
          freeShippingThresholdInCents: threshold ?? null,
          package: {
            weightGrams: request.package.weightGrams,
            lengthCm: request.package.lengthCm,
            widthCm: request.package.widthCm,
            heightCm: request.package.heightCm,
          },
        },
      },
    ],
    warnings: [],
  };
}

type MelhorEnvioRawQuote = {
  id?: string | number | null;
  name?: string | null;
  price?: string | number | null;
  custom_price?: string | number | null;
  customPrice?: string | number | null;
  delivery_time?: string | number | null;
  custom_delivery_time?: string | number | null;
  customDeliveryTime?: string | number | null;
  company?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
  error?: unknown;
};

function getMelhorEnvioToken() {
  const token = clean(process.env.MELHOR_ENVIO_TOKEN) ?? clean(process.env.MELHOR_ENVIO_ACCESS_TOKEN);
  if (token) return token;

  if (clean(process.env.MELHOR_ENVIO_CLIENT_ID) || clean(process.env.MELHOR_ENVIO_CLIENT_SECRET)) {
    throw new Error("Configure MELHOR_ENVIO_TOKEN ou finalize a autorização OAuth do Melhor Envio.");
  }

  throw new Error("Configure MELHOR_ENVIO_TOKEN para calcular o frete automaticamente.");
}

export function getMelhorEnvioBaseUrl() {
  const configured = clean(process.env.MELHOR_ENVIO_BASE_URL);
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return configured.replace(/\/$/, "");
    } catch {
      throw new Error("MELHOR_ENVIO_BASE_URL inválida.");
    }
  }

  const env = clean(process.env.MELHOR_ENVIO_ENV)?.toLowerCase();
  if (env === "sandbox") return MELHOR_ENVIO_DEFAULT_SANDBOX_BASE_URL;
  if (env && env !== "production") throw new Error("MELHOR_ENVIO_ENV deve ser production ou sandbox.");
  return MELHOR_ENVIO_DEFAULT_PRODUCTION_BASE_URL;
}

function getMelhorEnvioTimeoutMs() {
  const configured = Number(clean(process.env.MELHOR_ENVIO_TIMEOUT_MS) ?? MELHOR_ENVIO_DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(configured) || configured < 1_000 || configured > 30_000) {
    throw new Error("MELHOR_ENVIO_TIMEOUT_MS deve estar entre 1000 e 30000.");
  }
  return configured;
}

function getMelhorEnvioUserAgent() {
  return clean(process.env.MELHOR_ENVIO_USER_AGENT) ?? "RARE Store (raredept.com.br)";
}

function parseDecimal(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = clean(value);
  if (!trimmed) return null;

  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePriceInCents(value: string | number | null | undefined) {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;
  return Math.round(parsed * 100);
}

function parseDeliveryDays(value: string | number | null | undefined) {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed < 0) return null;
  return Math.max(1, Math.ceil(parsed));
}

function centsToReais(cents: number) {
  return Math.max(0, Math.round(cents)) / 100;
}

function gramsToKg(grams: number) {
  return Math.max(0.001, Math.round((grams / 1000) * 1000) / 1000);
}

function buildMelhorEnvioPayload(request: ShippingQuoteRequest, originCep: string, destinationCep: string) {
  return {
    from: {
      postal_code: originCep,
    },
    to: {
      postal_code: destinationCep,
    },
    products: request.package.items.map((item) => ({
      id: item.productId,
      width: item.widthCm,
      height: item.heightCm,
      length: item.lengthCm,
      weight: gramsToKg(item.weightGrams),
      insurance_value: centsToReais(item.priceInCents),
      quantity: item.quantity,
    })),
    options: {
      receipt: false,
      own_hand: false,
    },
    services: clean(process.env.MELHOR_ENVIO_SERVICES) ?? MELHOR_ENVIO_DEFAULT_SERVICES,
  };
}

function normalizeMelhorEnvioQuotes(params: {
  quotes: MelhorEnvioRawQuote[];
  originCep: string;
  destinationCep: string;
  request: ShippingQuoteRequest;
}) {
  const threshold = params.request.freeShippingThresholdInCents ?? null;
  const freeShippingApplied = Boolean(
    threshold && params.request.subtotalInCents && params.request.subtotalInCents >= threshold,
  );

  return params.quotes.flatMap<ShippingOption>((quote) => {
    if (!quote || quote.error) return [];

    const rawServiceId = quote.id ?? quote.name ?? null;
    const service = rawServiceId === null || rawServiceId === undefined ? null : String(rawServiceId);
    const priceInCents = parsePriceInCents(quote.custom_price ?? quote.customPrice ?? quote.price);
    if (!service || priceInCents === null || priceInCents <= 0) return [];

    const amountCents = freeShippingApplied ? 0 : priceInCents;
    const deliveryDays = parseDeliveryDays(quote.custom_delivery_time ?? quote.customDeliveryTime ?? quote.delivery_time);
    const companyName = clean(quote.company?.name);
    const serviceName = clean(quote.name) ?? `Serviço ${service}`;
    const label = companyName && !serviceName.toLowerCase().includes(companyName.toLowerCase())
      ? `${companyName} ${serviceName}`
      : serviceName;

    return [
      {
        id: `melhor_envio:${service}`,
        provider: "melhor_envio",
        service,
        label,
        amountCents,
        estimatedDaysMin: deliveryDays ?? undefined,
        estimatedDaysMax: deliveryDays ?? undefined,
        deliveryEstimateText: deliveryDays
          ? `Prazo estimado em até ${deliveryDays} dias úteis`
          : "Prazo estimado informado pela transportadora.",
        originCep: params.originCep,
        destinationCep: params.destinationCep,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        companyName,
        rawServiceId: quote.id ?? service,
        raw: {
          provider: "melhor_envio",
          serviceId: quote.id ?? service,
          company: quote.company ?? null,
          serviceName,
          priceInCents,
          freeShippingApplied,
          freeShippingThresholdInCents: threshold,
          usedFallbackWeight: params.request.package.usedFallbackWeight,
          usedFallbackDimensions: params.request.package.usedFallbackDimensions,
        },
      },
    ];
  });
}

export async function getCorreiosShippingQuotes(): Promise<ShippingProviderResult> {
  if (!clean(process.env.CORREIOS_USER) || !clean(process.env.CORREIOS_TOKEN)) {
    throw new Error("Frete Correios precisa de CORREIOS_USER e CORREIOS_TOKEN configurados.");
  }
  throw new Error("Provider Correios preparado, mas a integração externa ainda não está ativada nesta versão.");
}

export async function getMelhorEnvioShippingQuotes(request: ShippingQuoteRequest): Promise<ShippingProviderResult> {
  const token = getMelhorEnvioToken();
  const originCep = validateCep(request.originCep, "CEP de origem");
  let destinationCep: string;
  try {
    destinationCep = validateCep(request.destinationCep, "CEP de destino");
  } catch {
    throw new Error("Informe um CEP válido para calcular o frete.");
  }
  const baseUrl = getMelhorEnvioBaseUrl();
  const endpoint = `${baseUrl}/api/v2/me/shipment/calculate`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": getMelhorEnvioUserAgent(),
      },
      body: JSON.stringify(buildMelhorEnvioPayload(request, originCep, destinationCep)),
      signal: AbortSignal.timeout(getMelhorEnvioTimeoutMs()),
    });
  } catch {
    throw new Error("Frete indisponível no momento. Tente novamente em alguns instantes.");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Não foi possível autenticar no Melhor Envio. Verifique o token.");
  }

  if (response.status === 422) {
    throw new Error("Não foi possível calcular o frete com os dados informados.");
  }

  if (!response.ok) {
    throw new Error("Frete indisponível no momento. Tente novamente em alguns instantes.");
  }

  const rawQuotes = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];
  const options = normalizeMelhorEnvioQuotes({
    quotes: rawQuotes as MelhorEnvioRawQuote[],
    originCep,
    destinationCep,
    request,
  });

  if (!options.length) {
    throw new Error("Nenhuma opção de frete disponível para este CEP.");
  }

  const warnings = request.package.usedFallback
    ? ["Cotação Melhor Envio usou fallback controlado de peso/dimensões para produto sem dados completos."]
    : [];

  return { options, warnings };
}

export async function getFrenetShippingQuotes(): Promise<ShippingProviderResult> {
  if (!clean(process.env.FRENET_TOKEN)) {
    throw new Error("Frete Frenet precisa de FRENET_TOKEN configurado.");
  }
  throw new Error("Provider Frenet preparado, mas a integração externa ainda não está ativada nesta versão.");
}

export async function getShippingQuotes(request: ShippingQuoteRequest): Promise<ShippingProviderResult> {
  const provider = request.provider ?? "manual";

  if (provider !== "manual" && request.package.usedFallback) {
    throw new Error(AUTOMATIC_SHIPPING_DATA_ERROR);
  }

  if (provider === "manual") return getManualShippingQuotes(request);
  if (provider === "correios") return getCorreiosShippingQuotes();
  if (provider === "melhor_envio") return getMelhorEnvioShippingQuotes(request);
  return getFrenetShippingQuotes();
}

export function formatShippingLabel(option: ShippingOption) {
  if (option.provider === "fixed" || option.provider === "melhor_envio") {
    return `${option.label} — ${option.deliveryEstimateText}`;
  }
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
      usedFallbackWeight: pkg.usedFallbackWeight,
      usedFallbackDimensions: pkg.usedFallbackDimensions,
      usedFallback: pkg.usedFallback,
      items: pkg.items,
    },
    quotedAt: quotedAt.toISOString(),
    expiresAt: option.expiresAt ?? null,
    raw: option.raw ?? null,
  };
}
