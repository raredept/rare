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
        "/conta?",
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

  /**
   * Google robots.txt matching (RFC 9309 + Google's documented extensions): the rule is matched against the
   * path INCLUDING its query string, as a prefix; "*" matches any run of characters; a trailing "$" anchors the
   * end of the URL; every other character (including "?") is literal.
   */
  function robotsRuleMatches(rule: string, pathWithQuery: string) {
    const anchored = rule.endsWith("$");
    const body = anchored ? rule.slice(0, -1) : rule;
    const pattern = body.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(pathWithQuery);
  }

  function productionDisallow() {
    const result = buildRobots({ NODE_ENV: "production", APP_URL: "https://raredept.com.br" });
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    return ([] as string[]).concat(rules?.disallow ?? []);
  }

  function isDisallowed(pathWithQuery: string, disallow: string[]) {
    return disallow.some((rule) => robotsRuleMatches(rule, pathWithQuery));
  }

  it("matches rules the way Google does (prefix, query string, '*', '$')", () => {
    expect(robotsRuleMatches("/conta", "/contato")).toBe(true); // prefix: the original production bug
    expect(robotsRuleMatches("/conta$", "/conta")).toBe(true);
    expect(robotsRuleMatches("/conta$", "/conta?tab=perfil")).toBe(false); // "$" is the end of path + query
    expect(robotsRuleMatches("/conta$", "/contato")).toBe(false);
    expect(robotsRuleMatches("/conta?", "/conta?tab=perfil")).toBe(true); // "?" is literal
    expect(robotsRuleMatches("/conta?", "/contato")).toBe(false);
    expect(robotsRuleMatches("/conta?", "/conta")).toBe(false);
    expect(robotsRuleMatches("/*?*sort=", "/categoria/tudo?sort=price-asc")).toBe(true);
    expect(robotsRuleMatches("/*.xml$", "/sitemap.xml")).toBe(true);
    expect(robotsRuleMatches("/*.xml$", "/sitemap.xml?x=1")).toBe(false);
  });

  it("blocks /conta with or without a query string and its children, but never /contato", () => {
    const disallow = productionDisallow();
    expect(disallow).not.toContain("/conta"); // the bare prefix blocked /contato
    for (const path of ["/conta", "/conta?tab=perfil", "/conta?redirect=x", "/conta?redirect=/pedidos", "/conta/dados"]) {
      expect(isDisallowed(path, disallow), path).toBe(true);
    }
    for (const path of ["/contato", "/contato?utm_source=x", "/contato/"]) {
      expect(isDisallowed(path, disallow), path).toBe(false);
    }
  });

  it("never blocks a public page through a shared prefix with a private route", () => {
    const disallow = productionDisallow();
    const publicPaths = [
      "/", "/sobre", "/contato", "/contato?utm_source=x", "/suporte", "/politica-de-envio", "/privacidade-e-termos", "/politica-de-cookies",
      "/trocas-e-devolucoes", "/categoria/tudo", "/categoria/camisetas", "/categoria/camisetas?page=2", "/produto/camiseta-supreme",
      "/produto/camiseta-supreme?size=M", "/colecao/black-friday-sale",
      "/feeds/google-products.xml", "/sitemap.xml", "/brand/rare-logo.png", "/_next/static/chunks/app.js", "/_next/image?url=x",
    ];
    for (const path of publicPaths) expect(isDisallowed(path, disallow), path).toBe(false);
    for (const path of ["/conta", "/conta?tab=perfil", "/conta/dados", "/minha-conta", "/minha-conta/pedidos", "/admin", "/api/health", "/checkout", "/finalizar-compra", "/cart", "/entrar", "/entrar?next=/conta", "/cadastro", "/pedido/abc", "/pedidos"]) {
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
