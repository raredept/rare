import { getDeploymentEnvironment, type EnvLike } from "@/lib/deployment-environment";

// Asaas configuration, free of Node-only imports (the environment validation and the proxy bundle
// read it). The HTTP transport lives in src/lib/asaas.ts.
//
// Environments are separated by construction: the API host is fixed per ASAAS_ENV (never taken
// from a variable that could point the key somewhere else), the key prefix must match it
// ($aact_hmlg_ = Sandbox, $aact_prod_ = Production), and the deployment decides which one is
// allowed: production deployments only Production, everything else only Sandbox.

export const ASAAS_API_BASES = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const;

export type AsaasEnvironment = keyof typeof ASAAS_API_BASES;

export type AsaasConfig = {
  environment: AsaasEnvironment;
  apiBase: string;
  apiKey: string;
  webhookToken: string;
};

// "rejected": Asaas answered and refused, nothing was created or changed.
// "unknown": no trustworthy answer; the operation may or may not have happened.
export class AsaasError extends Error {
  constructor(readonly outcome: "rejected" | "unknown", readonly code: string, readonly status?: number) {
    super(code);
    this.name = "AsaasError";
  }
}

function readEnvironment(env: EnvLike): AsaasEnvironment | null {
  const value = env.ASAAS_ENV?.trim().toLowerCase();
  return value === "sandbox" || value === "production" ? value : null;
}

function readKey(env: EnvLike) {
  const value = env.ASAAS_API_KEY?.trim() ?? "";
  return /^\$aact_(?:prod|hmlg)_[A-Za-z0-9_\-:+=/.]{16,500}$/.test(value) ? value : null;
}

function readWebhookToken(env: EnvLike) {
  // Asaas accepts 32 to 255 characters for authToken.
  const value = env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";
  return /^[\x21-\x7e]{32,255}$/.test(value) ? value : null;
}

/** Fixed reason code for an unusable configuration; never a value. Null when usable. */
export function getAsaasConfigurationIssue(env: EnvLike = process.env): string | null {
  const environment = readEnvironment(env);
  if (!environment) return "InvalidASAAS_ENV";
  if (!(env.ASAAS_API_KEY ?? "").trim()) return "MissingASAAS_API_KEY";
  const apiKey = readKey(env);
  if (!apiKey) return "InvalidASAAS_API_KEY";
  const keyEnvironment: AsaasEnvironment = apiKey.startsWith("$aact_prod_") ? "production" : "sandbox";
  if (keyEnvironment !== environment) return "AsaasKeyDoesNotMatchASAAS_ENV";
  const configuredBase = env.ASAAS_API_BASE?.trim().replace(/\/+$/, "");
  if (configuredBase && configuredBase !== ASAAS_API_BASES[environment]) return "AsaasApiBaseDoesNotMatchASAAS_ENV";
  const deployment = getDeploymentEnvironment(env);
  if (deployment === "production" && environment !== "production") return "AsaasSandboxInProduction";
  if (deployment !== "production" && environment === "production") return "AsaasProductionOutsideProduction";
  if (!(env.ASAAS_WEBHOOK_TOKEN ?? "").trim()) return "MissingASAAS_WEBHOOK_TOKEN";
  const webhookToken = readWebhookToken(env);
  if (!webhookToken) return "InvalidASAAS_WEBHOOK_TOKEN";
  if (webhookToken === apiKey) return "AsaasWebhookTokenReusesApiKey";
  return null;
}

export function getAsaasConfig(env: EnvLike = process.env): AsaasConfig {
  const issue = getAsaasConfigurationIssue(env);
  if (issue) throw new AsaasError("rejected", issue);
  const environment = readEnvironment(env) as AsaasEnvironment;
  return { environment, apiBase: ASAAS_API_BASES[environment], apiKey: readKey(env) as string, webhookToken: readWebhookToken(env) as string };
}

/** ASAAS_PAYMENT_METHODS="pix,card" (default both). Boleto is deliberately not offered. */
export function getAsaasPaymentMethods(env: EnvLike = process.env): Array<"card" | "pix"> {
  const raw = env.ASAAS_PAYMENT_METHODS?.trim().toLowerCase() || "pix,card";
  const methods = new Set(raw.split(",").map((method) => method.trim()));
  return (["card", "pix"] as const).filter((method) => methods.has(method));
}

/** Redirect back to the store after a card payment on the Asaas invoice (needs the domain set up in Asaas). */
export function isAsaasSuccessRedirectEnabled(env: EnvLike = process.env) {
  return env.ASAAS_SUCCESS_REDIRECT?.trim().toLowerCase() === "true";
}
