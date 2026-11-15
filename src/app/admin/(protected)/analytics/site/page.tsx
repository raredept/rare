import type { Metadata } from "next";
import { ChartCard, CountTrendChart, MagnitudeBars, type MagnitudeRow } from "@/components/admin/analytics-charts";
import { KpiTile } from "@/components/admin/analytics-kpi";
import { AnalyticsPeriodFilter } from "@/components/admin/analytics-period-filter";
import { formatDayRangeLabel, resolveAnalyticsPeriod } from "@/lib/analytics-period";
import { requireAdmin } from "@/lib/auth";
import { getSiteAnalyticsReport, type SiteAnalyticsTopEntry } from "@/lib/site-analytics-report";
import { SITE_ANALYTICS_RETENTION_DAYS } from "@/lib/site-analytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics do site", robots: { index: false, follow: false } };

type SiteAnalyticsPageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

const deviceLabels: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" };

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function toRows(entries: SiteAnalyticsTopEntry[], unit: string): MagnitudeRow[] {
  return entries.map((entry) => ({ id: entry.productId, label: entry.label, value: entry.count, valueLabel: `${formatInteger(entry.count)} ${unit}` }));
}

export default async function SiteAnalyticsPage({ searchParams }: SiteAnalyticsPageProps) {
  await requireAdmin("analytics.site");
  const query = await searchParams;
  const period = resolveAnalyticsPeriod({ preset: query.period, from: query.from, to: query.to });
  const report = await getSiteAnalyticsReport(period);
  const { totals } = report;

  const funnel: MagnitudeRow[] = [
    { id: "sessions", label: "Sessões (com consentimento)", value: totals.sessions, valueLabel: formatInteger(totals.sessions) },
    { id: "product_views", label: "Produtos vistos", value: totals.productViews, valueLabel: formatInteger(totals.productViews) },
    { id: "add_to_cart", label: "Adições ao carrinho", value: totals.addToCart, valueLabel: formatInteger(totals.addToCart) },
    { id: "checkout", label: "Checkouts iniciados", value: totals.checkoutStarted, valueLabel: formatInteger(totals.checkoutStarted) },
    { id: "payment", label: "Pagamentos iniciados", value: totals.paymentStarted, valueLabel: formatInteger(totals.paymentStarted) },
    { id: "purchase", label: "Compras confirmadas", value: totals.purchaseConfirmed, valueLabel: formatInteger(totals.purchaseConfirmed) },
  ];
  const deviceRows: MagnitudeRow[] = report.devices.map((entry) => ({
    id: entry.device,
    label: deviceLabels[entry.device] ?? entry.device,
    value: entry.sessions,
    valueLabel: `${formatInteger(entry.sessions)} sessão(ões)`,
  }));

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-neutral-950">Analytics do site</h1>
        <p className="text-sm font-semibold text-neutral-500">{formatDayRangeLabel(period.fromDay, period.toDay)} · dias comerciais em São Paulo.</p>
      </div>

      <section aria-labelledby="site-analytics-scope" className="mt-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold leading-6 text-neutral-600">
        <h2 id="site-analytics-scope" className="text-xs font-black uppercase tracking-wide text-neutral-500">
          Como ler estes números
        </h2>
        <p className="mt-2">
          Visitas, sessões, páginas, produtos vistos, cliques e carrinho contam apenas visitantes que aceitaram a análise de uso no aviso de cookies: são um
          piso do tráfego real. Checkouts, pagamentos e compras vêm dos pedidos no servidor e incluem todos os clientes. Nenhum dado aqui identifica pessoas
          (sem nome, e-mail, CPF, telefone ou IP); eventos são apagados após {SITE_ANALYTICS_RETENTION_DAYS} dias.
        </p>
      </section>

      <AnalyticsPeriodFilter period={period} basePath="/admin/analytics/site" />

      <section aria-labelledby="site-analytics-behaviour" className="mt-6">
        <h2 id="site-analytics-behaviour" className="text-lg font-black text-neutral-950">
          Navegação (com consentimento)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiTile label="Visitantes" value={formatInteger(totals.visitors)} hint="Navegadores distintos" />
          <KpiTile label="Sessões" value={formatInteger(totals.sessions)} hint="Visitas distintas" />
          <KpiTile label="Páginas vistas" value={formatInteger(totals.pageViews)} hint="Page views" />
          <KpiTile label="Produtos vistos" value={formatInteger(totals.productViews)} hint="Aberturas de página de produto" />
          <KpiTile label="Cliques em produtos" value={formatInteger(totals.productClicks)} hint="Cliques em cards de produto" />
          <KpiTile label="Adições ao carrinho" value={formatInteger(totals.addToCart)} hint="Itens adicionados" />
        </div>
      </section>

      <section aria-labelledby="site-analytics-orders" className="mt-8">
        <h2 id="site-analytics-orders" className="text-lg font-black text-neutral-950">
          Compra (dados do servidor)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiTile label="Checkouts iniciados" value={formatInteger(totals.checkoutStarted)} hint="Pedidos criados no período" />
          <KpiTile label="Pagamentos iniciados" value={formatInteger(totals.paymentStarted)} hint="Pedidos enviados ao provedor de pagamento" />
          <KpiTile label="Compras confirmadas" value={formatInteger(totals.purchaseConfirmed)} hint="Pagamento confirmado pelo provedor no período" />
          <KpiTile label="Conversão por sessão" value={formatPercent(report.sessionConversion)} hint="Compras ÷ sessões com consentimento (aproximada)" />
          <KpiTile label="Conversão do checkout" value={formatPercent(report.checkoutConversion)} hint="Compras ÷ checkouts iniciados" />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Funil" description="As três primeiras etapas contam só quem aceitou a análise; as três últimas, todos os pedidos.">
          <MagnitudeBars rows={funnel} emptyMessage="Sem dados neste período." />
        </ChartCard>
        <ChartCard title="Páginas vistas por dia" description="Visitantes com consentimento.">
          <CountTrendChart points={report.daily.map((point) => ({ day: point.day, value: point.pageViews }))} ariaLabel="Páginas vistas por dia no período selecionado" />
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard title="Mais vistos" description="Aberturas da página do produto.">
          <MagnitudeBars rows={toRows(report.topViewed, "visualização(ões)")} emptyMessage="Sem produtos vistos neste período." />
        </ChartCard>
        <ChartCard title="Mais clicados" description="Cliques em cards de produto.">
          <MagnitudeBars rows={toRows(report.topClicked, "clique(s)")} emptyMessage="Sem cliques neste período." />
        </ChartCard>
        <ChartCard title="Mais vendidos" description="Unidades em pedidos pagos no período.">
          <MagnitudeBars rows={toRows(report.topSold, "un.")} emptyMessage="Sem vendas pagas neste período." />
        </ChartCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Dispositivos" description="Classe do aparelho por sessão; o navegador completo nunca é guardado.">
          <MagnitudeBars rows={deviceRows} emptyMessage="Sem sessões neste período." />
        </ChartCard>
      </div>
    </div>
  );
}
