// RARE Assistant — deterministic matching (pure: no database, no Node APIs, no network).
//
// The assistant never writes an answer: it only picks one the Admin wrote, or falls back. The same
// function serves the storefront endpoint and the Admin "Testar Assistente" preview, so what the
// operator tests is exactly what a shopper gets.

export type AssistantMatchEntry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  keywords: readonly string[];
  priority: number;
  sortOrder: number;
};

export type AssistantMatchReason = "exact" | "keywords" | "tokens" | "keywords+tokens";

export type AssistantMatchResult<Entry extends AssistantMatchEntry = AssistantMatchEntry> =
  | { matched: true; entry: Entry; score: number; reason: AssistantMatchReason; runnerUp: { entry: Entry; score: number } | null }
  | { matched: false; score: number; best: { entry: Entry; score: number } | null };

/** Below this confidence the assistant answers the configured fallback instead of guessing. */
export const ASSISTANT_MATCH_THRESHOLD = 0.5;
/** Each priority point is worth this much when ranking candidates that both cleared the threshold. */
const PRIORITY_WEIGHT = 0.012;
export const ASSISTANT_PRIORITY_MAX = 10;
const MAX_MESSAGE_TOKENS = 60;

// Portuguese function words and question openers. They carry no topic, so two sentences sharing
// only "como", "qual" or "de" must not look alike.
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "d", "e", "ou", "em", "no", "na",
  "nos", "nas", "ao", "aos", "a", "para", "pra", "pro", "por", "pelo", "pela", "com", "sem", "que", "se", "me", "te",
  "eu", "voce", "voces", "vc", "vcs", "ele", "ela", "eles", "elas", "meu", "minha", "meus", "minhas", "seu", "sua",
  "seus", "suas", "nosso", "nossa", "isso", "isto", "esse", "essa", "este", "esta", "aquele", "aquela", "qual",
  "quais", "como", "onde", "quando", "quanto", "quantos", "quanta", "quantas", "porque", "porquê", "oque", "ser", "e",
  "sao", "foi", "ter", "tem", "tenho", "tenha", "ha", "vou", "vai", "ja", "nao", "sim", "mais", "muito", "muita",
  "algum", "alguma", "ola", "oi", "bom", "boa", "dia", "tarde", "noite", "obrigado", "obrigada", "favor", "gostaria",
  "queria", "quero", "saber", "posso", "pode", "podem", "consigo", "faco", "fazer", "faz", "lo", "la", "rare", "loja",
]);

/** trim → lowercase → NFD → strip accents → strip punctuation → collapse whitespace. */
export function normalizeAssistantText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plural and simple inflection folding, applied the same way to both sides. */
function stem(token: string) {
  if (token.length > 4 && token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.length > 4 && token.endsWith("aes")) return `${token.slice(0, -3)}ao`;
  if (token.length > 4 && token.endsWith("ns")) return `${token.slice(0, -2)}m`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Topic tokens of a text: normalised, without stopwords, folded. Empty tokens never survive. */
export function tokenizeAssistantText(value: string) {
  const tokens: string[] = [];
  for (const raw of normalizeAssistantText(value).split(" ")) {
    if (!raw || STOPWORDS.has(raw)) continue;
    if (raw.length < 2 && !/^\d$/.test(raw)) continue;
    tokens.push(stem(raw));
    if (tokens.length >= MAX_MESSAGE_TOKENS) break;
  }
  return tokens;
}

/** A keyword matches as a whole word or as a contiguous phrase of whole words, never as a substring. */
function keywordMatches(keyword: string, messageTokens: readonly string[], messageTokenSet: ReadonlySet<string>) {
  const parts = normalizeAssistantText(keyword).split(" ").filter(Boolean).map(stem);
  if (parts.length === 0) return false;
  if (parts.length === 1) return messageTokenSet.has(parts[0]);
  // Phrases keep their stopwords out of the comparison too ("prazo de entrega" == "prazo entrega").
  const meaningful = parts.filter((part) => !STOPWORDS.has(part));
  if (meaningful.length === 0) return false;
  for (let start = 0; start + meaningful.length <= messageTokens.length; start += 1) {
    if (meaningful.every((part, offset) => messageTokens[start + offset] === part)) return true;
  }
  return false;
}

type Scored<Entry> = { entry: Entry; score: number; reason: AssistantMatchReason };

function scoreEntry<Entry extends AssistantMatchEntry>(
  entry: Entry,
  normalizedMessage: string,
  messageTokens: readonly string[],
  messageTokenSet: ReadonlySet<string>,
): Scored<Entry> {
  if (normalizedMessage && normalizeAssistantText(entry.question) === normalizedMessage) {
    return { entry, score: 1, reason: "exact" };
  }

  // Token overlap with the question (Dice coefficient on distinct topic tokens).
  const questionTokens = new Set(tokenizeAssistantText(entry.question));
  let shared = 0;
  for (const token of questionTokens) if (messageTokenSet.has(token)) shared += 1;
  const tokenScore = questionTokens.size + messageTokenSet.size > 0 ? (2 * shared) / (questionTokens.size + messageTokenSet.size) : 0;

  // Distinct keyword / synonym hits: 1 → 0.55, 2 → 0.80, 3 → 0.91 …
  const seen = new Set<string>();
  let hits = 0;
  for (const keyword of entry.keywords) {
    const key = normalizeAssistantText(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (keywordMatches(keyword, messageTokens, messageTokenSet)) hits += 1;
  }
  const keywordScore = hits > 0 ? 1 - 0.45 ** hits : 0;

  // Either signal can carry a match; both together reinforce it (probabilistic OR), never above 0.99.
  const combined = Math.min(0.99, 1 - (1 - tokenScore) * (1 - keywordScore));
  const reason: AssistantMatchReason = keywordScore > 0 && tokenScore > 0 ? "keywords+tokens" : keywordScore > 0 ? "keywords" : "tokens";
  return { entry, score: Math.round(combined * 1000) / 1000, reason };
}

function clampPriority(priority: number) {
  return Number.isFinite(priority) ? Math.min(ASSISTANT_PRIORITY_MAX, Math.max(0, Math.trunc(priority))) : 0;
}

/**
 * Pick the best answer for a shopper message, or report that none is confident enough.
 * Ranking: candidates under the threshold are discarded first (priority can never rescue a weak
 * match); among the rest, score plus a small priority bonus, then sortOrder, then id, so the
 * result is fully deterministic.
 */
export function matchAssistantEntry<Entry extends AssistantMatchEntry>(
  message: string,
  entries: readonly Entry[],
  threshold = ASSISTANT_MATCH_THRESHOLD,
): AssistantMatchResult<Entry> {
  const normalizedMessage = normalizeAssistantText(message);
  const messageTokens = tokenizeAssistantText(message);
  const messageTokenSet = new Set(messageTokens);
  if (!normalizedMessage || entries.length === 0) return { matched: false, score: 0, best: null };

  const scored = entries.map((entry) => scoreEntry(entry, normalizedMessage, messageTokens, messageTokenSet));
  const rank = (candidate: Scored<Entry>) => candidate.score + clampPriority(candidate.entry.priority) * PRIORITY_WEIGHT;
  const ordered = [...scored].sort(
    (first, second) =>
      rank(second) - rank(first) ||
      first.entry.sortOrder - second.entry.sortOrder ||
      (first.entry.id < second.entry.id ? -1 : first.entry.id > second.entry.id ? 1 : 0),
  );
  const eligible = ordered.filter((candidate) => candidate.score >= threshold);
  if (eligible.length === 0) {
    const best = [...scored].sort((first, second) => second.score - first.score)[0] ?? null;
    return { matched: false, score: best?.score ?? 0, best: best && best.score > 0 ? { entry: best.entry, score: best.score } : null };
  }

  const [winner, second] = eligible;
  return {
    matched: true,
    entry: winner.entry,
    score: winner.score,
    reason: winner.reason,
    runnerUp: second ? { entry: second.entry, score: second.score } : null,
  };
}
