import { describe, expect, it } from "vitest";
import { cleanCommercialText, parsePromotionForm, previewPromotionEffect } from "@/lib/promotions/validation";

const now = new Date("2026-11-20T12:00:00Z");

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const valid = {
  name: "SALE BLACK FRIDAY", slug: "black-friday-2026", type: "PERCENTAGE", value: "25", scope: "SELECTED_PRODUCTS",
  productIds: ["prod_1", "prod_2"], startsAt: "2026-11-27T00:00", endsAt: "2026-11-30T23:59", priority: "10",
  homepageFeatured: "on", headline: "SALE BLACK FRIDAY", ctaHref: "/categoria/tudo",
};

describe("promotion form validation", () => {
  it("accepts a complete promotion and converts dates from São Paulo", () => {
    const result = parsePromotionForm(form(valid), { requireComplete: true, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({ value: 25, type: "PERCENTAGE", priority: 10, homepageFeatured: true, productIds: ["prod_1", "prod_2"], categoryIds: [] });
    expect(result.input.startsAt?.toISOString()).toBe("2026-11-27T03:00:00.000Z");
    expect(result.input.endsAt?.toISOString()).toBe("2026-12-01T02:59:00.000Z");
  });

  it.each([
    [{ value: "-10" }, "O desconto deve ser maior que zero."],
    [{ value: "0" }, "O desconto deve ser maior que zero."],
    [{ value: "101" }, "O percentual não pode passar de 100%."],
    [{ value: "12.5" }, "O percentual deve ser um número inteiro."],
    [{ type: "FIXED_AMOUNT", value: "-5,00" }, "O desconto não pode ser negativo."],
    [{ endsAt: "2026-11-26T00:00" }, "O fim deve ser depois do início."],
    [{ productIds: [] }, "Selecione ao menos um produto."],
    [{ scope: "SELECTED_CATEGORIES" }, "Selecione ao menos uma categoria."],
    [{ scope: "EVERYTHING" }, "Escopo inválido."],
    [{ type: "BOGO" }, "Tipo de desconto inválido."],
    [{ ctaHref: "https://evil.example/" }, "O link do CTA deve ser um caminho interno da loja (ex.: /categoria/tudo)."],
    [{ ctaHref: "//evil.example" }, "O link do CTA deve ser um caminho interno da loja (ex.: /categoria/tudo)."],
    [{ bannerImageUrl: "javascript:alert(1)" }, "A imagem do banner deve ser um caminho interno ou uma URL https."],
    [{ startsAt: "2026-11-01T00:00", endsAt: "2026-11-10T00:00" }, "O fim da promoção já passou."],
  ])("rejects %j", (override, message) => {
    const result = parsePromotionForm(form({ ...valid, ...override }), { requireComplete: true, now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain(message);
  });

  it("lets a draft be saved incomplete (no value, no targets), but never invalid", () => {
    const draft = parsePromotionForm(form({ name: "Rascunho", type: "PERCENTAGE", scope: "SELECTED_PRODUCTS" }), { requireComplete: false, now });
    expect(draft.ok).toBe(true);
    const invalid = parsePromotionForm(form({ name: "Rascunho", type: "PERCENTAGE", scope: "SELECTED_PRODUCTS", value: "150" }), { requireComplete: false, now });
    expect(invalid.ok).toBe(false);
  });

  it("only reads allowlisted fields (mass assignment)", () => {
    const result = parsePromotionForm(form({ ...valid, status: "ACTIVE", createdById: "attacker", id: "x", updatedAt: "2000-01-01" }), { requireComplete: true, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const key of ["status", "createdById", "updatedById", "id", "updatedAt"]) expect(result.input).not.toHaveProperty(key);
  });

  it("stores commercial text as plain text (no HTML)", () => {
    const result = parsePromotionForm(form({ ...valid, headline: "<script>alert(1)</script>SALE", badgeText: "<b>BF</b>" }), { requireComplete: true, now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.headline).not.toMatch(/[<>]/);
    expect(result.input.badgeText).not.toMatch(/[<>]/);
    expect(cleanCommercialText("a\u0000b\nc", 10)).toBe("a b c");
  });

  it("drops malformed target ids", () => {
    const result = parsePromotionForm(form({ ...valid, productIds: ["prod_1", "'; DROP TABLE", "prod_1"] }), { requireComplete: true, now });
    expect(result.ok && result.input.productIds).toEqual(["prod_1"]);
  });

  it("previews the effect before saving, including products it cannot apply to", () => {
    expect(previewPromotionEffect({ type: "FIXED_AMOUNT", value: 5000 }, [
      { id: "a", title: "A", priceInCents: 20000 },
      { id: "b", title: "B", priceInCents: 4000 },
    ])).toEqual([
      { productId: "a", title: "A", basePriceInCents: 20000, finalPriceInCents: 15000, reason: "applies" },
      { productId: "b", title: "B", basePriceInCents: 4000, finalPriceInCents: null, reason: "price_too_low" },
    ]);
  });
});
