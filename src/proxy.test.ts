import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({
  isCategoryPageSlugAvailable: vi.fn(),
  isProductPageSlugAvailable: vi.fn(),
}));

vi.mock("@/lib/storefront", () => ({
  isCategoryPageSlugAvailable: mocks.isCategoryPageSlugAvailable,
  isProductPageSlugAvailable: mocks.isProductPageSlugAvailable,
}));

function request(path: string, init?: { headers?: HeadersInit; method?: string }) {
  return new NextRequest(`https://rare.test${path}`, {
    method: init?.method,
    headers: {
      accept: "text/html",
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });
}

describe("proxy public catalog 404 handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches public product and category routes in addition to protected routes", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(["/admin/:path*", "/api/admin/:path*", "/minha-conta/:path*", "/produto/:path*", "/categoria/:path*"]),
    );
  });

  it("returns a real 404 HTML response for missing product slugs", async () => {
    mocks.isProductPageSlugAvailable.mockResolvedValueOnce(false);

    const response = await proxy(request("/produto/nao-existe"));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(body).toContain("<title>Produto não encontrado | RARE</title>");
    expect(body).toContain("Essa peça não está disponível no catálogo da RARE.");
    expect(body).toContain('href="/categoria/tudo"');
    expect(mocks.isProductPageSlugAvailable).toHaveBeenCalledWith("nao-existe");
  });

  it("treats document requests without an Accept header as eligible for hard 404", async () => {
    mocks.isProductPageSlugAvailable.mockResolvedValueOnce(false);

    const response = await proxy(new NextRequest("https://rare.test/produto/nao-existe"));

    expect(response.status).toBe(404);
    expect(mocks.isProductPageSlugAvailable).toHaveBeenCalledWith("nao-existe");
  });

  it("lets valid product slugs continue to the App Router", async () => {
    mocks.isProductPageSlugAvailable.mockResolvedValueOnce(true);

    const response = await proxy(request("/produto/camiseta-rare"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.isProductPageSlugAvailable).toHaveBeenCalledWith("camiseta-rare");
  });

  it("returns a real 404 HTML response for missing category slugs", async () => {
    mocks.isCategoryPageSlugAvailable.mockResolvedValueOnce(false);

    const response = await proxy(request("/categoria/nao-existe"));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).toContain("<title>Categoria não encontrada | RARE</title>");
    expect(body).toContain("Essa seleção não existe no catálogo da RARE.");
    expect(mocks.isCategoryPageSlugAvailable).toHaveBeenCalledWith("nao-existe");
  });

  it("does not intercept RSC navigations so the segment UI can render", async () => {
    const response = await proxy(
      request("/produto/nao-existe?_rsc=abc", {
        headers: {
          accept: "text/x-component",
          rsc: "1",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.isProductPageSlugAvailable).not.toHaveBeenCalled();
  });
});
