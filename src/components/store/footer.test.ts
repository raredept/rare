import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StoreFooter } from "@/components/store/footer";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const categories = [
  { id: "cat-camisetas", name: "Camisetas", slug: "camisetas" },
  { id: "cat-jaquetas", name: "Jaquetas", slug: "jaquetas" },
  { id: "cat-acessorios", name: "Acessórios", slug: "acessorios" },
];

describe("StoreFooter", () => {
  it("renders ecommerce footer links for categories, service, institutional pages, and contact", () => {
    const html = renderToStaticMarkup(createElement(StoreFooter, { categories, whatsappNumber: "5511999999999" }) as ReactElement);

    expect(html).toContain("RARE");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain('href="/categoria/camisetas"');
    expect(html).toContain("Trocas e devoluções");
    expect(html).toContain('href="/minha-conta/pedidos"');
    expect(html).toContain("Sobre a RARE");
    expect(html).toContain("Política de envio");
    expect(html).toContain("Privacidade e termos");
    expect(html).toContain("suporte@raredept.com.br");
    expect(html).toContain("Pagamento via Pix ou cartão disponível no checkout");
    expect(html).toContain('href="https://www.instagram.com/raredept/"');
    expect(html).toContain('href="https://wa.me/5511999999999"');
  });
});
