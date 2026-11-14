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
import { getAdminPermissions } from "@/lib/admin-permissions";

const legacyPermissions = getAdminPermissions("ADMIN");
const systemPermissions = getAdminPermissions("SYSTEM_ADMIN");
const sellerPermissions = getAdminPermissions("SELLER_ADMIN");

const commerceHrefs = ["/admin", "/admin/analytics", "/admin/orders", "/admin/customers", "/admin/notifications", "/admin/products", "/admin/promotions", "/admin/categories", "/admin/banners"];
const systemHrefs = ["/admin/users", "/admin/readiness", "/admin/settings", "/admin/security"];
/** analytics.site: both scoped roles. */
const sharedHrefs = ["/admin/analytics/site", "/admin/conta"];

describe("Admin navigation", () => {
  it("lists every section for the legacy full-access role", () => {
    navigation.pathname = "/admin";
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: legacyPermissions }));
    for (const href of [...commerceHrefs, ...systemHrefs, "/admin/conta"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain(">Promoções<");
    expect(html).toContain(">Segurança<");
  });

  it("shows only system areas to SYSTEM_ADMIN", () => {
    navigation.pathname = "/admin/users";
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: systemPermissions }));
    for (const href of [...systemHrefs, ...sharedHrefs]) expect(html).toContain(`href="${href}"`);
    for (const href of commerceHrefs) expect(html).not.toContain(`href="${href}"`);
    expect(html).not.toContain(">Catálogo<");
  });

  it("hides readiness, security, users and settings from SELLER_ADMIN", () => {
    navigation.pathname = "/admin";
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: sellerPermissions }));
    for (const href of [...commerceHrefs, ...sharedHrefs]) expect(html).toContain(`href="${href}"`);
    for (const href of systemHrefs) expect(html).not.toContain(`href="${href}"`);
    expect(html).not.toContain(">Sistema<");
  });

  it("marks only the most specific item as the current page", () => {
    navigation.pathname = "/admin/analytics/site";
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: legacyPermissions }));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/admin\/analytics\/site"[^>]*aria-current="page"/);
  });

  it("renders nothing navigable without permissions", () => {
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: [] }));
    expect(html).not.toContain("href=");
  });

  it.each(["/admin", "/admin/notifications"])("keeps the unread badge on its own colour rules (current page %s)", (pathname) => {
    navigation.pathname = pathname;
    const html = renderToStaticMarkup(createElement(AdminNav, { permissions: sellerPermissions, unreadNotifications: 3 }));
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
    expect(renderToStaticMarkup(createElement(AdminNav, { permissions: sellerPermissions, unreadNotifications: 250 }))).toContain("99+<span");
  });
});
