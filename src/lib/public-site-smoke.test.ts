import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_SITE_URL,
  formatPublicSmokeReport,
  resolvePublicSmokeBaseUrl,
  runPublicSiteSmoke,
  summarizePublicSmokeResult,
} from "@/lib/public-site-smoke";
import { getSecurityHeaders } from "@/lib/security-headers";

const notFoundPaths = new Set(["/produto/nao-existe", "/categoria/nao-existe", "/nonexistent-page"]);

function makeHeaders(options: { omit?: string[]; extra?: Record<string, string> } = {}) {
  const headers = new Headers();
  for (const header of getSecurityHeaders()) {
    headers.set(header.key, header.value);
  }
  headers.set("content-type", "text/html; charset=utf-8");

  for (const header of options.omit ?? []) {
    headers.delete(header);
  }

  for (const [key, value] of Object.entries(options.extra ?? {})) {
    headers.set(key, value);
  }

  return headers;
}

function createFetchMock(
  options: {
    sitemapXml?: string;
    healthBody?: string;
    healthStatus?: number;
    omitSecurityHeaders?: string[];
    notFoundHeadStatus?: number;
  } = {},
) {
  return async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = String(init?.method ?? "GET").toUpperCase();

    if (url.pathname === "/" && method === "HEAD") {
      return new Response(null, { status: 200, headers: makeHeaders({ omit: options.omitSecurityHeaders }) });
    }

    if (url.pathname === "/robots.txt" && method === "GET") {
      return new Response("User-agent: *\nAllow: /", { status: 200, headers: makeHeaders() });
    }

    if (url.pathname === "/sitemap.xml" && method === "GET") {
      return new Response(
        options.sitemapXml ??
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<urlset>",
            "<url><loc>https://raredept.com.br/</loc></url>",
            "<url><loc>https://raredept.com.br/produto/camiseta-rare</loc></url>",
            "<url><loc>https://raredept.com.br/categoria/tudo</loc></url>",
            "</urlset>",
          ].join(""),
        { status: 200, headers: makeHeaders({ extra: { "content-type": "application/xml; charset=utf-8" } }) },
      );
    }

    if (notFoundPaths.has(url.pathname) && method === "HEAD") {
      return new Response(null, { status: options.notFoundHeadStatus ?? 404, headers: makeHeaders() });
    }

    if (notFoundPaths.has(url.pathname) && method === "GET") {
      return new Response("Pagina nao encontrada.", { status: 404, headers: makeHeaders() });
    }

    if (url.pathname === "/api/health" && method === "GET") {
      return new Response(options.healthBody ?? JSON.stringify({ status: "ok" }), {
        status: options.healthStatus ?? 200,
        headers: makeHeaders({ extra: { "content-type": "application/json; charset=utf-8" } }),
      });
    }

    throw new Error(`Unhandled ${method} ${url.pathname}`);
  };
}

describe("public site smoke", () => {
  it("resolves CLI URL, SITE_URL and default target", () => {
    expect(resolvePublicSmokeBaseUrl("raredept.com.br", { SITE_URL: "https://ignored.example" })).toBe("https://raredept.com.br");
    expect(resolvePublicSmokeBaseUrl(undefined, { SITE_URL: "https://staging.example/" })).toBe("https://staging.example");
    expect(resolvePublicSmokeBaseUrl(undefined, {})).toBe(DEFAULT_PUBLIC_SITE_URL);
  });

  it("passes for public routes, security headers, health JSON and safe sitemap", async () => {
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock(),
      timeoutMs: 1000,
    });

    const summary = summarizePublicSmokeResult(result);
    expect(summary.failures).toBe(0);
    expect(summary.warnings).toBe(0);
  });

  it("keeps ok_with_warnings health as warning without failing the smoke", async () => {
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock({ healthBody: JSON.stringify({ status: "ok_with_warnings" }) }),
      timeoutMs: 1000,
    });

    const summary = summarizePublicSmokeResult(result);
    expect(summary.failures).toBe(0);
    expect(summary.warnings).toBe(1);
    expect(result.checks).toContainEqual(expect.objectContaining({ status: "WARNING", label: "health:app-status" }));
  });

  it("fails when expected security headers or 404 statuses are missing", async () => {
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock({
        omitSecurityHeaders: ["X-Frame-Options"],
        notFoundHeadStatus: 200,
      }),
      timeoutMs: 1000,
    });

    expect(result.checks).toContainEqual(expect.objectContaining({ status: "FAIL", label: "security:X-Frame-Options" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ status: "FAIL", label: "not-found:/produto/nao-existe" }));
    expect(summarizePublicSmokeResult(result).failures).toBeGreaterThan(0);
  });

  it("fails for private sitemap routes and redacts detected secret values from the report", async () => {
    const leakedSecret = "sk_live_super_secret_value";
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock({
        sitemapXml: "<urlset><url><loc>https://raredept.com.br/admin</loc></url></urlset>",
        healthBody: JSON.stringify({ status: "ok", value: leakedSecret }),
      }),
      timeoutMs: 1000,
    });

    const report = formatPublicSmokeReport(result);
    expect(result.checks).toContainEqual(expect.objectContaining({ status: "FAIL", label: "sitemap:private-routes" }));
    expect(report).toContain("Stripe live secret key");
    expect(report).not.toContain(leakedSecret);
  });

  it("allows sanitized health messages that mention missing variable names", async () => {
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock({
        healthBody: JSON.stringify({
          status: "ok_with_warnings",
          configuration: {
            warnings: [
              { variable: "STRIPE_SECRET_KEY", message: "STRIPE_SECRET_KEY is not configured." },
              { variable: "UPSTASH_REDIS_REST_TOKEN", message: "Redis token is not configured." },
              { variable: "MELHOR_ENVIO_TOKEN", message: "Shipping token is not configured." },
            ],
          },
        }),
      }),
      timeoutMs: 1000,
    });

    expect(result.checks.filter((check) => check.label.startsWith("leak:"))).toEqual([]);
    expect(summarizePublicSmokeResult(result).failures).toBe(0);
  });

  it("fails when a database connection URL is exposed", async () => {
    const result = await runPublicSiteSmoke({
      baseUrl: "https://raredept.com.br",
      fetchImpl: createFetchMock({
        healthBody: JSON.stringify({ status: "ok", database: "postgresql://user:password@db.example/rare" }),
      }),
      timeoutMs: 1000,
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ status: "FAIL", label: "leak:/api/health", message: expect.stringContaining("PostgreSQL connection URL") }),
    );
  });
});
