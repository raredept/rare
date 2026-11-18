import { z } from "zod";
import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import { ASSISTANT_PRIORITY_MAX, normalizeAssistantText } from "@/lib/assistant/matching";

// RARE Assistant — limits, defaults and input validation (pure; shared by the Admin actions, the
// public endpoint and the tests).

export { ASSISTANT_LIMITS, ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS, ASSISTANT_REQUEST_MAX_BYTES } from "@/lib/assistant/limits";

export type AssistantConfigValues = {
  enabled: boolean;
  displayName: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  fallbackMessage: string;
  supportCtaLabel: string;
  supportCtaHref: string;
};

/** What a store gets before the operator saves anything: disabled, with neutral copy. */
export const DEFAULT_ASSISTANT_CONFIG: AssistantConfigValues = {
  enabled: false,
  displayName: "Assistente RARE",
  welcomeMessage: "Oi! Posso ajudar com dúvidas sobre pedidos, entrega, pagamento e trocas.",
  inputPlaceholder: "Digite sua dúvida",
  fallbackMessage: "Não encontrei uma resposta exata para isso. Você pode falar com a nossa equipe pelo suporte.",
  supportCtaLabel: "Falar com a equipe",
  supportCtaHref: "/suporte",
};

// Control characters (other than tab and line breaks in long texts) have no place in copy.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;

function text(max: number, options: { multiline?: boolean; min?: number } = {}) {
  return z
    .string()
    .transform((value) => (options.multiline ? value.replace(/\r\n?/g, "\n").trim() : value.replace(/\s+/g, " ").trim()))
    .pipe(
      z
        .string()
        .min(options.min ?? 1, "Campo obrigatório.")
        .max(max, `Use no máximo ${max} caracteres.`)
        .refine((value) => !CONTROL_CHARS.test(value), "Remova caracteres de controle do texto."),
    );
}

/**
 * Where the support button may lead: a path on this site ("/suporte", "/contato?x=1") or an
 * absolute https URL. Anything else (javascript:, data:, file:, http:, protocol-relative "//",
 * backslashes, credentials in the URL) is refused.
 */
export function isSafeAssistantHref(value: string) {
  const href = value.trim();
  if (!href || href.length > ASSISTANT_LIMITS.supportCtaHref || CONTROL_CHARS.test(href) || /\s/.test(href) || href.includes("\\")) return false;
  if (href.startsWith("/")) {
    if (href.startsWith("//")) return false;
    try {
      const resolved = new URL(href, "https://rare.invalid");
      return resolved.origin === "https://rare.invalid";
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(href);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const assistantConfigSchema = z.object({
  enabled: z.boolean(),
  displayName: text(ASSISTANT_LIMITS.displayName),
  welcomeMessage: text(ASSISTANT_LIMITS.welcomeMessage, { multiline: true }),
  inputPlaceholder: text(ASSISTANT_LIMITS.inputPlaceholder),
  fallbackMessage: text(ASSISTANT_LIMITS.fallbackMessage, { multiline: true }),
  supportCtaLabel: text(ASSISTANT_LIMITS.supportCtaLabel),
  supportCtaHref: z.string().trim().refine(isSafeAssistantHref, "Use um caminho do site (/suporte) ou um endereço https://."),
});

/** Keywords arrive as one text field: commas, semicolons or line breaks separate them. */
export function parseAssistantKeywords(raw: string) {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const piece of raw.split(/[,;\n\r]+/)) {
    const cleaned = piece.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const normalized = normalizeAssistantText(cleaned);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(normalized);
  }
  return keywords;
}

const keywordList = z
  .array(z.string().min(1).max(ASSISTANT_LIMITS.keyword, `Cada palavra-chave pode ter até ${ASSISTANT_LIMITS.keyword} caracteres.`))
  .max(ASSISTANT_LIMITS.keywords, `Use no máximo ${ASSISTANT_LIMITS.keywords} palavras-chave.`);

export const assistantEntrySchema = z.object({
  question: text(ASSISTANT_LIMITS.question, { min: 3 }),
  answer: text(ASSISTANT_LIMITS.answer, { multiline: true }),
  category: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(ASSISTANT_LIMITS.category, `Use no máximo ${ASSISTANT_LIMITS.category} caracteres.`).refine((value) => !CONTROL_CHARS.test(value)))
    .transform((value) => (value ? value : null)),
  keywords: keywordList,
  active: z.boolean(),
  priority: z.number().int("Prioridade deve ser um número inteiro.").min(0).max(ASSISTANT_PRIORITY_MAX, `Prioridade vai de 0 a ${ASSISTANT_PRIORITY_MAX}.`),
  sortOrder: z.number().int("Ordem deve ser um número inteiro.").min(0).max(ASSISTANT_LIMITS.sortOrder),
});

export type AssistantEntryValues = z.infer<typeof assistantEntrySchema>;

/** Public endpoint body: exactly one short message, nothing else. */
export const assistantMessageSchema = z
  .object({ message: z.string().max(ASSISTANT_LIMITS.message * 2) })
  .strict()
  .transform(({ message }) => message.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(ASSISTANT_LIMITS.message));

/** Business fields only, for the Admin audit log (no session, no shopper input, no author ids). */
export function assistantEntryAuditView(entry: Partial<AssistantEntryValues> | null | undefined) {
  if (!entry) return null;
  return {
    question: entry.question,
    answer: entry.answer,
    category: entry.category ?? null,
    keywords: entry.keywords,
    active: entry.active,
    priority: entry.priority,
    sortOrder: entry.sortOrder,
  };
}

export function assistantConfigAuditView(config: Partial<AssistantConfigValues> | null | undefined) {
  if (!config) return null;
  return {
    enabled: config.enabled,
    displayName: config.displayName,
    welcomeMessage: config.welcomeMessage,
    inputPlaceholder: config.inputPlaceholder,
    fallbackMessage: config.fallbackMessage,
    supportCtaLabel: config.supportCtaLabel,
    supportCtaHref: config.supportCtaHref,
  };
}
