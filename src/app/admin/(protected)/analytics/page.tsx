import Link from "next/link";
import { getAnalyticsOverview, LOW_STOCK_THRESHOLD } from "@/lib/admin-analytics";
import {
  ANALYTICS_PERIOD_PRESETS,
  formatDayRangeLabel,
  resolveAnalyticsPeriod,
  type AnalyticsPeriodPreset,
} from "@/lib/analytics-period";
import {
  ChartCard,
  ChartEmptyState,
  MagnitudeBars,
  OrdersTrendChart,
  RevenueTrendChart,
  type MagnitudeRow,
} from "@/components/admin/analytics-charts";
import { KpiTile } from "@/components/admin/analytics-kpi";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus } from "@/lib/order-display";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

const presetLabels: Record<AnalyticsPeriodPreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const query = await searchParams;
  const period = resolveAnalyticsPeriod({ preset: query.period, from: query.from, to: query.to });
  const overview = await getAnalyticsOverview(period);
  const { totals, previousTotals, inventory } = overview;

  const hasSales = totals.paidOrders > 0;
  const topProductRows: MagnitudeRow[] = overview.topProducts.map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: entry.quantity,
    valueLabel: `${formatInteger(entry.quantity)} un. · ${formatMoney(entry.grossRevenueInCents)}`,
  }));
  const topVariantRows: MagnitudeRow[] = overview.topVariants.map((entry) => ({
    id: entry.id,
    label: entry.label,
    detail: entry.detail ? `Tam. ${entry.detail}` : null,
    value: entry.quantity,
    valueLabel: `${formatInteger(entry.quantity)} un.`,
  }));
  const topCategoryRows: MagnitudeRow[] = overview.topCategories.map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: entry.quantity,
    valueLabel: `${formatInteger(entry.quantity)} un. · ${formatMoney(entry.grossRevenueInCents)}`,
  }));
  const statusRows: MagnitudeRow[] = overview.statusBreakdown.map((entry) => ({
    id: entry.status,
    label: formatOrderStatus(entry.status),
    value: entry.orders,
    valueLabel: `${formatInteger(entry.orders)} pedido(s)`,
  }));

  return (
    <div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-neutral-950">Analytics</h1>
        <p className="text-sm font-semibold text-neutral-500">
          {formatDayRangeLabel(period.fromDay, period.toDay)} · dias comerciais em São Paulo ({overview.timeZone}).
        </p>
      </div>

      <PeriodFilter period={period} />

      <section aria-labelledby="analytics-sales" className="mt-6">
        <h2 id="analytics-sales" className="sr-only">
          Resumo de vendas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Receita paga"
            value={formatMoney(totals.revenueInCents)}
            current={totals.revenueInCents}
            previous={previousTotals.revenueInCents}
          />
          <KpiTile
            label="Pedidos pagos"
            value={formatInteger(totals.paidOrders)}
            current={totals.paidOrders}
            previous={previousTotals.paidOrders}
          />
          <KpiTile
            label="Ticket médio"
            value={formatMoney(totals.averageTicketInCents)}
            current={totals.averageTicketInCents}
            previous={previousTotals.averageTicketInCents}
          />
          <KpiTile
            label="Itens vendidos"
            value={formatInteger(totals.itemsSold)}
            current={totals.itemsSold}
            previous={previousTotals.itemsSold}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Itens por pedido" value={totals.averageItemsPerOrder.toFixed(2).replace(".", ",")} />
          <KpiTile label="Frete cobrado" value={formatMoney(totals.shippingInCents)} />
          <KpiTile label="Descontos concedidos" value={formatMoney(totals.discountInCents)} higherIsBetter={false} />
          <KpiTile
            label="Novos clientes"
            value={formatInteger(overview.newCustomers)}
            hint="Cadastros criados no período"
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Receita paga por dia"
          description="Pedidos pagos, na data do pagamento. Reembolsados e cancelados não entram."
        >
          {hasSales ? (
            <>
              <RevenueTrendChart points={overview.series.map((point) => ({ day: point.day, value: point.revenueInCents }))} />
              <SeriesTable
                caption="Receita paga por dia"
                rows={overview.series
                  .filter((point) => point.orders > 0)
                  .map((point) => ({ day: point.day, primary: formatMoney(point.revenueInCents), secondary: `${point.orders} pedido(s)` }))}
              />
            </>
          ) : (
            <ChartEmptyState message="Nenhum pedido pago neste período. Assim que uma venda for confirmada pela Stripe ela aparece aqui." />
          )}
        </ChartCard>

        <ChartCard title="Pedidos pagos por dia" description="A mesma janela, contada em pedidos em vez de reais.">
          {hasSales ? (
            <OrdersTrendChart points={overview.series.map((point) => ({ day: point.day, value: point.orders }))} />
          ) : (
            <ChartEmptyState message="Nenhum pedido pago neste período." />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Pedidos por status"
          description="Todos os pedidos criados no período, inclusive os que nunca foram pagos."
        >
          <MagnitudeBars rows={statusRows} emptyMessage="Nenhum pedido criado neste período." />
        </ChartCard>

        <ChartCard
          title="Produtos mais vendidos"
          description="Unidades e receita bruta dos itens, antes do cupom aplicado ao pedido."
        >
          <MagnitudeBars rows={topProductRows} emptyMessage="Sem vendas pagas neste período." />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Categorias mais vendidas" description="Categoria principal do produto no momento da consulta.">
          <MagnitudeBars rows={topCategoryRows} emptyMessage="Sem vendas pagas neste período." />
        </ChartCard>

        <ChartCard title="Variações mais vendidas" description="Ajuda a decidir a grade de tamanhos da próxima reposição.">
          <MagnitudeBars rows={topVariantRows} emptyMessage="Sem vendas pagas neste período." />
        </ChartCard>
      </div>

      <section aria-labelledby="analytics-inventory" className="mt-8">
        <h2 id="analytics-inventory" className="text-lg font-black text-neutral-950">
          Estoque
        </h2>
        <p className="mt-1 text-sm font-semibold text-neutral-500">
          Posição atual do catálogo ativo; não depende do período selecionado.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Estoque total" value={formatInteger(inventory.totalStock)} hint="Unidades em variações ativas" />
          <KpiTile label="Vendável" value={formatInteger(inventory.sellableStock)} hint="Estoque menos reservas abertas" />
          <KpiTile label="Reservado" value={formatInteger(inventory.reservedStock)} hint="Checkouts em andamento" />
          <KpiTile
            label="Produtos esgotados"
            value={formatInteger(inventory.soldOutActiveProducts)}
            hint="Ativos e sem unidade vendável"
            higherIsBetter={false}
          />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-black text-neutral-950">Variações críticas</h3>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Até {LOW_STOCK_THRESHOLD} unidades vendáveis, esgotadas primeiro.
              </p>
            </div>
            <Link
              href="/admin/products"
              className="w-fit rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
            >
              Ver produtos
            </Link>
          </div>

          {overview.criticalStock.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <caption className="sr-only">Variações com estoque vendável crítico</caption>
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="pb-2">Produto</th>
                    <th scope="col" className="pb-2">Tamanho</th>
                    <th scope="col" className="pb-2 text-right">Estoque</th>
                    <th scope="col" className="pb-2 text-right">Reservado</th>
                    <th scope="col" className="pb-2 text-right">Vendável</th>
                    <th scope="col" className="pb-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {overview.criticalStock.map((entry) => (
                    <tr key={`${entry.productId}-${entry.size}`}>
                      <td className="py-2.5 font-black text-neutral-950">{entry.productTitle}</td>
                      <td className="py-2.5 font-semibold text-neutral-600">{entry.size}</td>
                      <td className="py-2.5 text-right font-semibold text-neutral-600">{entry.stock}</td>
                      <td className="py-2.5 text-right font-semibold text-neutral-600">{entry.reservedStock}</td>
                      <td className={`py-2.5 text-right font-black ${entry.sellable <= 0 ? "text-red-700" : "text-neutral-950"}`}>
                        {entry.sellable <= 0 ? "Esgotado" : entry.sellable}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/admin/products/${entry.productId}/edit`}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <ChartEmptyState message="Nenhuma variação ativa abaixo do limite crítico." />
            </div>
          )}
        </div>
      </section>

      <p className="mt-8 text-xs font-semibold leading-5 text-neutral-500">
        Receita considera pedidos pagos, em preparo, enviados e entregues, na data do pagamento confirmado pela Stripe.
        Reembolsados e cancelados ficam de fora. Não há telemetria de visitas nesta loja, então taxa de conversão,
        carrinhos abandonados e funil não são exibidos: seriam números inventados.
      </p>
    </div>
  );
}

function PeriodFilter({ period }: { period: ReturnType<typeof resolveAnalyticsPeriod> }) {
  return (
    <form className="mt-6 rounded-lg border border-neutral-200 bg-white p-4" role="search">
      <fieldset>
        <legend className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Período</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {ANALYTICS_PERIOD_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
            <Link
              key={preset}
              href={`/admin/analytics?period=${preset}`}
              aria-current={period.preset === preset ? "page" : undefined}
              className={`rounded-full border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                period.preset === preset
                  ? "border-neutral-950 bg-black text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
              }`}
            >
              {presetLabels[preset]}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="period" value="custom" />
          <label className="flex-1 text-xs font-black uppercase tracking-wide text-neutral-500">
            De
            <input type="date" name="from" defaultValue={period.fromDay} className="admin-input mt-1" max={period.toDay} />
          </label>
          <label className="flex-1 text-xs font-black uppercase tracking-wide text-neutral-500">
            Até
            <input type="date" name="to" defaultValue={period.toDay} className="admin-input mt-1" />
          </label>
          <button type="submit" className="h-[42px] rounded-lg bg-black px-4 text-sm font-black text-white">
            Aplicar
          </button>
        </div>
      </fieldset>
    </form>
  );
}

/** The same numbers as the chart, for screen readers and for copying out. */
function SeriesTable({
  caption,
  rows,
}: {
  caption: string;
  rows: Array<{ day: string; primary: string; secondary: string }>;
}) {
  if (!rows.length) return null;

  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-neutral-500 hover:text-neutral-950">
        Ver dados em tabela ({rows.length} dia(s) com venda)
      </summary>
      <div className="mt-3 max-h-64 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
              <th scope="col" className="pb-2">Dia</th>
              <th scope="col" className="pb-2 text-right">Receita</th>
              <th scope="col" className="pb-2 text-right">Pedidos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={row.day}>
                <td className="py-2 font-semibold text-neutral-600">{row.day}</td>
                <td className="py-2 text-right font-black text-neutral-950">{row.primary}</td>
                <td className="py-2 text-right font-semibold text-neutral-600">{row.secondary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
