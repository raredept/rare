import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));

const mocks = vi.hoisted(() => ({
  getAnalyticsOverview: vi.fn(),
}));

vi.mock("@/lib/admin-analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-analytics")>();
  return { ...actual, getAnalyticsOverview: mocks.getAnalyticsOverview };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

function overview(options: { empty?: boolean } = {}) {
  const empty = options.empty ?? false;
  return {
    period: { preset: "30d" as const, fromDay: "2026-02-09", toDay: "2026-03-10", days: 30, label: "Últimos 30 dias" },
    timeZone: "America/Sao_Paulo",
    totals: {
      paidOrders: empty ? 0 : 12,
      revenueInCents: empty ? 0 : 456_78,
      subtotalInCents: empty ? 0 : 400_00,
      shippingInCents: empty ? 0 : 60_00,
      discountInCents: empty ? 0 : 3_22,
      itemsSold: empty ? 0 : 19,
      averageTicketInCents: empty ? 0 : 38_06,
      averageItemsPerOrder: empty ? 0 : 1.58,
    },
    previousTotals: {
      paidOrders: 10,
      revenueInCents: 400_00,
      subtotalInCents: 350_00,
      shippingInCents: 50_00,
      discountInCents: 0,
      itemsSold: 15,
      averageTicketInCents: 40_00,
      averageItemsPerOrder: 1.5,
    },
    series: empty
      ? [{ day: "2026-03-10", orders: 0, revenueInCents: 0, itemsSold: 0 }]
      : [
          { day: "2026-03-09", orders: 5, revenueInCents: 200_00, itemsSold: 8 },
          { day: "2026-03-10", orders: 7, revenueInCents: 256_78, itemsSold: 11 },
        ],
    statusBreakdown: empty ? [] : [{ status: "paid" as const, orders: 12, totalInCents: 456_78 }],
    topProducts: empty ? [] : [{ id: "p1", label: "Camiseta RARE", detail: null, quantity: 9, grossRevenueInCents: 300_00 }],
    topCategories: empty ? [] : [{ id: "c1", label: "Camisetas", detail: null, quantity: 9, grossRevenueInCents: 300_00 }],
    topVariants: empty ? [] : [{ id: "v1", label: "Camiseta RARE", detail: "M", quantity: 5, grossRevenueInCents: 160_00 }],
    inventory: {
      totalStock: 40,
      reservedStock: 4,
      sellableStock: 36,
      soldOutVariants: 2,
      lowStockVariants: 3,
      activeVariants: 20,
      soldOutActiveProducts: 1,
    },
    criticalStock: empty
      ? []
      : [{ productId: "p1", productTitle: "Camiseta RARE", size: "M", stock: 2, reservedStock: 2, sellable: 0 }],
    newCustomers: empty ? 0 : 4,
  };
}

async function render(searchParams: Record<string, string> = {}) {
  const { default: AnalyticsPage } = await import("@/app/admin/(protected)/analytics/page");
  const element = await AnalyticsPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(element as ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAnalyticsOverview.mockResolvedValue(overview());
});

describe("AnalyticsPage", () => {
  it("renders the headline figures as Brazilian currency", async () => {
    const html = await render();
    expect(html).toContain("Analytics");
    expect(html).toContain("456,78");
    expect(html).toContain("Ticket médio");
    expect(html).toContain("Itens vendidos");
  });

  it("names the timezone the days are grouped by", async () => {
    expect(await render()).toContain("America/Sao_Paulo");
  });

  it("passes the requested period through to the query", async () => {
    await render({ period: "7d" });
    expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith(expect.objectContaining({ preset: "7d", days: 7 }));
  });

  it("falls back to the default window for an unusable custom range", async () => {
    await render({ period: "custom", from: "not-a-date", to: "2026-03-10" });
    expect(mocks.getAnalyticsOverview).toHaveBeenCalledWith(expect.objectContaining({ preset: "30d" }));
  });

  it("shows the trend against the previous window", async () => {
    const html = await render();
    // 456,78 against 400,00 is +14.2%.
    expect(html).toContain("+14,2%");
    expect(html).toContain("vs. período anterior");
  });

  it("explains that funnel metrics are absent rather than inventing them", async () => {
    const html = await render();
    expect(html).toContain("Não há telemetria de visitas");
    expect(html).not.toContain("Taxa de conversão");
    expect(html).not.toContain("Carrinhos abandonados");
  });

  it("renders empty states instead of zeroed charts when nothing sold", async () => {
    mocks.getAnalyticsOverview.mockResolvedValue(overview({ empty: true }));
    const html = await render();
    expect(html).toContain("Nenhum pedido pago neste período");
    expect(html).toContain("Sem vendas pagas neste período");
    expect(html).toContain("Nenhuma variação ativa abaixo do limite crítico");
  });

  it("links a critical variant straight to its product editor", async () => {
    expect(await render()).toContain('href="/admin/products/p1/edit"');
  });

  it("offers every preset as a filter link", async () => {
    const html = await render();
    for (const preset of ["today", "7d", "30d", "90d"]) {
      expect(html).toContain(`href="/admin/analytics?period=${preset}"`);
    }
  });
});
