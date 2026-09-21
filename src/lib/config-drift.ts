/**
 * Guards against credentials and provider modes landing in the wrong environment.
 *
 * These combinations have bitten this project before: a live Stripe key reachable
 * from a homologation run charges real cards, and a test key in production takes
 * payments that never settle. Neither failure is visible in the UI — the checkout
 * looks perfectly healthy in both cases — so the mismatch is detected from the
 * credentials themselves instead of being left to a human checklist.
 */

import {
  describeEnvironment,
  getDeploymentEnvironment,
  isUnknownAppEnv,
  KNOWN_APP_ENVS,
  normalizeAppEnv,
  type DeploymentEnvironment,
} from "@/lib/deployment-environment";

export { describeEnvironment, getDeploymentEnvironment, type DeploymentEnvironment };

export type ConfigDriftLevel = "error" | "warning";

export type ConfigDrift = {
  level: ConfigDriftLevel;
  variable: string;
  message: string;
};

export type EnvLike = Record<string, string | undefined>;

const CANONICAL_PRODUCTION_HOSTS = ["raredept.com.br", "www.raredept.com.br"];

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** "live" | "test" | null when the key is absent or not a recognisable Stripe secret key. */
export function getStripeKeyMode(value: string | undefined): "live" | "test" | null {
  const match = clean(value)?.match(/^(?:sk|rk)_(test|live)_/);
  return match ? (match[1] as "live" | "test") : null;
}

/** Melhor Envio defaults to the production API when MELHOR_ENVIO_ENV is unset. */
export function getMelhorEnvioMode(env: EnvLike = process.env): "production" | "sandbox" | null {
  const configured = clean(env.MELHOR_ENVIO_ENV)?.toLowerCase();
  if (!configured) return "production";
  if (configured === "production" || configured === "sandbox") return configured;
  return null;
}

function getHost(value: string | undefined) {
  const configured = clean(value);
  if (!configured) return null;
  try {
    return new URL(configured).host.toLowerCase();
  } catch {
    return null;
  }
}

export function detectConfigDrift(env: EnvLike = process.env): ConfigDrift[] {
  const drift: ConfigDrift[] = [];
  const environment = getDeploymentEnvironment(env);

  if (isUnknownAppEnv(env)) {
    drift.push({
      level: "warning",
      variable: "APP_ENV",
      message: `APP_ENV="${(normalizeAppEnv(env) ?? "").replace(/[^a-z0-9_-]/g, "").slice(0, 32)}" não é reconhecido; os guards usam NODE_ENV e tratam este ambiente como ${describeEnvironment(environment)}. Use um de: ${KNOWN_APP_ENVS.join(", ")}.`,
    });
  }
  const checkoutEnabled = env.CHECKOUT_ENABLED === "true";
  const stripeMode = getStripeKeyMode(env.STRIPE_SECRET_KEY);

  // A live key outside production is fatal wherever it is found: the next
  // homologation checkout would move real money.
  if (stripeMode === "live" && environment !== "production") {
    drift.push({
      level: "error",
      variable: "STRIPE_SECRET_KEY",
      message: `Chave Stripe live configurada em ${describeEnvironment(environment)}. Um checkout de teste cobraria cartões reais. Use uma chave sk_test_/rk_test_.`,
    });
  }

  // A test key in production only matters once sales are open: nothing settles.
  if (stripeMode === "test" && environment === "production") {
    drift.push({
      level: checkoutEnabled ? "error" : "warning",
      variable: "STRIPE_SECRET_KEY",
      message: checkoutEnabled
        ? "Chave Stripe de teste em produção com o checkout ligado. Os pagamentos dos clientes não seriam cobrados de verdade."
        : "Chave Stripe de teste em produção. Troque pela chave live antes de ligar CHECKOUT_ENABLED.",
    });
  }

  // Unset means "whatever the Stripe Dashboard enables", which can include
  // asynchronous methods (Pix, boleto) that homologation never exercised.
  if (environment === "production" && !clean(env.STRIPE_PAYMENT_METHOD_TYPES)) {
    drift.push({
      level: "warning",
      variable: "STRIPE_PAYMENT_METHOD_TYPES",
      message:
        "Métodos de pagamento não definidos em produção; a Stripe usará os que estiverem ligados no Dashboard. Defina card ou card,pix, os mesmos homologados.",
    });
  }

  const shippingProvider = clean(env.SHIPPING_PROVIDER)?.toLowerCase();
  if (shippingProvider === "melhor_envio") {
    const melhorEnvioMode = getMelhorEnvioMode(env);

    if (melhorEnvioMode === "sandbox" && environment === "production") {
      drift.push({
        level: checkoutEnabled ? "error" : "warning",
        variable: "MELHOR_ENVIO_ENV",
        message: checkoutEnabled
          ? "Melhor Envio em sandbox com o checkout de produção ligado. Os clientes receberiam cotações de frete fictícias."
          : "Melhor Envio em sandbox em produção. Ajuste para production antes de ligar as vendas.",
      });
    }

    if (melhorEnvioMode === "production" && environment === "restricted") {
      drift.push({
        level: "warning",
        variable: "MELHOR_ENVIO_ENV",
        message: clean(env.MELHOR_ENVIO_ENV)
          ? "Homologação usando a API de produção do Melhor Envio. As cotações consomem a conta real; use MELHOR_ENVIO_ENV=sandbox salvo em teste deliberado com a conta real."
          : "MELHOR_ENVIO_ENV não definida em homologação; o padrão é a API de produção. Defina sandbox ou production explicitamente.",
      });
    }
  }

  // Staging pointing at the live host sends its redirects, e-mail links and
  // Stripe return URLs to production.
  const appHost = getHost(clean(env.APP_URL) ?? clean(env.NEXT_PUBLIC_APP_URL));
  if (appHost && environment === "restricted" && CANONICAL_PRODUCTION_HOSTS.includes(appHost)) {
    drift.push({
      level: "error",
      variable: "APP_URL",
      message: "Homologação apontando para o domínio de produção. Links, retornos do Stripe e e-mails sairiam para a loja real.",
    });
  }

  return drift;
}

/**
 * Blocks the dangerous action rather than the whole process: a boot refusal on a
 * false positive would take the storefront down, while this only stops the
 * payment path that the mismatch would corrupt.
 */
export function assertCheckoutCredentialsMatchEnvironment(env: EnvLike = process.env) {
  const blocking = detectConfigDrift(env).filter(
    (issue) => issue.level === "error" && (issue.variable === "STRIPE_SECRET_KEY" || issue.variable === "MELHOR_ENVIO_ENV"),
  );

  if (blocking.length) {
    // The operator reads the detail in the logs, in /admin/readiness and in the
    // health endpoint; the shopper never sees configuration wording.
    console.error("[RARE config-drift] checkout blocked", {
      issues: blocking.map((issue) => ({ variable: issue.variable, message: issue.message })),
    });
    throw new Error("Checkout bloqueado por configuração de ambiente inconsistente.");
  }
}
