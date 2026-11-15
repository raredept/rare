import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));
import AdminCustomersPage from "@/app/admin/(protected)/customers/page";
import { requireAdmin } from "@/lib/auth";

const customersPageMocks = vi.hoisted(() => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
    },
    order: {
      groupBy: vi.fn(),
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
  customersPageMocks.prisma.customer.findMany.mockReset();
  customersPageMocks.prisma.order.groupBy.mockResolvedValue([]);
});

describe("admin customers page", () => {
  it("authorizes before querying customer or spending data", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(AdminCustomersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Unauthorized");
    expect(customersPageMocks.prisma.customer.findMany).not.toHaveBeenCalled();
    expect(customersPageMocks.prisma.order.groupBy).not.toHaveBeenCalled();
  });

  it("combines bounded text and status filters in the database", async () => {
    customersPageMocks.prisma.customer.findMany.mockResolvedValueOnce([]);
    await AdminCustomersPage({ searchParams: Promise.resolve({ q: ` ${"x".repeat(120)} `, status: "inactive", page: "100000" }) });
    expect(customersPageMocks.prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 249975, take: 26,
      where: { active: false, OR: [
        { name: { contains: "x".repeat(100), mode: "insensitive" } },
        { email: { contains: "x".repeat(100), mode: "insensitive" } },
      ] },
    }));
  });

  it("ignores repeated text filters and bounds the page deterministically", async () => {
    customersPageMocks.prisma.customer.findMany.mockResolvedValueOnce([]);
    await AdminCustomersPage({ searchParams: Promise.resolve({ page: "3", q: ["a", "b"] }) });
    expect(customersPageMocks.prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {}, skip: 50, take: 26, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }));
    expect(customersPageMocks.prisma.order.groupBy).not.toHaveBeenCalled();
  });

  it("shows masked customer CPF in the customer list", async () => {
    customersPageMocks.prisma.customer.findMany.mockResolvedValueOnce([
      {
        id: "customer_1",
        name: "Cliente Teste",
        email: "cliente@example.com",
        cpf: "12345678909",
        active: true,
        createdAt: new Date("2030-01-01T12:00:00.000Z"),
        _count: { orders: 0 },
      },
    ]);

    const element = await AdminCustomersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Cliente Teste");
    expect(html).toContain("CPF ***.456.789-**");
    expect(html).not.toContain("12345678909");
  });
});
