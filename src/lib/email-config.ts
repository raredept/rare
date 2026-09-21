import { DEVELOPMENT_APP_ENVS, PRODUCTION_APP_ENVS, RESTRICTED_APP_ENVS } from "@/lib/deployment-environment";
import { EmailDeliveryError, getTransactionalEmailDriver } from "@/lib/transactional-email";

// Fields shared by every transport. Delivery policy (environment/mode, allowlist and the
// backlog cutoff) is transport-independent so a driver swap cannot weaken it.
type EmailDeliveryPolicy = {
  from: string;
  replyTo?: string;
  mode: "test" | "production";
  testRecipients: ReadonlySet<string>;
  sendNotBefore: Date;
};

export type SmtpEmailConfig = EmailDeliveryPolicy & {
  driver: "smtp";
  host: string;
  port: 465 | 587;
  user: string;
  password: string;
};

export type ZeptoMailEmailConfig = EmailDeliveryPolicy & {
  driver: "zeptomail";
  // Full endpoint, https only, host restricted to ZeptoMail's own API domains.
  endpoint: string;
  sendToken: string;
};

export type EmailDeliveryConfig = SmtpEmailConfig | ZeptoMailEmailConfig;
export type EmailDriverName = "disabled" | "smtp" | "zeptomail";

export const ZEPTOMAIL_DEFAULT_API_BASE = "https://api.zeptomail.com/v1.1";
// One host per ZeptoMail data center. A configurable base URL must never let the Send Mail
// token be posted to an arbitrary host.
const zeptoMailApiHosts = new Set([
  "api.zeptomail.com",
  "api.zeptomail.eu",
  "api.zeptomail.in",
  "api.zeptomail.com.au",
  "api.zeptomail.jp",
  "api.zeptomail.com.cn",
  "api.zeptomail.sa",
  "api.zeptomail.ca",
]);

// Exactly one mailbox. Reject lists, display names and SMTP header injection.
export function isSingleEmailAddress(value: string) {
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
}

function requireValue(env: Record<string, string | undefined>, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new EmailDeliveryError("failed", `Missing${key}`);
  return value;
}

function readSender(env: Record<string, string | undefined>, extraMailboxes: string[], invalidCode: string) {
  const from = requireValue(env, "EMAIL_FROM_ORDERS");
  const replyTo = env.EMAIL_REPLY_TO?.trim() || undefined;
  if (![from, ...extraMailboxes, ...(replyTo ? [replyTo] : [])].every(isSingleEmailAddress)) {
    throw new EmailDeliveryError("failed", invalidCode);
  }
  return { from, replyTo };
}

function readSendNotBefore(env: Record<string, string | undefined>) {
  const cutoff = requireValue(env, "EMAIL_SEND_NOT_BEFORE");
  const sendNotBefore = new Date(cutoff);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(cutoff) || !Number.isFinite(sendNotBefore.getTime())) {
    throw new EmailDeliveryError("failed", "InvalidEmailSendNotBefore");
  }
  return sendNotBefore;
}

export function getSmtpEmailConfig(env: Record<string, string | undefined> = process.env): SmtpEmailConfig | null {
  const driver = getTransactionalEmailDriver(env);
  if (driver === "disabled") return null;
  if (driver !== "smtp") throw new EmailDeliveryError("failed", "UnsupportedEmailDriver");
  // Same validation order as before the ZeptoMail driver existed.
  const policy = readPolicyThen(env, "InvalidSmtpMailbox", () => {
    const hostValue = requireValue(env, "SMTP_HOST");
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(hostValue)) throw new EmailDeliveryError("failed", "InvalidSmtpHost");
    const port = Number(requireValue(env, "SMTP_PORT"));
    if (port !== 465 && port !== 587) throw new EmailDeliveryError("failed", "SmtpTlsPortRequired");
    return { host: hostValue, port: port as 465 | 587, user: requireValue(env, "SMTP_USER"), password: requireValue(env, "SMTP_PASSWORD") };
  });
  return { driver: "smtp", ...policy.transport, ...policy.policy };
}

// Policy checks that only need APP_ENV/mode/allowlist run first (as before), then the
// transport-specific values, then sender and cutoff.
function readPolicyThen<T extends object>(env: Record<string, string | undefined>, invalidMailboxCode: string, readTransport: () => T) {
  const environment = requireValue(env, "APP_ENV").toLowerCase();
  const production = PRODUCTION_APP_ENVS.includes(environment);
  if (!production && !RESTRICTED_APP_ENVS.includes(environment) && !DEVELOPMENT_APP_ENVS.includes(environment)) {
    throw new EmailDeliveryError("failed", "UnknownEmailEnvironment");
  }
  const mode = requireValue(env, "EMAIL_DELIVERY_MODE");
  if (mode !== (production ? "production" : "test")) throw new EmailDeliveryError("failed", "EmailEnvironmentModeMismatch");
  const testRecipients = new Set((env.EMAIL_TEST_RECIPIENTS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (mode === "test" && (!testRecipients.size || [...testRecipients].some((value) => !isSingleEmailAddress(value)))) {
    throw new EmailDeliveryError("failed", "InvalidEmailTestAllowlist");
  }
  const transport = readTransport();
  const mailbox = (transport as { user?: string }).user;
  const sender = readSender(env, mailbox ? [mailbox] : [], invalidMailboxCode);
  return { transport, policy: { mode: mode as "test" | "production", testRecipients, ...sender, sendNotBefore: readSendNotBefore(env) } };
}

// Accept the token exactly as pasted from the ZeptoMail console, with or without the
// "Zoho-enczapikey " scheme, and never anything that could split or extend a header.
export function normalizeZeptoMailToken(raw: string | undefined) {
  const value = (raw ?? "").trim().replace(/^Zoho-enczapikey\s+/i, "").trim();
  if (!value || value.length > 1024 || /[\s\u0000-\u001F\u007F"'`\\]/.test(value)) return null;
  return value;
}

export function resolveZeptoMailEndpoint(base: string | undefined) {
  const raw = (base?.trim() || ZEPTOMAIL_DEFAULT_API_BASE).replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new EmailDeliveryError("failed", "InvalidZeptoMailApiBase");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || !zeptoMailApiHosts.has(url.hostname) || url.pathname !== "/v1.1") {
    throw new EmailDeliveryError("failed", "InvalidZeptoMailApiBase");
  }
  return `${url.origin}${url.pathname}/email`;
}

export function getZeptoMailEmailConfig(env: Record<string, string | undefined> = process.env): ZeptoMailEmailConfig | null {
  const driver = getTransactionalEmailDriver(env);
  if (driver === "disabled") return null;
  if (driver !== "zeptomail") throw new EmailDeliveryError("failed", "UnsupportedEmailDriver");
  const { transport, policy } = readPolicyThen(env, "InvalidEmailMailbox", () => {
    const sendToken = normalizeZeptoMailToken(requireValue(env, "ZEPTOMAIL_SEND_TOKEN"));
    if (!sendToken) throw new EmailDeliveryError("failed", "InvalidZeptoMailSendToken");
    return { sendToken, endpoint: resolveZeptoMailEndpoint(env.ZEPTOMAIL_API_BASE) };
  });
  return { driver: "zeptomail", ...transport, ...policy };
}

// Returns the validated configuration of the explicitly selected driver (null = disabled).
// There is intentionally no fallback from one transport to another.
export function getEmailDeliveryConfig(env: Record<string, string | undefined> = process.env): EmailDeliveryConfig | null {
  const driver = getTransactionalEmailDriver(env);
  if (driver === "disabled") return null;
  if (driver === "smtp") return getSmtpEmailConfig(env);
  if (driver === "zeptomail") return getZeptoMailEmailConfig(env);
  throw new EmailDeliveryError("failed", "UnsupportedEmailDriver");
}

export function getEmailConfigurationStatus(env: Record<string, string | undefined> = process.env) {
  try {
    const config = getEmailDeliveryConfig(env);
    if (!config) return "intentionally_disabled";
    return config.driver === "zeptomail" ? "zeptomail_configured_delivery_unverified" : "smtp_configured_delivery_unverified";
  } catch {
    return "missing_required_configuration";
  }
}

// The fixed reason code for an invalid configuration, e.g. EmailEnvironmentModeMismatch
// or MissingZEPTOMAIL_SEND_TOKEN. Codes name a rule or a variable, never a value, so
// they are safe for operator-facing readiness output.
export function getEmailConfigurationIssue(env: Record<string, string | undefined> = process.env): string | null {
  try {
    getEmailDeliveryConfig(env);
    return null;
  } catch (error) {
    return error instanceof EmailDeliveryError && /^[A-Za-z_]{1,64}$/.test(error.code) ? error.code : "InvalidEmailConfiguration";
  }
}

// Admin-only readiness. Booleans and enum names only: no host, token, mailbox or allowlist content.
export function getEmailReadiness(env: Record<string, string | undefined> = process.env) {
  const driver = getTransactionalEmailDriver(env);
  const known = driver === "disabled" || driver === "smtp" || driver === "zeptomail";
  let configured = false;
  try {
    configured = getEmailDeliveryConfig(env) !== null;
  } catch {
    configured = false;
  }
  const mode = env.EMAIL_DELIVERY_MODE?.trim();
  return {
    driver: (known ? driver : "invalid") as EmailDriverName | "invalid",
    configured,
    deliveryMode: mode === "test" || mode === "production" ? mode : null,
  };
}
