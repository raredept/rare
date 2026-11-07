import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

import { AdminNav } from "@/components/admin/admin-nav";

describe("Admin navigation", () => {
  it("lists the promotion and security sections inside the sectioned navigation", () => {
    navigation.pathname = "/admin";
    const html = renderToStaticMarkup(createElement(AdminNav, {}));
    for (const href of ["/admin", "/admin/orders", "/admin/products", "/admin/promotions", "/admin/readiness", "/admin/settings", "/admin/security"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain(">Promoções<");
    expect(html).toContain(">Segurança<");
  });

  it.each(["/admin", "/admin/notifications"])("keeps the unread badge on its own colour rules (current page %s)", (pathname) => {
    navigation.pathname = pathname;
    const html = renderToStaticMarkup(createElement(AdminNav, { unreadNotifications: 3 }));
    const badge = /<span class="admin-nav-badge[^"]*">/.exec(html)?.[0] ?? "";
    expect(badge).not.toBe("");
    // The dark Admin theme remaps Tailwind's bg-white to the panel colour: black text on a
    // near-black pill (about 1.05:1). The badge colours live in .admin-nav-badge instead.
    expect(badge).not.toMatch(/\b(bg|text)-(white|black)\b/);
    expect(html).toContain('3<span class="sr-only"> não lidas</span>');
    // aria-label is not allowed on a generic <span>; the count is announced through text.
    expect(html).not.toMatch(/<span[^>]*aria-label=/);
  });

  it("caps the badge at 99+", () => {
    navigation.pathname = "/admin";
    expect(renderToStaticMarkup(createElement(AdminNav, { unreadNotifications: 250 }))).toContain("99+<span");
  });
});
