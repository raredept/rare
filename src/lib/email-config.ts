import { EmailDeliveryError, getTransactionalEmailDriver } from "@/lib/transactional-email";

export type SmtpEmailConfig = {
  driver: "smtp";
  host: string;
  port: 465 | 587;
  user: string;
  password: string;
  from: string;
  replyTo?: string;
  mode: "test" | "production";
  testRecipients: ReadonlySet<string>;
  sendNotBefore: Date;
};

// Exactly one mailbox. Reject lists, display names and SMTP header injection.
export function isSingleEmailAddress(value: string) {
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
}

function requireValue(env: Record<string, string | undefined>, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new EmailDeliveryError("failed", `Missing${key}`);
  return value;
}

export function getSmtpEmailConfig(env: Record<string, string | undefined> = process.env): SmtpEmailConfig | null {
  const driver = getTransactionalEmailDriver(env);
  if (driver === "disabled") return null;
  if (driver !== "smtp") throw new EmailDeliveryError("failed", "UnsupportedEmailDriver");
  const environment = requireValue(env, "APP_ENV").toLowerCase();
  const production = ["production", "prod", "live"].includes(environment);
  if (!production && !["test", "development", "staging", "preview", "homologation"].includes(environment)) {
    throw new EmailDeliveryError("failed", "UnknownEmailEnvironment");
  }
  const mode = requireValue(env, "EMAIL_DELIVERY_MODE");
  if (mode !== (production ? "production" : "test")) {
    throw new EmailDeliveryError("failed", "EmailEnvironmentModeMismatch");
  }
  const testRecipients = new Set((env.EMAIL_TEST_RECIPIENTS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (mode === "test" && (!testRecipients.size || [...testRecipients].some((value) => !isSingleEmailAddress(value)))) {
    throw new EmailDeliveryError("failed", "InvalidEmailTestAllowlist");
  }
  const host = requireValue(env, "SMTP_HOST");
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(host)) {
    throw new EmailDeliveryError("failed", "InvalidSmtpHost");
  }
  const port = Number(requireValue(env, "SMTP_PORT"));
  if (port !== 465 && port !== 587) throw new EmailDeliveryError("failed", "SmtpTlsPortRequired");
  const user = requireValue(env, "SMTP_USER");
  const password = requireValue(env, "SMTP_PASSWORD");
  const from = requireValue(env, "EMAIL_FROM_ORDERS");
  const replyTo = env.EMAIL_REPLY_TO?.trim() || undefined;
  if (![user, from, ...(replyTo ? [replyTo] : [])].every(isSingleEmailAddress)) {
    throw new EmailDeliveryError("failed", "InvalidSmtpMailbox");
  }
  const cutoff = requireValue(env, "EMAIL_SEND_NOT_BEFORE");
  const sendNotBefore = new Date(cutoff);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(cutoff) || !Number.isFinite(sendNotBefore.getTime())) {
    throw new EmailDeliveryError("failed", "InvalidEmailSendNotBefore");
  }
  return { driver: "smtp", host, port, user, password, from, replyTo, mode, testRecipients, sendNotBefore };
}

export function getEmailConfigurationStatus(env: Record<string, string | undefined> = process.env) {
  try {
    return getSmtpEmailConfig(env) ? "smtp_configured_delivery_unverified" : "intentionally_disabled";
  } catch {
    return "missing_required_configuration";
  }
}
