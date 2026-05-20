import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToast } from "@/components/admin/admin-toast";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  router: {
    refresh: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.params,
}));

beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.router.refresh.mockClear();
});

describe("AdminToast", () => {
  it("renders success feedback from query params with aria-live", () => {
    mocks.params = new URLSearchParams("success=product-saved&refresh=123");

    const html = renderToStaticMarkup(createElement(AdminToast) as ReactElement);

    expect(html).toContain("Produto salvo com sucesso.");
    expect(html).toContain("aria-live=\"polite\"");
  });

  it("renders error feedback from query params", () => {
    mocks.params = new URLSearchParams("error=category-save-failed&refresh=123");

    const html = renderToStaticMarkup(createElement(AdminToast) as ReactElement);

    expect(html).toContain("Não foi possível salvar a categoria.");
    expect(html).toContain("role=\"alert\"");
  });

  it("renders banner success feedback from query params", () => {
    mocks.params = new URLSearchParams("success=banner-reordered&refresh=123");

    const html = renderToStaticMarkup(createElement(AdminToast) as ReactElement);

    expect(html).toContain("Ordem dos banners atualizada.");
    expect(html).toContain("aria-live=\"polite\"");
  });
});
