import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import packageJson from "../package.json";
import { validateEnvironment } from "../src/lib/env";
import {
  DEFAULT_PRODUCT_PACKAGE,
  DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
  DEFAULT_SHIPPING_ORIGIN_CEP,
  normalizeShippingMode,
  normalizeShippingProvider,
} from "../src/lib/shipping";

type CheckResult = {
  label: string;
  ok: boolean;
  warning?: boolean;
  message: string;
};

const results: CheckResult[] = [];

function add(label: string, ok: boolean, message: string, warning = false) {
  results.push({ label, ok, message, warning });
}

function runPrismaValidate() {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "validate"], {
    stdio: "pipe",
    env: process.env,
  });
}

function checkGitIgnore(path: string) {
  execFileSync("git", ["check-ignore", "-q", path], {
    stdio: "pipe",
  });
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : "Unknown error.";
}

async function checkDatabase() {
  try {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    const [settings, activeProductsMissingDimensions] = await Promise.all([
      prisma.storeSettings.findUnique({
        where: { id: "store" },
        select: {
          shippingMode: true,
          originCep: true,
          fixedShippingInCents: true,
          manualShippingInCents: true,
        },
      }),
      prisma.product.count({
        where: {
          active: true,
          OR: [
            { weightGrams: null },
            { lengthCm: null },
            { widthCm: null },
            { heightCm: null },
            { weightGrams: { lte: 0 } },
            { lengthCm: { lte: 0 } },
            { widthCm: { lte: 0 } },
            { heightCm: { lte: 0 } },
          ],
        },
      }),
    ]);

    const mode = normalizeShippingMode(settings?.shippingMode);
    const envProvider = normalizeShippingProvider(process.env.SHIPPING_PROVIDER);
    const effectiveProvider = envProvider ?? normalizeShippingProvider(mode) ?? (mode === "fixed" ? "fixed" : mode === "disabled" ? null : "manual");
    const originCepConfigured = Boolean(process.env.SHIPPING_ORIGIN_CEP?.trim() || settings?.originCep?.trim());
    if (mode === "fixed" && !envProvider) {
      add("shipping mode", true, "Frete fixo esta ativo como modo legado/provisorio; fluxo principal deve ser provider automatico.", true);
    }
    if (effectiveProvider === "melhor_envio") {
      const hasToken = Boolean(process.env.MELHOR_ENVIO_TOKEN?.trim() || process.env.MELHOR_ENVIO_ACCESS_TOKEN?.trim());
      const hasOAuthClient = Boolean(process.env.MELHOR_ENVIO_CLIENT_ID?.trim() || process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim());
      add(
        "shipping:melhor_envio",
        hasToken,
        hasToken
          ? `Melhor Envio configurado por token (${(process.env.MELHOR_ENVIO_ENV || "production").trim() || "production"}).`
          : hasOAuthClient
            ? "Configure MELHOR_ENVIO_TOKEN ou finalize a autorizacao OAuth do Melhor Envio."
            : "MELHOR_ENVIO_TOKEN ou MELHOR_ENVIO_ACCESS_TOKEN ausente para SHIPPING_PROVIDER=melhor_envio.",
        !hasToken,
      );
    }
    if (effectiveProvider && effectiveProvider !== "fixed" && !originCepConfigured) {
      add("shipping:originCep", true, `originCep ausente; fallback ${DEFAULT_SHIPPING_ORIGIN_CEP} sera usado.`, true);
    }
    if (activeProductsMissingDimensions > 0) {
      add(
        "shipping:dimensions",
        true,
        `${activeProductsMissingDimensions} produto(s) ativo(s) usam fallback ${DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS}g e ${DEFAULT_PRODUCT_PACKAGE.heightCm}x${DEFAULT_PRODUCT_PACKAGE.widthCm}x${DEFAULT_PRODUCT_PACKAGE.lengthCm}cm.`,
        true,
      );
    } else {
      add("shipping:dimensions", true, "Produtos ativos possuem peso e dimensoes para cotacao.");
    }

    await prisma.$disconnect();
    add("database", true, "Conexao com banco ok.");
  } catch (error) {
    add("database", false, `Falha ao conectar no banco: ${safeErrorMessage(error)}`);
  }
}

async function main() {
  const env = validateEnvironment();

  add(".env", existsSync(".env"), existsSync(".env") ? ".env local encontrado." : ".env local nao encontrado.");

  try {
    checkGitIgnore(".env");
    add(".env gitignore", true, ".env esta ignorado pelo git.");
  } catch {
    add(".env gitignore", false, ".env nao parece estar ignorado pelo git.");
  }

  for (const issue of env.errors) {
    add(`env:${issue.variable}`, false, issue.message);
  }

  for (const issue of env.warnings) {
    add(`env:${issue.variable}`, true, issue.message, true);
  }

  if (env.ok) {
    add("env", true, "Variaveis obrigatorias minimas estao presentes para este ambiente.");
  }

  await checkDatabase();

  try {
    runPrismaValidate();
    add("prisma validate", true, "Schema Prisma valido.");
  } catch (error) {
    add("prisma validate", false, `Prisma validate falhou: ${safeErrorMessage(error)}`);
  }

  const scripts = packageJson.scripts ?? {};
  add("build script", Boolean(scripts.build), "Script npm run build encontrado.");

  if (env.storageDriver === "local") {
    add(
      "storage",
      true,
      "Storage local ativo. Use apenas em dev/homologacao temporaria; configure storage persistente antes de producao aberta.",
      true,
    );
  } else {
    add("storage", true, "Storage persistente configurado pelo driver informado.");
  }

  if (env.checkoutEnabled) {
    const envIssues = [...env.errors, ...env.warnings];
    const stripeIssue = envIssues.find((issue) => issue.variable === "STRIPE_SECRET_KEY");
    const webhookIssue = envIssues.find((issue) => issue.variable === "STRIPE_WEBHOOK_SECRET");
    add(
      "stripe",
      !stripeIssue || stripeIssue.level === "warning",
      stripeIssue ? stripeIssue.message : "Stripe secret configurado.",
      stripeIssue?.level === "warning",
    );
    add(
      "stripe webhook",
      !webhookIssue || webhookIssue.level === "warning",
      webhookIssue ? webhookIssue.message : "Webhook secret configurado.",
      webhookIssue?.level === "warning",
    );
  } else {
    add("checkout", true, "Checkout desabilitado por CHECKOUT_ENABLED=false.", true);
  }

  for (const result of results) {
    const prefix = result.ok ? (result.warning ? "[WARN]" : "[OK]") : "[ERRO]";
    console.log(`${prefix} ${result.label}: ${result.message}`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.error(`Readiness check falhou com ${failed.length} erro(s).`);
    process.exit(1);
  }

  console.log("Readiness check concluido sem erros bloqueantes.");
}

main().catch((error) => {
  console.error(`Readiness check falhou: ${safeErrorMessage(error)}`);
  process.exit(1);
});
