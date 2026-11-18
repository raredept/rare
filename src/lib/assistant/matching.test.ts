import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MATCH_THRESHOLD,
  matchAssistantEntry,
  normalizeAssistantText,
  tokenizeAssistantText,
  type AssistantMatchEntry,
} from "@/lib/assistant/matching";
import { deterministicAssistantEngine, getAssistantEngine } from "@/lib/assistant/engine";

// Synthetic fixtures only (no real store copy).
function entry(id: string, question: string, keywords: string[] = [], extra: Partial<AssistantMatchEntry> = {}): AssistantMatchEntry {
  return { id, question, answer: `Resposta ${id}`, category: null, keywords, priority: 0, sortOrder: 0, ...extra };
}

const delivery = entry("delivery", "Qual o prazo de entrega?", ["entrega", "prazo", "frete", "chegar", "demora", "envio"], { category: "Entrega" });
const payment = entry("payment", "Quais formas de pagamento vocês aceitam?", ["pagamento", "pix", "cartão", "parcelar", "boleto"], { category: "Pagamento" });
const exchange = entry("exchange", "Como faço uma troca?", ["troca", "trocar", "devolução", "devolver", "tamanho errado"], { category: "Trocas" });
const tracking = entry("tracking", "Como acompanho meu pedido?", ["rastreio", "rastrear", "código de rastreio", "acompanhar"], { category: "Pedidos" });
const catalog = [delivery, payment, exchange, tracking];

describe("normalizeAssistantText", () => {
  it("trims, lowercases, strips accents and punctuation and collapses whitespace", () => {
    expect(normalizeAssistantText("  Qual É o PRAZO   de entrega?!  ")).toBe("qual e o prazo de entrega");
    expect(normalizeAssistantText("Devolução / troca — cartão")).toBe("devolucao troca cartao");
    expect(normalizeAssistantText("")).toBe("");
    expect(normalizeAssistantText("?!...")).toBe("");
  });

  it("drops stopwords and empty tokens and folds plurals", () => {
    expect(tokenizeAssistantText("Quais são as formas de pagamento?")).toEqual(["forma", "pagamento"]);
    expect(tokenizeAssistantText("   ")).toEqual([]);
    expect(tokenizeAssistantText("como qual de o a")).toEqual([]);
    expect(tokenizeAssistantText("devoluções")).toEqual(["devolucao"]);
  });
});

describe("matchAssistantEntry", () => {
  it("matches the exact question with full confidence", () => {
    const result = matchAssistantEntry("Qual o prazo de entrega?", catalog);
    expect(result).toMatchObject({ matched: true, entry: { id: "delivery" }, score: 1, reason: "exact" });
  });

  it("is case, accent and punctuation insensitive", () => {
    const result = matchAssistantEntry("QUAL O PRAZO DE ENTREGA", catalog);
    expect(result).toMatchObject({ matched: true, entry: { id: "delivery" }, reason: "exact" });
    const accents = matchAssistantEntry("como faco uma troca", catalog);
    expect(accents).toMatchObject({ matched: true, entry: { id: "exchange" } });
  });

  it("finds an answer through keywords / synonyms the question never uses", () => {
    const result = matchAssistantEntry("quanto tempo demora pra chegar?", catalog);
    expect(result).toMatchObject({ matched: true, entry: { id: "delivery" }, reason: "keywords" });
    expect(matchAssistantEntry("da pra parcelar no cartao?", catalog)).toMatchObject({ matched: true, entry: { id: "payment" } });
    expect(matchAssistantEntry("onde está o código de rastreio", catalog)).toMatchObject({ matched: true, entry: { id: "tracking" } });
  });

  it("matches keyword phrases as whole words, never as substrings", () => {
    const onlyPhrase = [entry("size", "Pergunta qualquer", ["tamanho errado"])];
    expect(matchAssistantEntry("recebi o tamanho errado", onlyPhrase).matched).toBe(true);
    expect(matchAssistantEntry("tamanho", onlyPhrase).matched).toBe(false);
    // "pix" must not match inside "pixel".
    expect(matchAssistantEntry("pixel", [entry("pix", "Aceita?", ["pix"])]).matched).toBe(false);
  });

  it("uses token overlap with the registered question", () => {
    const result = matchAssistantEntry("prazo da entrega", [delivery]);
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.reason).toBe("keywords+tokens");
  });

  it("falls back instead of guessing when nothing is confident", () => {
    for (const message of ["vocês vendem ingressos de cinema?", "qual a cor do céu", "como", "???", "oi tudo bem"]) {
      const result = matchAssistantEntry(message, catalog);
      expect(result.matched, message).toBe(false);
    }
  });

  it("returns a fallback for empty input and for an empty catalog", () => {
    expect(matchAssistantEntry("", catalog)).toEqual({ matched: false, score: 0, best: null });
    expect(matchAssistantEntry("   ", catalog)).toEqual({ matched: false, score: 0, best: null });
    expect(matchAssistantEntry("prazo de entrega", [])).toEqual({ matched: false, score: 0, best: null });
  });

  it("reports the closest candidate below the threshold for the Admin preview", () => {
    const result = matchAssistantEntry("pedido", [entry("x", "Posso cancelar o pedido depois de pago?")]);
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.best?.entry.id).toBe("x");
      expect(result.score).toBeLessThan(ASSISTANT_MATCH_THRESHOLD);
    }
  });

  it("lets priority break a tie between answers of similar strength", () => {
    const low = entry("low", "Prazo para troca", ["prazo"], { priority: 0 });
    const high = entry("high", "Prazo para envio", ["prazo"], { priority: 8 });
    expect(matchAssistantEntry("prazo", [low, high])).toMatchObject({ matched: true, entry: { id: "high" } });
    expect(matchAssistantEntry("prazo", [high, low])).toMatchObject({ matched: true, entry: { id: "high" } });
  });

  it("never lets priority rescue a weak match or beat a clearly stronger one", () => {
    const weak = entry("weak", "Horário de funcionamento da unidade física do shopping", [], { priority: 10 });
    expect(matchAssistantEntry("funcionamento", [weak]).matched).toBe(false);
    const strong = entry("strong", "Como faço uma troca?", ["troca", "trocar"], { priority: 0 });
    const promoted = entry("promoted", "Política de trocas e devoluções", [], { priority: 10 });
    expect(matchAssistantEntry("como faço uma troca", [promoted, strong])).toMatchObject({ matched: true, entry: { id: "strong" } });
  });

  it("is deterministic: same score and priority resolve by sortOrder, then id", () => {
    const first = entry("b", "Prazo A", ["prazo"], { sortOrder: 1 });
    const second = entry("a", "Prazo B", ["prazo"], { sortOrder: 2 });
    expect(matchAssistantEntry("prazo", [second, first])).toMatchObject({ entry: { id: "b" } });
    const tieA = entry("a", "Prazo A", ["prazo"]);
    const tieB = entry("b", "Prazo B", ["prazo"]);
    expect(matchAssistantEntry("prazo", [tieB, tieA])).toMatchObject({ entry: { id: "a" } });
  });

  it("handles long and hostile input without throwing", () => {
    const long = "entrega ".repeat(400);
    expect(matchAssistantEntry(long, catalog)).toMatchObject({ matched: true, entry: { id: "delivery" } });
    expect(matchAssistantEntry("<script>alert(1)</script>", catalog).matched).toBe(false);
    expect(matchAssistantEntry("<img src=x onerror=alert(1)> javascript:alert(1)", catalog).matched).toBe(false);
  });
});

describe("assistant engine", () => {
  it("the storefront and the Admin preview share the deterministic engine", () => {
    expect(getAssistantEngine()).toBe(deterministicAssistantEngine);
    expect(getAssistantEngine().id).toBe("deterministic-v1");
  });

  it("answers only with the Admin's text, or a fallback with no text of its own", () => {
    const answer = deterministicAssistantEngine.answer({ message: "prazo de entrega", entries: catalog });
    expect(answer).toMatchObject({ kind: "answer", text: "Resposta delivery", category: "Entrega" });
    const fallback = deterministicAssistantEngine.answer({ message: "receita de bolo", entries: catalog });
    expect(fallback.kind).toBe("fallback");
    expect(Object.keys(fallback)).not.toContain("text");
  });
});
