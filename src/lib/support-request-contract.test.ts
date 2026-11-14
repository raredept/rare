import { describe, expect, it } from "vitest";
import { generateSupportProtocol, parseSupportSubmission, SUPPORT_LIMITS } from "@/lib/support-request-contract";
import { renderSupportConfirmationEmail, renderSupportTeamEmail, supportMessageId } from "@/lib/support-requests";

const key = "8f14e45f-ceea-4e7a-9b1c-3d2a1f0e9c11";
const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
const valid = { submissionKey: key, name: "Cliente Teste", email: "Cliente@Example.com", category: "ORDER", message: "Quero saber do meu pedido, por favor." };

describe("support submission parsing", () => {
  it("accepts a valid submission and normalizes it", () => {
    const parsed = parseSupportSubmission(form({ ...valid, product: "camiseta-rare", order: "cmorder0000000000001" }));
    expect(parsed).toEqual({ ok: true, value: { submissionKey: key, name: "Cliente Teste", email: "cliente@example.com", category: "ORDER", message: "Quero saber do meu pedido, por favor.", productSlug: "camiseta-rare", orderId: "cmorder0000000000001" } });
  });

  it.each([
    ["category outside the allowlist", { category: "REFUND_NOW" }, "category"],
    ["e-mail with a header injection", { email: "a@b.com\r\nBcc: x@y.z" }, "email"],
    ["invalid e-mail", { email: "not-an-email" }, "email"],
    ["name too long", { name: "x".repeat(SUPPORT_LIMITS.nameMax + 1) }, "name"],
    ["message too short", { message: "oi" }, "message"],
    ["message too long", { message: "x".repeat(SUPPORT_LIMITS.messageMax + 1) }, "message"],
    ["missing submission key", { submissionKey: "" }, "form"],
  ])("refuses %s", (_name, overrides, fieldName) => {
    const parsed = parseSupportSubmission(form({ ...valid, ...overrides }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.fieldErrors).toHaveProperty(fieldName);
  });

  it("strips control characters from the name (no CR/LF reaches a header) and ignores malformed context", () => {
    const parsed = parseSupportSubmission(form({ ...valid, name: "Ana\r\nX-Injected: 1", product: "../etc/passwd", order: "'; DROP TABLE x;--" }));
    expect(parsed.ok && parsed.value.name).toBe("Ana X-Injected: 1");
    expect(parsed.ok && parsed.value.productSlug).toBeNull();
    expect(parsed.ok && parsed.value.orderId).toBeNull();
  });

  it("generates readable protocols without ambiguous characters", () => {
    expect(generateSupportProtocol(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toMatch(/^SUP-[2-9A-HJKMNP-Z]{8}$/);
  });
});

describe("support e-mails", () => {
  const request = {
    protocol: "SUP-ABCDEFGH", category: "SOLD_OUT_PRODUCT" as const, name: "Ana <b>Lima</b>", email: "ana@example.com",
    message: "Linha 1\n<script>alert(1)</script>", productTitleSnapshot: "Jaqueta Única", productSlugSnapshot: "jaqueta-unica",
    orderNumberSnapshot: null, createdAt: new Date("2026-11-14T15:00:00Z"),
  };

  it("sends the team the context with the customer as Reply-To, never as From, and escapes the text", () => {
    const email = renderSupportTeamEmail(request, "suporte@raredept.com.br", "https://raredept.com.br");
    expect(email.to).toBe("suporte@raredept.com.br");
    expect(email.replyTo).toBe("ana@example.com");
    expect(email.subject).toBe("[RARE Suporte] SUP-ABCDEFGH — Peça vendida ou esgotada");
    expect(email.text).toContain("Produto: Jaqueta Única (https://raredept.com.br/produto/jaqueta-unica)");
    expect(email.text).not.toContain("Pedido:");
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Lima</b>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("confirms to the customer with the protocol and no promised deadline", () => {
    const email = renderSupportConfirmationEmail(request, "suporte@raredept.com.br");
    expect(email.subject).toBe("Recebemos sua solicitação — SUP-ABCDEFGH");
    expect(email.replyTo).toBe("suporte@raredept.com.br");
    expect(email.text).not.toMatch(/\d+\s*(horas|dias|h\b)/i);
  });

  it("derives stable, distinct idempotency ids per request and part", () => {
    expect(supportMessageId("req1", "team")).toBe(supportMessageId("req1", "team"));
    expect(supportMessageId("req1", "team")).not.toBe(supportMessageId("req1", "customer"));
    expect(supportMessageId("req1", "team")).toMatch(/^<rare-[a-f0-9]{64}@raredept\.com\.br>$/);
  });
});
