import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));
import OrdersPage from "@/app/admin/(protected)/orders/page";

const ordersPageMocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
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
  ordersPageMocks.prisma.order.count.mockResolvedValue(0);
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

    ordersPageMocks.prisma.order.count.mockResolvedValueOnce(1);

    const element = await OrdersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Cliente Teste");
    expect(html).toContain("CPF ***.456.789-**");
    expect(html).not.toContain("12345678909");
  });

  it("ignores an unknown status and says so instead of failing the page", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([]);

    const element = await OrdersPage({ searchParams: Promise.resolve({ status: "notastatus" }) });
    const html = renderToStaticMarkup(element);

    // Prisma must never be asked to match an invalid enum value.
    expect(ordersPageMocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(html).toContain("não existe");
  });

  it("filters by a valid status", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([]);

    await OrdersPage({ searchParams: Promise.resolve({ status: "paid" }) });

    expect(ordersPageMocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "paid" } }),
    );
  });

  it("pages in the database rather than loading every order", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([]);
    ordersPageMocks.prisma.order.count.mockResolvedValueOnce(320);

    const element = await OrdersPage({ searchParams: Promise.resolve({ page: "3" }) });
    const html = renderToStaticMarkup(element);

    expect(ordersPageMocks.prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
    expect(html).toContain("Página 3 de 7");
  });

  it("searches order number and customer without touching raw SQL", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([]);

    await OrdersPage({ searchParams: Promise.resolve({ q: "RARE-9" }) });

    const where = ordersPageMocks.prisma.order.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ orderNumber: { contains: "RARE-9", mode: "insensitive" } }]),
    );
  });

  it("offers an empty state that explains the filters", async () => {
    ordersPageMocks.prisma.order.findMany.mockResolvedValueOnce([]);

    const element = await OrdersPage({ searchParams: Promise.resolve({ q: "nada" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Nenhum pedido com esses filtros");
  });
});
