import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCustomersPage from "@/app/admin/(protected)/customers/page";

const customersPageMocks = vi.hoisted(() => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: customersPageMocks.prisma,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin customers page", () => {
  it("shows masked customer CPF in the customer list", async () => {
    customersPageMocks.prisma.customer.findMany.mockResolvedValueOnce([
      {
        id: "customer_1",
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: null,
        cpf: "12345678909",
        active: true,
        createdAt: new Date("2030-01-01T12:00:00.000Z"),
        orders: [],
      },
    ]);

    const element = await AdminCustomersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Cliente Teste");
    expect(html).toContain("CPF ***.456.789-**");
    expect(html).not.toContain("12345678909");
  });
});
