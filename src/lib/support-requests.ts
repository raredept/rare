import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient, SupportRequest } from "@prisma/client";
import { getEmailDeliveryConfig, isSingleEmailAddress, type EmailDeliveryConfig } from "@/lib/email-config";
import { createEmailProvider } from "@/lib/email-outbox-worker";
import { assertEmailRecipientAllowed } from "@/lib/smtp-email";
import {
  generateSupportProtocol,
  SUPPORT_CATEGORY_LABELS,
  type SupportSubmission,
} from "@/lib/support-request-contract";
import {
  deliverTransactionalEmail,
  EmailDeliveryError,
  escapeEmailHtml,
  type EmailDeliveryResult,
  type TransactionalEmailMessage,
  type TransactionalEmailProvider,
} from "@/lib/transactional-email";

// Durable customer support: validate -> persist -> deliver -> mark. The request row exists before
// any provider call, so a Resend outage never loses a message. Delivery runs once right after the
// submission and then from the worker, always under a lease and with idempotency keys derived
// from the request id, so a double submit, a retry or two workers send each e-mail once.

type Database = Pick<PrismaClient, "supportRequest" | "product" | "order">;

const LEASE_MS = 2 * 60_000;
export const SUPPORT_MAX_ATTEMPTS = 5;

/** Same message-id shape as the order outbox, so every transport accepts it as an idempotency key. */
export function supportMessageId(requestId: string, part: "team" | "customer") {
  return `<rare-${createHash("sha256").update(`support/${requestId}/${part}`).digest("hex")}@raredept.com.br>`;
}

/** The store's support inbox: SUPPORT_INBOX_EMAIL, else the general reply-to mailbox. Never hardcoded. */
export function getSupportInbox(env: Record<string, string | undefined> = process.env) {
  const value = env.SUPPORT_INBOX_EMAIL?.trim() || env.EMAIL_REPLY_TO?.trim() || "";
  return isSingleEmailAddress(value) ? value : null;
}

function formatDate(value: Date) {
  return value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

type SupportEmailSource = Pick<SupportRequest, "protocol" | "category" | "name" | "email" | "message" | "productTitleSnapshot" | "productSlugSnapshot" | "orderNumberSnapshot" | "createdAt">;

export function renderSupportTeamEmail(request: SupportEmailSource, to: string, appUrl: string): TransactionalEmailMessage {
  const category = SUPPORT_CATEGORY_LABELS[request.category];
  const rows: Array<[string, string]> = [
    ["Protocolo", request.protocol],
    ["Categoria", category],
    ["Nome", request.name],
    ["E-mail", request.email],
    ...(request.productTitleSnapshot ? [["Produto", `${request.productTitleSnapshot}${request.productSlugSnapshot ? ` (${appUrl}/produto/${request.productSlugSnapshot})` : ""}`] as [string, string]] : []),
    ...(request.orderNumberSnapshot ? [["Pedido", request.orderNumberSnapshot] as [string, string]] : []),
    ["Data", formatDate(request.createdAt)],
  ];
  return {
    kind: "support_request",
    to,
    // The customer is the Reply-To (never the From): "Responder" in the inbox answers them.
    replyTo: request.email,
    subject: `[RARE Suporte] ${request.protocol} — ${category}`.replace(/[\r\n]/g, " "),
    text: `Nova solicitação de suporte\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nMensagem:\n${request.message}`,
    html: `<h1>Nova solicitação de suporte</h1><table>${rows.map(([label, value]) => `<tr><th align="left">${escapeEmailHtml(label)}</th><td>${escapeEmailHtml(value)}</td></tr>`).join("")}</table><h2>Mensagem</h2><p>${escapeEmailHtml(request.message).replace(/\n/g, "<br>")}</p>`,
  };
}

export function renderSupportConfirmationEmail(request: Pick<SupportRequest, "protocol" | "name" | "category">, replyTo: string): TransactionalEmailMessage {
  const name = request.name.split(" ")[0] ?? request.name;
  const category = SUPPORT_CATEGORY_LABELS[request.category];
  return {
    kind: "support_confirmation",
    to: "",
    replyTo,
    subject: `Recebemos sua solicitação — ${request.protocol}`,
    text: `Olá, ${name}.\n\nRecebemos sua solicitação sobre "${category}". A equipe da RARE vai responder por este e-mail.\n\nProtocolo: ${request.protocol}`,
    html: `<p>Olá, ${escapeEmailHtml(name)}.</p><p>Recebemos sua solicitação sobre "${escapeEmailHtml(category)}". A equipe da RARE vai responder por este e-mail.</p><p>Protocolo: <strong>${escapeEmailHtml(request.protocol)}</strong></p>`,
  };
}

export type CreateSupportRequestResult = { protocol: string; id: string; created: boolean };

/**
 * Persists the request. Product and order are resolved here, never trusted from the browser: the
 * product by slug from the catalog, the order only when it belongs to the signed-in customer.
 * The submission key makes a double submit return the original request.
 */
export async function createSupportRequest(
  db: Database,
  input: SupportSubmission,
  customer: { id: string } | null,
): Promise<CreateSupportRequestResult | { error: "order_not_found" }> {
  const existing = await db.supportRequest.findUnique({ where: { submissionKey: input.submissionKey }, select: { id: true, protocol: true } });
  if (existing) return { ...existing, created: false };

  const product = input.productSlug
    ? await db.product.findUnique({ where: { slug: input.productSlug }, select: { id: true, title: true, slug: true } })
    : null;
  let order: { id: string; orderNumber: string } | null = null;
  if (input.orderId) {
    if (!customer) return { error: "order_not_found" };
    // Ownership in the query itself: another customer's order is indistinguishable from a missing one.
    order = await db.order.findFirst({ where: { id: input.orderId, customerId: customer.id }, select: { id: true, orderNumber: true } });
    if (!order) return { error: "order_not_found" };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const protocol = generateSupportProtocol(randomBytes(8));
    const result = await db.supportRequest.createMany({
      data: [{
        protocol,
        submissionKey: input.submissionKey,
        customerId: customer?.id ?? null,
        productId: product?.id ?? null,
        productTitleSnapshot: product?.title ?? null,
        productSlugSnapshot: product?.slug ?? null,
        orderId: order?.id ?? null,
        orderNumberSnapshot: order?.orderNumber ?? null,
        name: input.name,
        email: input.email,
        category: input.category,
        message: input.message,
      }],
      skipDuplicates: true,
    });
    const row = await db.supportRequest.findUnique({ where: { submissionKey: input.submissionKey }, select: { id: true, protocol: true } });
    if (row) return { ...row, created: result.count === 1 };
    // A protocol collision (1 in 31^8) skipped the insert: try another protocol.
  }
  throw new Error("SupportProtocolUnavailable");
}

type Decision = Exclude<EmailDeliveryResult, { status: "disabled" }>;

export type SupportDeliveryLog = { event: "support.delivery"; request: string; part: "team" | "customer"; status: string; code: string | null; providerRequestId: string | null; attempt: number };
const defaultLog = (entry: SupportDeliveryLog) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry }));
const opaque = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);

async function send(message: TransactionalEmailMessage, messageId: string, config: EmailDeliveryConfig, provider: TransactionalEmailProvider, env: Record<string, string | undefined>): Promise<Decision> {
  try {
    assertEmailRecipientAllowed(message, config);
    const result = await deliverTransactionalEmail(message, messageId, provider, env);
    return result.status === "disabled" ? { status: "failed", provider: config.driver, code: "EmailDisabledDuringAttempt" } : result;
  } catch (error) {
    return error instanceof EmailDeliveryError
      ? { status: error.outcome, provider: config.driver, code: error.code }
      : { status: "uncertain", provider: config.driver, code: "UnclassifiedSupportFailure" };
  }
}

/**
 * Delivers one request under a lease. The team e-mail goes first; the customer confirmation only
 * after the team has the message. Retryable failures back off and stay PENDING up to the attempt
 * ceiling; anything else (or an uncertain outcome) is FAILED and waits for an operator retry.
 */
export async function deliverSupportRequest(
  db: Pick<PrismaClient, "supportRequest">,
  id: string,
  options: { env?: Record<string, string | undefined>; provider?: TransactionalEmailProvider; now?: Date; log?: (entry: SupportDeliveryLog) => void } = {},
) {
  const env = options.env ?? process.env;
  const config = getEmailDeliveryConfig(env);
  if (!config) return "disabled" as const;
  const inbox = getSupportInbox(env);
  const now = options.now ?? new Date();
  const log = options.log ?? defaultLog;
  const token = randomUUID();
  const claimed = await db.supportRequest.updateMany({
    where: {
      id,
      nextAttemptAt: { lte: now },
      OR: [{ status: "PENDING" }, { status: "SENT", confirmationStatus: "PENDING" }],
      AND: [{ OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] }],
    },
    data: { leaseToken: token, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return "busy" as const;
  const row = await db.supportRequest.findUniqueOrThrow({ where: { id } });
  const provider = options.provider ?? createEmailProvider(config);
  const appUrl = (env.APP_URL ?? "https://raredept.com.br").replace(/\/+$/, "");
  const update: Record<string, unknown> = { leaseToken: null, leaseExpiresAt: null };
  const backoff = new Date(now.getTime() + Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, row.attempts - 1)));
  const settle = (decision: Decision) => {
    if (decision.status === "accepted") return { status: "SENT" as const, code: null };
    if (decision.status === "retry" && row.attempts < SUPPORT_MAX_ATTEMPTS) return { status: "PENDING" as const, code: decision.code };
    return { status: "FAILED" as const, code: decision.status === "retry" ? "RetryLimitReached" : decision.code };
  };

  let teamSent = row.status === "SENT";
  if (!teamSent) {
    const decision: Decision = inbox
      ? await send(renderSupportTeamEmail(row, inbox, appUrl), supportMessageId(row.id, "team"), config, provider, env)
      : { status: "failed", provider: config.driver, code: "MissingSupportInbox" };
    const outcome = settle(decision);
    Object.assign(update, { status: outcome.status, lastErrorCode: outcome.code, ...(outcome.status === "SENT" ? { emailSentAt: now } : {}) });
    if (outcome.status === "PENDING") update.nextAttemptAt = backoff;
    teamSent = outcome.status === "SENT";
    log({ event: "support.delivery", request: opaque(row.id), part: "team", status: outcome.status, code: outcome.code, providerRequestId: decision.status === "accepted" ? decision.id.replace(/^\w+:/, "") : null, attempt: row.attempts });
  }

  if (teamSent && row.confirmationStatus === "PENDING" && inbox) {
    const message = { ...renderSupportConfirmationEmail(row, inbox), to: row.email };
    const decision = await send(message, supportMessageId(row.id, "customer"), config, provider, env);
    const outcome = settle(decision);
    Object.assign(update, { confirmationStatus: outcome.status, confirmationErrorCode: outcome.code, ...(outcome.status === "SENT" ? { confirmationSentAt: now } : {}) });
    if (outcome.status === "PENDING") update.nextAttemptAt = backoff;
    log({ event: "support.delivery", request: opaque(row.id), part: "customer", status: outcome.status, code: outcome.code, providerRequestId: decision.status === "accepted" ? decision.id.replace(/^\w+:/, "") : null, attempt: row.attempts });
  }

  // Only the lease holder may write: a late worker never overwrites a newer state.
  await db.supportRequest.updateMany({ where: { id, leaseToken: token }, data: update });
  return "processed" as const;
}

/** Worker batch: requests whose team e-mail or confirmation is still pending and due. */
export async function processSupportRequests(db: Pick<PrismaClient, "supportRequest">, options: { limit?: number; env?: Record<string, string | undefined>; provider?: TransactionalEmailProvider } = {}) {
  const env = options.env ?? process.env;
  if (!getEmailDeliveryConfig(env)) return { disabled: true, processed: 0 };
  const now = new Date();
  const due = await db.supportRequest.findMany({
    where: { nextAttemptAt: { lte: now }, OR: [{ status: "PENDING" }, { status: "SENT", confirmationStatus: "PENDING" }] },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(options.limit ?? 10, 1), 50),
    select: { id: true },
  });
  let processed = 0;
  for (const { id } of due) {
    if ((await deliverSupportRequest(db, id, { env, provider: options.provider })) === "processed") processed += 1;
  }
  return { disabled: false, processed };
}

/** Operator retry of a FAILED delivery: back to PENDING; the idempotency keys keep it single-send. */
export async function retrySupportRequest(db: Pick<PrismaClient, "supportRequest">, id: string) {
  const team = await db.supportRequest.updateMany({ where: { id, status: "FAILED" }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastErrorCode: null } });
  const customer = await db.supportRequest.updateMany({ where: { id, status: "SENT", confirmationStatus: "FAILED" }, data: { confirmationStatus: "PENDING", attempts: 0, nextAttemptAt: new Date(), confirmationErrorCode: null } });
  return team.count + customer.count > 0;
}
