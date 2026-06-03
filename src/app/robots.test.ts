import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots metadata route", () => {
  it("allows public crawl, blocks private surfaces, and points to the canonical sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(result.sitemap).toBe("https://raredept.com.br/sitemap.xml");
    expect(result.host).toBe("https://raredept.com.br");
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(
      expect.arrayContaining([
        "/admin",
        "/api",
        "/checkout",
        "/finalizar-compra",
        "/cart",
        "/conta",
        "/minha-conta",
        "/entrar",
        "/cadastro",
        "/pedido",
        "/pedidos",
      ]),
    );
    expect(rules?.disallow).not.toEqual(expect.arrayContaining(["/produto", "/categoria", "/sobre"]));
  });
});
