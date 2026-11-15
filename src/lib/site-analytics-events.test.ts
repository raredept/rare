import { describe, expect, it } from "vitest";
import { ANALYTICS_BATCH_LIMIT, normalizeAnalyticsPath, parseAnalyticsBatch } from "@/lib/site-analytics-events";

const visitor = "8f14e45f-ceea-4e7a-9b1c-3d2a1f0e9c11";
const session = "c9f0f895-fb98-4b91-8c4e-2a7d6e5b4a33";
const product = "cm1abcdefgh0123456789";

describe("analytics path normalisation", () => {
  it.each([
    ["/", "/"],
    ["/produto/camiseta-rare", "/produto/camiseta-rare"],
    ["/categoria/tudo?utm_source=x&email=a@b.c", "/categoria/tudo"],
    ["/produto/x#frag", "/produto/x"],
    ["/produto/x/", "/produto/x"],
    ["/minha-conta/pedidos/RARE-123", "/minha-conta"],
    ["/pedido/RARE-123?token=abc", "/pedido"],
    ["/finalizar-compra?coupon=X", "/finalizar-compra"],
    ["/produto/<script>", "/produto/-3Cscript-3E"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeAnalyticsPath(input)).toBe(expected);
  });

  it.each(["/admin", "/admin/orders", "/api/checkout", "https://evil.example/x", "//evil.example/x", "produto", 42, null])("does not record %s", (input) => {
    expect(normalizeAnalyticsPath(input)).toBeNull();
  });

  it("caps the length", () => {
    expect(normalizeAnalyticsPath(`/produto/${"a".repeat(500)}`)!.length).toBe(160);
  });
});

describe("analytics batch parsing", () => {
  const batch = (events: unknown[], overrides: Record<string, unknown> = {}) => ({ v: visitor, s: session, events, ...overrides });

  it("keeps allowlisted behavioural events only", () => {
    const parsed = parseAnalyticsBatch(batch([
      { type: "page_view", path: "/" },
      { type: "product_view", path: "/produto/x", productId: product },
      { type: "product_click", path: "/categoria/tudo", productId: product },
      { type: "add_to_cart", path: "/produto/x", productId: product },
      // The browser can never claim checkout, payment or purchase.
      { type: "purchase_confirmed", path: "/pedido", productId: product },
      { type: "checkout_started", path: "/finalizar-compra" },
      { type: "payment_started", path: "/finalizar-compra" },
      { type: "admin_login", path: "/" },
    ]));
    expect(parsed?.events.map((event) => event.type)).toEqual(["page_view", "product_view", "product_click", "add_to_cart"]);
  });

  it("never keeps fields outside the contract (no PII can ride along)", () => {
    const parsed = parseAnalyticsBatch(batch([{ type: "page_view", path: "/", email: "a@b.c", cpf: "12345678909", name: "Fulano", ip: "1.2.3.4" }], { userAgent: "x", email: "a@b.c" }));
    expect(JSON.stringify(parsed)).not.toMatch(/a@b\.c|12345678909|Fulano|1\.2\.3\.4|userAgent/);
    expect(parsed?.events).toEqual([{ type: "page_view", path: "/", productId: null }]);
  });

  it("drops product events without a valid product id and ignores a product id on page views", () => {
    const parsed = parseAnalyticsBatch(batch([
      { type: "product_view", path: "/produto/x" },
      { type: "product_click", path: "/", productId: "'; DROP TABLE x;--" },
      { type: "add_to_cart", path: "/", productId: "a".repeat(80) },
      { type: "page_view", path: "/", productId: product },
    ]));
    expect(parsed?.events).toEqual([{ type: "page_view", path: "/", productId: null }]);
  });

  it.each([
    ["not an object", "x"],
    ["an array", []],
    ["a non-UUID visitor", batch([{ type: "page_view", path: "/" }], { v: "fulano@email.com" })],
    ["a missing session", { v: visitor, events: [{ type: "page_view", path: "/" }] }],
    ["no events", batch([])],
    ["too many events", batch(Array.from({ length: ANALYTICS_BATCH_LIMIT + 1 }, () => ({ type: "page_view", path: "/" })))],
  ])("rejects %s", (_name, body) => {
    expect(parseAnalyticsBatch(body)).toBeNull();
  });
});
