import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToast } from "@/components/admin/admin-toast";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
}));

beforeEach(() => {
  mocks.params = new URLSearchParams();
});

describe("AdminToast", () => {
  it("renders success feedback from query params with aria-live", () => {
    mocks.params = new URLSearchParams("success=product-saved");

    const html = renderToStaticMarkup(createElement(AdminToast) as ReactElement);

    expect(html).toContain("Produto salvo com sucesso.");
    expect(html).toContain("aria-live=\"polite\"");
  });

  it("renders error feedback from query params", () => {
    mocks.params = new URLSearchParams("error=category-save-failed");

    const html = renderToStaticMarkup(createElement(AdminToast) as ReactElement);

    expect(html).toContain("Não foi possível salvar a categoria.");
    expect(html).toContain("role=\"alert\"");
  });
});
