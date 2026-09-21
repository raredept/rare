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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ username: "operador", email: "operador@rare.example" });
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
    expect(html).toMatch(/<aside[^>]*class="[^"]*hidden[^"]*lg:block/);
  });
});
