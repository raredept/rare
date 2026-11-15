// Customer support contract (pure: no database, no Node APIs). Shared by the /suporte form, the
// server action, the e-mail templates and the Admin inbox.

export const SUPPORT_CATEGORIES = ["PRODUCT_QUESTION", "SOLD_OUT_PRODUCT", "ORDER", "PAYMENT", "SHIPPING", "RETURN", "OTHER"] as const;
export type SupportCategoryValue = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategoryValue, string> = {
  PRODUCT_QUESTION: "Dúvida sobre produto",
  SOLD_OUT_PRODUCT: "Peça vendida ou esgotada",
  ORDER: "Pedido",
  PAYMENT: "Pagamento",
  SHIPPING: "Entrega",
  RETURN: "Troca ou devolução",
  OTHER: "Outro assunto",
};

export const SUPPORT_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  emailMax: 254,
  messageMin: 10,
  messageMax: 5000,
  slugMax: 120,
} as const;

export function isSupportCategory(value: unknown): value is SupportCategoryValue {
  return typeof value === "string" && (SUPPORT_CATEGORIES as readonly string[]).includes(value);
}

const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

/** Control characters out (CR/LF included for single-line fields: no header injection). */
export function cleanSingleLine(value: string, max: number) {
  return value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

/** Message text keeps line breaks, loses every other control character. */
export function cleanMessage(value: string, max: number) {
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

export type SupportSubmission = {
  submissionKey: string;
  name: string;
  email: string;
  category: SupportCategoryValue;
  message: string;
  productSlug: string | null;
  orderId: string | null;
};

export type SupportValidation =
  | { ok: true; value: SupportSubmission }
  | { ok: false; fieldErrors: Partial<Record<"name" | "email" | "category" | "message" | "form", string>> };

function field(form: { get(name: string): unknown }, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Strict server-side parse. Anything outside the contract is dropped or refused, never stored. */
export function parseSupportSubmission(form: { get(name: string): unknown }): SupportValidation {
  const submissionKey = field(form, "submissionKey").trim();
  const rawName = field(form, "name");
  const rawEmail = field(form, "email");
  const rawMessage = field(form, "message");
  const name = cleanSingleLine(rawName, SUPPORT_LIMITS.nameMax + 1);
  const email = cleanSingleLine(rawEmail, SUPPORT_LIMITS.emailMax + 1).toLowerCase();
  const category = field(form, "category");
  const message = cleanMessage(rawMessage, SUPPORT_LIMITS.messageMax + 1);
  const productSlug = field(form, "product").trim();
  const orderId = field(form, "order").trim();

  const fieldErrors: Partial<Record<"name" | "email" | "category" | "message" | "form", string>> = {};
  if (!UUID_PATTERN.test(submissionKey)) fieldErrors.form = "Recarregue a página e tente de novo.";
  if (name.length < SUPPORT_LIMITS.nameMin || name.length > SUPPORT_LIMITS.nameMax) fieldErrors.name = `Informe seu nome (até ${SUPPORT_LIMITS.nameMax} caracteres).`;
  if (/[\r\n]/.test(rawEmail) || email.length > SUPPORT_LIMITS.emailMax || !EMAIL_PATTERN.test(email)) fieldErrors.email = "Informe um e-mail válido.";
  if (!isSupportCategory(category)) fieldErrors.category = "Escolha um assunto.";
  if (message.length < SUPPORT_LIMITS.messageMin) fieldErrors.message = `Escreva sua mensagem (mínimo de ${SUPPORT_LIMITS.messageMin} caracteres).`;
  if (message.length > SUPPORT_LIMITS.messageMax) fieldErrors.message = `A mensagem pode ter até ${SUPPORT_LIMITS.messageMax} caracteres.`;
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      submissionKey: submissionKey.toLowerCase(),
      name,
      email,
      category: category as SupportCategoryValue,
      message,
      productSlug: productSlug && productSlug.length <= SUPPORT_LIMITS.slugMax && SLUG_PATTERN.test(productSlug) ? productSlug : null,
      orderId: orderId && ID_PATTERN.test(orderId) ? orderId : null,
    },
  };
}

/** SUP- + 8 characters without ambiguous ones (0/O, 1/I/L). */
export function generateSupportProtocol(randomBytes: Uint8Array) {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return `SUP-${Array.from(randomBytes.slice(0, 8), (byte) => alphabet[byte % alphabet.length]).join("")}`;
}
