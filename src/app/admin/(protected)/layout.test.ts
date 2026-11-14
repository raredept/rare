import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  notificationCount: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: { adminNotification: { count: mocks.notificationCount } } }));
vi.mock("@/app/admin/(protected)/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/components/admin/admin-nav", () => ({ AdminNav: () => null }));
vi.mock("@/components/admin/admin-toast", () => ({ AdminToast: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement("a", { href, ...props }, children),
}));

import AdminLayout from "@/app/admin/(protected)/layout";
import { getAdminPermissions } from "@/lib/admin-permissions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ username: "operador", email: "operador@rare.example", role: "SELLER_ADMIN", permissions: getAdminPermissions("SELLER_ADMIN") });
  mocks.notificationCount.mockResolvedValue(0);
});

async function render() {
  const element = await AdminLayout({ children: createElement("p", null, "conteúdo") });
  return renderToStaticMarkup(element as ReactElement);
}

function submitButtons(html: string) {
  return [...html.matchAll(/<form[^>]*class="([^"]*)"[^>]*>\s*<button[^>]*type="submit"[^>]*>Sair<\/button>/g)].map(([, formClass]) => formClass);
}

describe("AdminLayout logout", () => {
  it("offers logout below the lg breakpoint, where the sidebar is hidden", async () => {
    const html = await render();
    const forms = submitButtons(html);

    expect(forms).toHaveLength(2);
    // One lives in the sidebar (hidden below lg), the other only below lg, so
    // exactly one is visible at any width.
    expect(forms.some((formClass) => formClass.includes("lg:hidden"))).toBe(true);
    expect(html).toMatch(/<aside[^>]*aria-label="Menu lateral do Admin"[^>]*class="[^"]*hidden[^"]*lg:flex/);
  });

  it("skips the unread notification query and bell for an Admin without the commercial inbox", async () => {
    mocks.requireAdmin.mockResolvedValue({ username: "sistema", email: "sistema@rare.example", role: "SYSTEM_ADMIN", permissions: getAdminPermissions("SYSTEM_ADMIN") });
    const html = await render();
    expect(mocks.notificationCount).not.toHaveBeenCalled();
    expect(html).not.toContain("href=\"/admin/notifications\"");
  });

  it("counts unread notifications for the seller", async () => {
    mocks.notificationCount.mockResolvedValue(2);
    const html = await render();
    expect(mocks.notificationCount).toHaveBeenCalledTimes(1);
    expect(html).toContain("href=\"/admin/notifications\"");
  });
});
