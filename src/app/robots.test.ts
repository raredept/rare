import { describe, expect, it } from "vitest";
import { buildRobots } from "@/app/robots";

describe("robots metadata route", () => {
  it("allows public crawl, blocks private surfaces, and points to the canonical sitemap", () => {
    const result = buildRobots({ NODE_ENV: "production", APP_URL: "https://raredept.com.br" });
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

  it("blocks preview, staging, and non-production environments", () => {
    for (const env of [
      { NODE_ENV: "development", APP_URL: "http://localhost:3000" },
      { NODE_ENV: "production", APP_URL: "https://rare-preview.up.railway.app" },
    ]) {
      const result = buildRobots(env);
      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
      expect(rules?.disallow).toBe("/");
      expect(result.sitemap).toBeUndefined();
    }
  });
});
