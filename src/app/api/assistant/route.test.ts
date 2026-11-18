import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/assistant/store", () => ({ readPublicAssistantSnapshot: mocks.snapshot }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "@/app/api/assistant/route";
import { DEFAULT_ASSISTANT_CONFIG } from "@/lib/assistant/config";

const entries = [
  { id: "e1", question: "Qual o prazo de entrega?", answer: "Até 7 dias úteis.", category: "Entrega", keywords: ["entrega", "prazo", "chegar", "demora"], priority: 2, sortOrder: 0 },
  { id: "e2", question: "Quais formas de pagamento?", answer: "Pix e cartão.", category: "Pagamento", keywords: ["pix", "cartao", "pagamento"], priority: 0, sortOrder: 1 },
];
const enabled = { config: { ...DEFAULT_ASSISTANT_CONFIG, enabled: true }, entries };

function request(body: unknown, init: { origin?: string | null; contentType?: string | null; raw?: string } = {}) {
  const headers = new Headers({ host: "loja.test", "x-real-ip": "203.0.113.7" });
  if (init.origin !== null) headers.set("origin", init.origin ?? "http://loja.test");
  if (init.contentType !== null) headers.set("content-type", init.contentType ?? "application/json");
  return new NextRequest("http://loja.test/api/assistant", { method: "POST", headers, body: init.raw ?? JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ ok: true, remaining: 29, resetAt: Date.now() + 60_000, driver: "memory", shared: false });
  mocks.snapshot.mockResolvedValue(enabled);
});

describe("POST /api/assistant", () => {
  it("answers a matched question with the Admin's answer only (no score, keywords, priority or ids)", async () => {
    const response = await POST(request({ message: "quanto tempo demora pra chegar?" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({ matched: true, answer: "Até 7 dias úteis.", category: "Entrega", cta: null });
    const text = JSON.stringify(body);
    for (const leaked of ["keywords", "priority", "score", "confidence", "sortOrder", "e1", "createdBy", "id"]) expect(text).not.toContain(`"${leaked}`);
  });

  it("is accent and case insensitive", async () => {
    const body = await (await POST(request({ message: "QUAL O PRAZO DE ENTREGA" }))).json();
    expect(body.matched).toBe(true);
  });

  it("falls back to the configured message and support CTA when nothing is confident", async () => {
    const body = await (await POST(request({ message: "vocês vendem ingressos de cinema?" }))).json();
    expect(body).toEqual({
      matched: false,
      answer: DEFAULT_ASSISTANT_CONFIG.fallbackMessage,
      category: null,
      cta: { label: "Falar com a equipe", href: "/suporte" },
    });
  });

  it("answers 404 without any content when the assistant is disabled", async () => {
    mocks.snapshot.mockResolvedValue({ config: { ...DEFAULT_ASSISTANT_CONFIG, enabled: false }, entries: [] });
    const response = await POST(request({ message: "prazo de entrega" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Assistente indisponível." });
  });

  it("refuses another origin and a missing origin", async () => {
    expect((await POST(request({ message: "oi" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request({ message: "oi" }, { origin: null }))).status).toBe(403);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("rate limits per client address (30 per minute) before reading the body", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000, driver: "memory", shared: false });
    const response = await POST(request({ message: "prazo" }));
    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("assistant:203.0.113.7", 30, 60_000);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("requires a JSON content type", async () => {
    expect((await POST(request({ message: "oi" }, { contentType: "text/plain" }))).status).toBe(415);
    expect((await POST(request({ message: "oi" }, { contentType: null }))).status).toBe(415);
  });

  it.each([
    ["malformed JSON", { raw: "{message:" }],
    ["empty message", { raw: JSON.stringify({ message: "   " }) }],
    ["non-string message", { raw: JSON.stringify({ message: 1 }) }],
    ["extra fields", { raw: JSON.stringify({ message: "oi", customerId: "c1" }) }],
    ["too long message", { raw: JSON.stringify({ message: "x".repeat(501) }) }],
  ])("refuses %s with 400", async (_label, init) => {
    const response = await POST(request(null, init));
    expect(response.status).toBe(400);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("refuses an oversized body with 413", async () => {
    const response = await POST(request(null, { raw: JSON.stringify({ message: "x".repeat(5000) }) }));
    expect(response.status).toBe(413);
  });

  it("degrades to 503 on a database failure and never logs the shopper's message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.snapshot.mockRejectedValue(Object.assign(new Error("connection refused 10.0.0.1"), { name: "PrismaClientInitializationError" }));
    const secretQuestion = "meu cpf 123.456.789-09 prazo de entrega";
    const response = await POST(request({ message: secretQuestion }));
    expect(response.status).toBe(503);
    const logged = JSON.stringify([...error.mock.calls, ...log.mock.calls, ...info.mock.calls]);
    expect(logged).not.toContain("123.456");
    expect(logged).not.toContain("prazo");
    expect(logged).not.toContain("10.0.0.1");
    error.mockRestore();
    log.mockRestore();
    info.mockRestore();
  });

  it("renders hostile text as data: the JSON answer is the stored text, nothing is executed server side", async () => {
    mocks.snapshot.mockResolvedValue({
      config: { ...DEFAULT_ASSISTANT_CONFIG, enabled: true },
      entries: [{ ...entries[0], answer: "<script>alert(1)</script>" }],
    });
    const body = await (await POST(request({ message: "prazo de entrega" }))).json();
    expect(body.answer).toBe("<script>alert(1)</script>");
  });
});

describe("assistant endpoint is stateless", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/api/assistant/route.ts"), "utf8");
  const store = readFileSync(path.join(process.cwd(), "src/lib/assistant/store.ts"), "utf8");

  it("never writes, logs or forwards the shopper's message", () => {
    expect(source).not.toMatch(/\.(create|update|upsert|delete|createMany|updateMany)\(/);
    expect(source).not.toMatch(/site-analytics|recordClientAnalytics|cookies\(|set-cookie|fetch\(/i);
    expect(source).not.toMatch(/console\.\w+\([^)]*(parsed|message|body)/);
    expect(store).not.toMatch(/\.(create|update|upsert|delete|createMany|updateMany)\(/);
  });
});
