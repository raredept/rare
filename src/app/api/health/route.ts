import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";
import { validateEnvironment } from "@/lib/env";
import { getRateLimitStatus } from "@/lib/rate-limit-config";
import {
  DEFAULT_PRODUCT_PACKAGE,
  DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
  DEFAULT_SHIPPING_ORIGIN_CEP,
  getEffectiveFixedShippingInCents,
  normalizeShippingMode,
  normalizeShippingProvider,
} from "@/lib/shipping";
import { getProductShippingNotReadyWhere } from "@/lib/product-shipping-readiness-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "ok_with_warnings" | "error";
const disabledValues = new Set(["0", "false", "off", "disabled", "no"]);

type StoreSettingsShippingRecord = {
  shippingMode: string | null;
  originCep: string | null;
  fixedShippingInCents: number | null;
  manualShippingInCents: number | null;
  freeShippingMinInCents: number | null;
  freeShippingThresholdInCents: number | null;
};

type ProductShippingDimensionsSummary = {
  checked: boolean;
  activeProductsMissingDimensions: number | null;
  fallbackWeightGrams: number;
  fallbackDimensionsCm: {
    height: number;
    width: number;
    length: number;
  };
  warnings: string[];
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getShippingEnvironmentSummary() {
  const enabledValue = clean(process.env.SHIPPING_ENABLED);
  const provider = clean(process.env.SHIPPING_PROVIDER) ?? null;
  const melhorEnvioEnv = clean(process.env.MELHOR_ENVIO_ENV)?.toLowerCase() ?? "production";
  const melhorEnvioTokenConfigured = Boolean(clean(process.env.MELHOR_ENVIO_TOKEN) || clean(process.env.MELHOR_ENVIO_ACCESS_TOKEN));
  const melhorEnvioOAuthClientConfigured = Boolean(clean(process.env.MELHOR_ENVIO_CLIENT_ID) || clean(process.env.MELHOR_ENVIO_CLIENT_SECRET));

  return {
    checked: true,
    enabled: enabledValue ? !disabledValues.has(enabledValue.toLowerCase()) : null,
    provider,
    originCepConfigured: Boolean(clean(process.env.SHIPPING_ORIGIN_CEP)),
    melhorEnvio: {
      environment: melhorEnvioEnv === "sandbox" ? "sandbox" : "production",
      baseUrlConfigured: Boolean(clean(process.env.MELHOR_ENVIO_BASE_URL)),
      tokenConfigured: melhorEnvioTokenConfigured,
      oauthClientConfigured: melhorEnvioOAuthClientConfigured,
    },
  };
}

function getStoreSettingsShippingSummary(settings: StoreSettingsShippingRecord | null, productDimensions: ProductShippingDimensionsSummary) {
  if (!settings) {
    return {
      checked: true,
      found: false,
      enabled: null,
      mode: null,
      provider: null,
      effectiveProvider: normalizeShippingProvider(process.env.SHIPPING_PROVIDER) ?? null,
      originCepConfigured: null,
      originCepFallbackActive: null,
      fixedShippingConfigured: null,
      warnings: ["Store settings row was not found."],
    };
  }

  const mode = normalizeShippingMode(settings.shippingMode);
  const fixedModeActive = mode === "fixed";
  const provider = normalizeShippingProvider(mode) ?? (fixedModeActive ? "fixed" : mode === "disabled" ? null : "manual");
  const effectiveProvider = provider === "fixed" ? null : provider;
  const enabled = mode !== "disabled";
  const originCepConfigured = Boolean(clean(process.env.SHIPPING_ORIGIN_CEP) || settings.originCep?.trim());
  const originCepFallbackActive = enabled && !fixedModeActive && !originCepConfigured;
  const fixedShippingConfigured = getEffectiveFixedShippingInCents(settings) > 0;
  const warnings: string[] = [];

  if (originCepFallbackActive) {
    warnings.push(`Origin CEP missing; fallback ${DEFAULT_SHIPPING_ORIGIN_CEP} is active.`);
  }

  if (fixedModeActive && !fixedShippingConfigured) {
    warnings.push("Store settings fixed shipping is enabled without a positive fixed/manual amount.");
  }

  if (fixedModeActive) {
    warnings.push("Fixed shipping mode is legacy/provisional and should not be the main production flow.");
  }

  if (effectiveProvider === "melhor_envio") {
    const tokenConfigured = Boolean(clean(process.env.MELHOR_ENVIO_TOKEN) || clean(process.env.MELHOR_ENVIO_ACCESS_TOKEN));
    if (!tokenConfigured) {
      warnings.push("SHIPPING_PROVIDER=melhor_envio requires MELHOR_ENVIO_TOKEN or MELHOR_ENVIO_ACCESS_TOKEN.");
    }
  }

  warnings.push(...productDimensions.warnings);

  return {
    checked: true,
    found: true,
    enabled,
    mode,
    provider,
    effectiveProvider,
    originCepConfigured,
    originCepFallbackActive,
    fixedShippingConfigured,
    warnings,
  };
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const env = validateEnvironment();
  const rateLimit = getRateLimitStatus();
  let database: { ok: boolean; message: string } = { ok: false, message: "Database check was not executed." };
  let storeSettingsShipping = {
    checked: false,
    found: null as boolean | null,
    enabled: null as boolean | null,
    mode: null as string | null,
    provider: null as string | null,
    effectiveProvider: null as string | null,
    originCepConfigured: null as boolean | null,
    originCepFallbackActive: null as boolean | null,
    fixedShippingConfigured: null as boolean | null,
    warnings: [] as string[],
  };
  let productShippingDimensions: ProductShippingDimensionsSummary = {
    checked: false,
    activeProductsMissingDimensions: null,
    fallbackWeightGrams: DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
    fallbackDimensionsCm: {
      height: DEFAULT_PRODUCT_PACKAGE.heightCm,
      width: DEFAULT_PRODUCT_PACKAGE.widthCm,
      length: DEFAULT_PRODUCT_PACKAGE.lengthCm,
    },
    warnings: [],
  };

  if (env.errors.some((issue) => issue.variable === "DATABASE_URL")) {
    database = { ok: false, message: "Database is not configured." };
  } else {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      const settings = await prisma.storeSettings.findUnique({
        where: { id: "store" },
        select: {
          shippingMode: true,
          originCep: true,
          fixedShippingInCents: true,
          manualShippingInCents: true,
          freeShippingMinInCents: true,
          freeShippingThresholdInCents: true,
        },
      });
      const activeProductsMissingDimensions = await prisma.product.count({
        where: {
          active: true,
          ...getProductShippingNotReadyWhere(),
        },
      });
      productShippingDimensions = {
        ...productShippingDimensions,
        checked: true,
        activeProductsMissingDimensions,
        warnings: activeProductsMissingDimensions
          ? [
              `${activeProductsMissingDimensions} active product(s) are not ready for automatic shipping; manual modes use fallback until Admin data is completed.`,
            ]
          : [],
      };
      storeSettingsShipping = getStoreSettingsShippingSummary(settings, productShippingDimensions);
      database = { ok: true, message: "Database connection ok." };
    } catch {
      database = { ok: false, message: "Database connection failed." };
    }
  }

  const operationalWarnings = storeSettingsShipping.warnings.map((message) => ({ scope: "shipping.storeSettings", message }));
  const status: HealthStatus =
    env.ok && database.ok ? (env.warnings.length || operationalWarnings.length ? "ok_with_warnings" : "ok") : "error";

  return response(
    {
      status,
      app: {
        ok: true,
        name: packageJson.name,
        version: packageJson.version,
      },
      database,
      environment: {
        nodeEnv: env.nodeEnv,
        checkoutEnabled: env.checkoutEnabled,
        storageDriver: env.storageDriver,
        rateLimit: {
          checked: true,
          configuredDriver: rateLimit.configuredDriver,
          activeDriver: rateLimit.activeDriver,
          activeTransport: rateLimit.activeTransport,
          shared: rateLimit.shared,
          redisRestUrlConfigured: rateLimit.redisRestUrlConfigured,
          redisRestTokenConfigured: rateLimit.redisRestTokenConfigured,
          redisTcpUrlConfigured: rateLimit.redisTcpUrlConfigured,
          warnings: rateLimit.warnings,
        },
        shipping: {
          env: getShippingEnvironmentSummary(),
          storeSettings: storeSettingsShipping,
          productDimensions: productShippingDimensions,
        },
      },
      configuration: {
        ok: env.ok,
        errors: env.errors.map((issue) => ({ variable: issue.variable, message: issue.message })),
        warnings: env.warnings.map((issue) => ({ variable: issue.variable, message: issue.message })),
      },
      operational: {
        summary: {
          checkout: env.checkoutEnabled ? "enabled" : "intentionally_disabled",
          email: clean(process.env.EMAIL_DRIVER)?.toLowerCase() === "disabled" || !clean(process.env.EMAIL_DRIVER)
            ? "intentionally_disabled"
            : "configured",
          melhorEnvio: storeSettingsShipping.effectiveProvider === "melhor_envio"
            ? (getShippingEnvironmentSummary().melhorEnvio.tokenConfigured ? "configured" : "missing_required_configuration")
            : "awaiting_explicit_activation",
          catalogShippingData: productShippingDimensions.checked
            ? { state: productShippingDimensions.activeProductsMissingDimensions ? "incomplete" : "ready", activeProductsNotReady: productShippingDimensions.activeProductsMissingDimensions }
            : { state: "not_checked", activeProductsNotReady: null },
          storage: env.storageDriver === "local" ? "local_development_only" : "persistent",
        },
        warnings: operationalWarnings,
      },
      timestamp: new Date().toISOString(),
    },
    200,
  );
}
