export type TransactionalEmailKind =
  | "order_confirmation"
  | "payment_approved"
  | "payment_declined"
  | "order_shipped"
  | "support_contact";

export type TransactionalEmailMessage = {
  kind: TransactionalEmailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type TransactionalEmailProvider = {
  name: string;
  send(message: TransactionalEmailMessage): Promise<{ id?: string }>;
};

export type OrderEmailInput = {
  to: string;
  customerName: string;
  orderNumber: string;
  total: string;
  trackingCode?: string | null;
};

export type SupportEmailInput = {
  to: string;
  customerName: string;
  customerEmail: string;
  message: string;
};

function cleanText(value: string, maxLength = 2_000) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function cleanHeader(value: string, maxLength = 255) {
  return cleanText(value, maxLength).replace(/[\r\n]+/g, " ");
}

export function escapeEmailHtml(value: string) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function orderTemplate(
  kind: Exclude<TransactionalEmailKind, "support_contact">,
  input: OrderEmailInput,
  title: string,
  detail: string,
) {
  const name = cleanHeader(input.customerName, 120);
  const orderNumber = cleanHeader(input.orderNumber, 80);
  const total = cleanHeader(input.total, 80);
  const tracking = input.trackingCode ? cleanText(input.trackingCode, 160) : null;
  const trackingText = tracking ? ` Código de rastreio: ${tracking}.` : "";

  return {
    kind,
    to: cleanHeader(input.to),
    subject: `${title} — pedido ${orderNumber}`,
    text: `Olá, ${name}. ${detail} Pedido ${orderNumber}, total ${total}.${trackingText}`,
    html: `<h1>${escapeEmailHtml(title)}</h1><p>Olá, ${escapeEmailHtml(name)}.</p><p>${escapeEmailHtml(detail)}</p><p>Pedido <strong>${escapeEmailHtml(orderNumber)}</strong>, total ${escapeEmailHtml(total)}.</p>${tracking ? `<p>Código de rastreio: ${escapeEmailHtml(tracking)}.</p>` : ""}`,
  } satisfies TransactionalEmailMessage;
}

export function renderOrderConfirmationEmail(input: OrderEmailInput) {
  return orderTemplate("order_confirmation", input, "Pedido recebido", "Recebemos seu pedido e aguardamos a confirmação do pagamento.");
}

export function renderPaymentApprovedEmail(input: OrderEmailInput) {
  return orderTemplate("payment_approved", input, "Pagamento aprovado", "Seu pagamento foi confirmado.");
}

export function renderPaymentDeclinedEmail(input: OrderEmailInput) {
  return orderTemplate("payment_declined", input, "Pagamento não aprovado", "O pagamento não foi aprovado; nenhum dado financeiro é exibido neste e-mail.");
}

export function renderOrderShippedEmail(input: OrderEmailInput) {
  return orderTemplate("order_shipped", input, "Pedido enviado", "Seu pedido foi enviado.");
}

export function renderSupportContactEmail(input: SupportEmailInput): TransactionalEmailMessage {
  const name = cleanHeader(input.customerName, 120);
  const customerEmail = cleanHeader(input.customerEmail, 255);
  const message = cleanText(input.message);
  return {
    kind: "support_contact",
    to: cleanHeader(input.to),
    replyTo: customerEmail,
    subject: `Contato de suporte — ${name}`,
    text: `Contato de ${name} (${customerEmail}):\n\n${message}`,
    html: `<h1>Contato de suporte</h1><p>De: ${escapeEmailHtml(name)} (${escapeEmailHtml(customerEmail)})</p><p>${escapeEmailHtml(message).replace(/\r?\n/g, "<br>")}</p>`,
  };
}

export function getTransactionalEmailDriver(env: NodeJS.ProcessEnv = process.env) {
  return env.EMAIL_DRIVER?.trim().toLowerCase() || "disabled";
}

export async function deliverTransactionalEmail(
  message: TransactionalEmailMessage,
  provider?: TransactionalEmailProvider,
) {
  const driver = getTransactionalEmailDriver();
  if (driver === "disabled") return { status: "disabled" as const };
  if (!provider || provider.name !== driver) {
    console.error("[transactional-email] delivery failed", { provider: driver, error: "ProviderNotConfigured" });
    return { status: "failed" as const, provider: driver };
  }

  try {
    const result = await provider.send(message);
    return { status: "sent" as const, provider: provider.name, id: result.id };
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("[transactional-email] delivery failed", { provider: provider.name, error: name });
    return { status: "failed" as const, provider: provider.name };
  }
}
