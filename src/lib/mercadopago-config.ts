import { isProductionAppEnv, type EnvLike } from "@/lib/deployment-environment";

// Configuration of the Mercado Pago integration, kept free of Node-only imports because the
// environment validation (src/lib/env.ts) is also bundled for the Edge instrumentation.
// The transport and the webhook signature live in src/lib/mercadopago.ts.

export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  // "test" credentials can never settle real money.
  mode: "test" | "live";
};

// "rejected": Mercado Pago answered and refused, so nothing was created or changed.
// "unknown": no trustworthy answer; the operation may or may not have happened.
export class MercadoPagoError extends Error {
  constructor(readonly outcome: "rejected" | "unknown", readonly code: string, readonly status?: number) {
    super(code);
    this.name = "MercadoPagoError";
  }
}

export function isPixEnabled(env: EnvLike = process.env) {
  return env.PIX_ENABLED === "true";
}

function readToken(env: EnvLike) {
  const value = (env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "").trim();
  return /^(APP_USR|TEST)-[A-Za-z0-9_-]{16,300}$/.test(value) ? value : null;
}

function readWebhookSecret(env: EnvLike) {
  const value = (env.MERCADOPAGO_WEBHOOK_SECRET ?? "").trim();
  return /^[A-Za-z0-9_-]{16,256}$/.test(value) ? value : null;
}

/** Fixed reason code for an unusable configuration; never a value. Null when usable. */
export function getMercadoPagoConfigurationIssue(env: EnvLike = process.env): string | null {
  if (!(env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim()) return "MissingMERCADOPAGO_ACCESS_TOKEN";
  const accessToken = readToken(env);
  if (!accessToken) return "InvalidMercadoPagoAccessToken";
  if (!(env.MERCADOPAGO_WEBHOOK_SECRET ?? "").trim()) return "MissingMERCADOPAGO_WEBHOOK_SECRET";
  if (!readWebhookSecret(env)) return "InvalidMercadoPagoWebhookSecret";
  // A test credential behind the live store would hand out a Pix that never settles.
  if (isProductionAppEnv(env) && accessToken.startsWith("TEST-")) return "MercadoPagoTestCredentialInProduction";
  return null;
}

export function getMercadoPagoConfig(env: EnvLike = process.env): MercadoPagoConfig {
  const issue = getMercadoPagoConfigurationIssue(env);
  if (issue) throw new MercadoPagoError("rejected", issue);
  const accessToken = readToken(env) as string;
  return { accessToken, webhookSecret: readWebhookSecret(env) as string, mode: accessToken.startsWith("TEST-") ? "test" : "live" };
}

/** Pix is offered only when it is switched on AND fully configured for this environment. */
export function isPixCheckoutAvailable(env: EnvLike = process.env) {
  return isPixEnabled(env) && getMercadoPagoConfigurationIssue(env) === null;
}
