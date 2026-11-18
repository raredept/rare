import { describe, expect, it } from "vitest";
import {
  ASSISTANT_LIMITS,
  assistantConfigAuditView,
  assistantConfigSchema,
  assistantEntryAuditView,
  assistantEntrySchema,
  assistantMessageSchema,
  DEFAULT_ASSISTANT_CONFIG,
  isSafeAssistantHref,
  parseAssistantKeywords,
} from "@/lib/assistant/config";

const validEntry = {
  question: "Qual o prazo de entrega?",
  answer: "Linha 1\nLinha 2",
  category: "Entrega",
  keywords: ["entrega", "prazo"],
  active: true,
  priority: 3,
  sortOrder: 10,
};

describe("assistant defaults", () => {
  it("starts disabled with the owner's default copy", () => {
    expect(DEFAULT_ASSISTANT_CONFIG.enabled).toBe(false);
    expect(DEFAULT_ASSISTANT_CONFIG.displayName).toBe("Assistente RARE");
    expect(DEFAULT_ASSISTANT_CONFIG.fallbackMessage).toBe("Não encontrei uma resposta exata para isso. Você pode falar com a nossa equipe pelo suporte.");
    expect(DEFAULT_ASSISTANT_CONFIG.supportCtaLabel).toBe("Falar com a equipe");
    expect(DEFAULT_ASSISTANT_CONFIG.supportCtaHref).toBe("/suporte");
    expect(assistantConfigSchema.safeParse(DEFAULT_ASSISTANT_CONFIG).success).toBe(true);
  });
});

describe("isSafeAssistantHref", () => {
  it.each(["/suporte", "/contato?assunto=pedido", "/trocas-e-devolucoes#prazo", "https://wa.me/5511999999999", "https://raredept.com.br/suporte"])("accepts %s", (href) => {
    expect(isSafeAssistantHref(href)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "http://example.com",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://user:pass@evil.example",
    "mailto:a@b.c",
    "suporte",
    "",
    "/supor te",
    `/${"a".repeat(400)}`,
  ])("refuses %s", (href) => {
    expect(isSafeAssistantHref(href)).toBe(false);
  });
});

describe("assistantConfigSchema", () => {
  it("enforces the length limits", () => {
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, displayName: "x".repeat(ASSISTANT_LIMITS.displayName + 1) }).success).toBe(false);
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, welcomeMessage: "x".repeat(501) }).success).toBe(false);
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, fallbackMessage: "x".repeat(501) }).success).toBe(false);
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, inputPlaceholder: "x".repeat(121) }).success).toBe(false);
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, displayName: "   " }).success).toBe(false);
  });

  it("refuses an unsafe support link", () => {
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, supportCtaHref: "javascript:alert(1)" }).success).toBe(false);
  });

  it("refuses control and bidi-override characters", () => {
    expect(assistantConfigSchema.safeParse({ ...DEFAULT_ASSISTANT_CONFIG, displayName: `RARE${String.fromCharCode(0x202e)}` }).success).toBe(false);
  });
});

describe("assistantEntrySchema", () => {
  it("accepts a valid entry and keeps line breaks in the answer", () => {
    const parsed = assistantEntrySchema.parse({ ...validEntry, answer: "Linha 1\r\nLinha 2  " });
    expect(parsed.answer).toBe("Linha 1\nLinha 2");
  });

  it("stores HTML-looking text as plain text (rendering escapes it)", () => {
    const parsed = assistantEntrySchema.parse({ ...validEntry, answer: "<script>alert(1)</script> <img src=x onerror=alert(1)>" });
    expect(parsed.answer).toBe("<script>alert(1)</script> <img src=x onerror=alert(1)>");
  });

  it("turns an empty category into null", () => {
    expect(assistantEntrySchema.parse({ ...validEntry, category: "  " }).category).toBeNull();
  });

  it.each([
    ["question too short", { question: "ab" }],
    ["question too long", { question: "x".repeat(301) }],
    ["answer too long", { answer: "x".repeat(2001) }],
    ["empty answer", { answer: "  " }],
    ["category too long", { category: "x".repeat(81) }],
    ["too many keywords", { keywords: Array.from({ length: 31 }, (_, index) => `k${index}`) }],
    ["keyword too long", { keywords: ["x".repeat(81)] }],
    ["priority above max", { priority: 11 }],
    ["negative priority", { priority: -1 }],
    ["fractional sort", { sortOrder: 1.5 }],
    ["NaN priority", { priority: Number.NaN }],
  ])("refuses %s", (_label, override) => {
    expect(assistantEntrySchema.safeParse({ ...validEntry, ...override }).success).toBe(false);
  });
});

describe("parseAssistantKeywords", () => {
  it("splits on commas, semicolons and line breaks, normalises and de-duplicates", () => {
    expect(parseAssistantKeywords("Entrega, PRAZO;frete\nchegar\r\n entrega ,, Devolução")).toEqual(["entrega", "prazo", "frete", "chegar", "devolucao"]);
    expect(parseAssistantKeywords("   ")).toEqual([]);
  });
});

describe("assistantMessageSchema (public endpoint body)", () => {
  it("accepts one short message", () => {
    expect(assistantMessageSchema.parse({ message: "  qual o   prazo?  " })).toBe("qual o prazo?");
  });

  it.each([
    ["empty", { message: "   " }],
    ["too long", { message: "x".repeat(501) }],
    ["wrong type", { message: 42 }],
    ["missing", {}],
    ["extra fields", { message: "oi", customerId: "c1" }],
    ["array", ["oi"]],
    ["null", null],
  ])("refuses %s", (_label, body) => {
    expect(assistantMessageSchema.safeParse(body).success).toBe(false);
  });
});

describe("audit views", () => {
  it("keep business fields only", () => {
    expect(Object.keys(assistantEntryAuditView(validEntry) ?? {}).sort()).toEqual(["active", "answer", "category", "keywords", "priority", "question", "sortOrder"]);
    expect(Object.keys(assistantConfigAuditView(DEFAULT_ASSISTANT_CONFIG) ?? {}).sort()).toEqual(
      ["displayName", "enabled", "fallbackMessage", "inputPlaceholder", "supportCtaHref", "supportCtaLabel", "welcomeMessage"],
    );
    expect(assistantEntryAuditView(null)).toBeNull();
  });
});
