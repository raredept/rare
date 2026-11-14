import { describe, expect, it } from "vitest";
import { getAdminPageLabel } from "@/lib/admin-page-label";

describe("Admin header page label", () => {
  it.each([
    ["/admin", "Visão geral"],
    ["/admin/analytics", "Analytics"],
    ["/admin/products", "Produtos"],
    ["/admin/products/new", "Novo produto"],
    ["/admin/products/abc123", "Editar produto"],
    ["/admin/orders/abc123", "Detalhes do pedido"],
    ["/admin/customers/abc123", "Detalhes do cliente"],
    ["/admin/categories/abc123", "Editar categoria"],
    ["/admin/settings", "Configurações"],
  ])("keeps the backend shell labels: %s", (pathname, label) => {
    expect(getAdminPageLabel(pathname)).toBe(label);
  });

  it.each([
    ["/admin/promotions", "Promoções"],
    ["/admin/promotions/new", "Nova promoção"],
    ["/admin/promotions/promo_1", "Detalhes da promoção"],
    ["/admin/promotions/promo_1/edit", "Editar promoção"],
    ["/admin/promotions/promo_1/preview", "Pré-visualizar promoção"],
    ["/admin/security", "Segurança"],
  ])("names the promotion and security sections instead of the generic title: %s", (pathname, label) => {
    expect(getAdminPageLabel(pathname)).toBe(label);
  });

  it("falls back to the generic title only for unknown routes", () => {
    expect(getAdminPageLabel("/admin/unknown")).toBe("Admin");
  });
});
