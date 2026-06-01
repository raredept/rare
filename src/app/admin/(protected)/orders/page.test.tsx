import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "@/app/admin/(protected)/orders/page";

const ordersPageMocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: ordersPageMocks.prisma,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin orders page", () => {
  it("shows masked customer CPF in the operational order list", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([
      {
        id: "order_1",
        orderNumber: "RARE-TEST",
        status: "awaiting_payment",
        paymentMethod: null,
        totalInCents: 21990,
        customerName: null,
        customerEmail: null,
        customerEmailSnapshot: null,
        customerNameSnapshot: "Cliente Teste",
        customerCpfSnapshot: null,
        items: [],
        customer: {
          name: "Cliente Teste",
          email: "cliente@example.com",
          cpf: "12345678909",
        },
      },
    ]);

    const element = await OrdersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Cliente Teste");
    expect(html).toContain("CPF ***.456.789-**");
    expect(html).not.toContain("12345678909");
  });
});
