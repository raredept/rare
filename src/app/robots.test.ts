import { describe, expect, it } from "vitest";
import { buildRobots } from "@/app/robots";

describe("robots metadata route", () => {
  it("allows public crawl, blocks private surfaces, and points to the canonical sitemap", () => {
    const result = buildRobots({ NODE_ENV: "production", APP_URL: "https://raredept.com.br" });
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(result.sitemap).toBe("https://raredept.com.br/sitemap.xml");
    // Google ignores "host"; it is no longer emitted.
    expect(result.host).toBeUndefined();
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(
      expect.arrayContaining([
        "/admin",
        "/api",
        "/checkout",
        "/finalizar-compra",
        "/cart",
        "/conta$",
        "/conta/",
        "/minha-conta",
        "/entrar",
        "/cadastro",
        "/pedido",
        "/pedidos",
      ]),
    );
    expect(rules?.disallow).not.toEqual(expect.arrayContaining(["/produto", "/categoria", "/sobre"]));
  });

  // robots.txt rules are prefix matches (RFC 9309 / Google): a bare "/conta" also blocked "/contato".
  function isDisallowed(path: string, disallow: string[]) {
    return disallow.some((rule) => (rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule)));
  }

  it("never blocks a public page through a shared prefix with a private route", () => {
    const result = buildRobots({ NODE_ENV: "production", APP_URL: "https://raredept.com.br" });
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = ([] as string[]).concat(rules?.disallow ?? []);
    const publicPaths = [
      "/", "/sobre", "/contato", "/suporte", "/politica-de-envio", "/privacidade-e-termos", "/politica-de-cookies",
      "/trocas-e-devolucoes", "/categoria/tudo", "/categoria/camisetas", "/produto/camiseta-supreme", "/colecao/black-friday-sale",
      "/feeds/google-products.xml", "/sitemap.xml", "/brand/rare-logo.png", "/_next/static/chunks/app.js", "/_next/image",
    ];
    for (const path of publicPaths) expect(isDisallowed(path, disallow), path).toBe(false);
    for (const path of ["/conta", "/conta/dados", "/minha-conta", "/minha-conta/pedidos", "/admin", "/api/health", "/checkout", "/finalizar-compra", "/cart", "/entrar", "/cadastro", "/pedido/abc", "/pedidos"]) {
      expect(isDisallowed(path, disallow), path).toBe(true);
    }
  });

  it("blocks preview, staging, and non-production environments", () => {
    for (const env of [
      { NODE_ENV: "development", APP_URL: "http://localhost:3000" },
      { NODE_ENV: "production", APP_URL: "https://rare-preview.up.railway.app" },
      { NODE_ENV: "production", APP_ENV: "staging", APP_URL: "https://raredept.com.br" },
    ]) {
      const result = buildRobots(env);
      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
      expect(rules?.disallow).toBe("/");
      expect(result.sitemap).toBeUndefined();
    }
  });
});
