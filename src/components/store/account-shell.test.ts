import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/minha-conta/dados" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children),
}));

import { AccountShell } from "@/components/store/account-shell";

describe("AccountShell", () => {
  // The header already has a navigation landmark; two unnamed <nav>s on the
  // same page are indistinguishable to screen readers (axe landmark-unique).
  it("names its navigation and marks the current section", () => {
    const html = renderToStaticMarkup(AccountShell({ title: "Dados", children: null }));

    expect(html).toContain('<nav aria-label="Seções da conta"');
    expect(html).toMatch(/href="\/minha-conta\/dados" aria-current="page"/);
  });
});
