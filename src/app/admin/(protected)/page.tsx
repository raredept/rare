import Link from "next/link";
import { getDashboardSnapshot, LOW_STOCK_THRESHOLD } from "@/lib/admin-analytics";
import { buildCatalogIssues, type CatalogIssue } from "@/lib/admin-catalog-issues";
import { buildAdminReadiness, type ReadinessReport } from "@/lib/admin-readiness";
import { MagnitudeBars, type MagnitudeRow } from "@/components/admin/analytics-charts";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DASHBOARD_WINDOW_DAYS = 30;

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default async function AdminDashboardPage() {
  // Checked here, not only in the layout: layouts do not re-render on client
  // navigation, so every page verifies the session next to its data.
  await requireAdmin();
  // Orders are aggregated in the database. The catalog queries stay row-level
  // because the readiness and catalog-issue checks genuinely need each product,
  // and the catalog is bounded by what the store sells rather than by how much
  // it has sold.
  const [snapshot, catalogProducts, catalogCategories, settings, recentOrders, recentNotifications] = await Promise.all([
    getDashboardSnapshot(DASHBOARD_WINDOW_DAYS),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        active: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        images: { orderBy: { sortOrder: "asc" }, select: { url: true } },
        variants: { select: { active: true, stock: true, reservedStock: true } },
      },
    }),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        _count: { select: { products: true, subcategoryProducts: true } },
      },
    }),
    prisma.storeSettings.findUnique({
      where: { id: "store" },
      select: {
        shippingMode: true,
        originCep: true,
        fixedShippingInCents: true,
        manualShippingInCents: true,
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalInCents: true,
        createdAt: true,
        customerNameSnapshot: true,
        customerEmailSnapshot: true,
        customer: { select: { name: true, email: true } },
      },
    }),
    prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
  ]);

  const activeProducts = catalogProducts.filter((product) => product.active).length;
  const catalogIssues = buildCatalogIssues({ products: catalogProducts, categories: catalogCategories });
  const readinessReport = buildAdminReadiness({
    settings,
    products: catalogProducts,
    categories: catalogCategories,
  });

  const statusRows: MagnitudeRow[] = snapshot.ordersByStatus.map((entry) => ({
    id: entry.status,
    label: formatOrderStatus(entry.status),
    value: entry.orders,
    valueLabel: formatInteger(entry.orders),
  }));
  const topProductRows: MagnitudeRow[] = snapshot.topProducts.map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: entry.quantity,
    valueLabel: `${formatInteger(entry.quantity)} un. · ${formatMoney(entry.grossRevenueInCents)}`,
  }));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Visão geral</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500">
            Vendas dos últimos {snapshot.windowDays} dias e o que precisa de ação hoje.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
        >
          Abrir Analytics
        </Link>
      </div>

      {/* What needs a person today, before any historical number. */}
      <section aria-labelledby="dashboard-actions" className="mt-6">
        <h2 id="dashboard-actions" className="sr-only">
          Ações pendentes
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            label="Pagos para separar"
            value={formatInteger(snapshot.paidAwaitingFulfilment)}
            href="/admin/orders?status=paid"
            tone={snapshot.paidAwaitingFulfilment > 0 ? "attention" : "calm"}
            description="Pagos ou em preparo, ainda não enviados"
          />
          <ActionCard
            label="Aguardando pagamento"
            value={formatInteger(snapshot.awaitingPayment)}
            href="/admin/orders?status=awaiting_payment"
            tone="calm"
            description="Reservam estoque até expirar"
          />
          <ActionCard
            label="Variações críticas"
            value={formatInteger(snapshot.inventory.lowStockVariants + snapshot.inventory.soldOutVariants)}
            href="/admin/analytics"
            tone={snapshot.inventory.soldOutVariants > 0 ? "attention" : "calm"}
            description={`Até ${LOW_STOCK_THRESHOLD} unidades vendáveis`}
          />
          <ActionCard
            label="Pendências do catálogo"
            value={formatInteger(catalogIssues.length)}
            href="/admin/products"
            tone={catalogIssues.length > 0 ? "attention" : "calm"}
            description="Itens a revisar antes de vender"
          />
        </div>
      </section>

      <section aria-labelledby="dashboard-sales" className="mt-8">
        <h2 id="dashboard-sales" className="text-lg font-black text-neutral-950">
          Vendas · últimos {snapshot.windowDays} dias
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Receita paga" value={formatMoney(snapshot.window.revenueInCents)} />
          <Metric title="Pedidos pagos" value={formatInteger(snapshot.window.paidOrders)} />
          <Metric title="Ticket médio" value={formatMoney(snapshot.window.averageTicketInCents)} />
          <Metric title="Itens vendidos" value={formatInteger(snapshot.window.itemsSold)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Receita acumulada" value={formatMoney(snapshot.revenueAllTimeInCents)} subtitle="Desde o início" />
          <Metric title="Pedidos no total" value={formatInteger(snapshot.ordersTotal)} subtitle="Todos os status" />
          <Metric title="Produtos ativos" value={formatInteger(activeProducts)} />
          <Metric title="Clientes ativos" value={formatInteger(snapshot.activeCustomers)} />
        </div>
      </section>

      <ReadinessSummaryCard report={readinessReport} />

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-black text-neutral-950">Notificações recentes</h2>
          <Link href="/admin/notifications" className="text-xs font-black uppercase tracking-wide text-neutral-600 hover:text-black">
            Ver todas
          </Link>
        </div>
        <div className="mt-4 divide-y divide-neutral-200">
          {recentNotifications.length ? (
            recentNotifications.map((notification) => (
              <div key={notification.id} className="grid grid-cols-1 gap-3 py-3 text-sm md:grid-cols-[110px_1fr_90px] md:items-center">
                <span
                  className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                    notification.readAt
                      ? "border-neutral-200 bg-neutral-50 text-neutral-500"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {notification.readAt ? "Lida" : "Nova"}
                </span>
                <div>
                  <p className="font-black text-neutral-950">{notification.title}</p>
                  <p className="mt-1 font-semibold text-neutral-500">{notification.body}</p>
                </div>
                {notification.href ? (
                  <Link href={notification.href} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                    Abrir
                  </Link>
                ) : null}
              </div>
            ))
          ) : (
            <p className="py-8 text-sm font-semibold text-neutral-500">Nenhuma notificação registrada ainda.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-950">Pendências do catálogo</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-500">Itens que precisam de revisão antes da venda aberta.</p>
          </div>
          <span className="w-fit rounded-lg border border-neutral-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-neutral-600">
            {catalogIssues.length} pendência(s)
          </span>
        </div>

        <div className="mt-4 divide-y divide-neutral-200">
          {catalogIssues.length ? (
            catalogIssues.slice(0, 8).map((issue) => (
              <div key={issue.id} className="grid grid-cols-1 gap-3 py-3 text-sm md:grid-cols-[120px_1fr_130px] md:items-center">
                <CatalogIssueBadge issue={issue} />
                <div>
                  <p className="font-black text-neutral-950">{issue.title}</p>
                  <p className="mt-1 font-semibold text-neutral-500">{issue.description}</p>
                </div>
                <Link
                  href={issue.href}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                >
                  {issue.actionLabel}
                </Link>
              </div>
            ))
          ) : (
            <p className="py-8 text-sm font-semibold text-neutral-500">Nenhuma pendência de catálogo encontrada.</p>
          )}
        </div>

        {catalogIssues.length > 8 ? (
          <p className="mt-3 text-xs font-semibold text-neutral-500">Mostrando 8 de {catalogIssues.length} pendências encontradas.</p>
        ) : null}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-neutral-950">Pedidos recentes</h2>
            <Link href="/admin/orders" className="text-xs font-black uppercase tracking-wide text-neutral-600 hover:text-black">
              Ver todos
            </Link>
          </div>
          <div className="mt-4 divide-y divide-neutral-200">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <div key={order.id} className="grid grid-cols-1 gap-2 py-3 text-sm md:grid-cols-[130px_1fr_140px_110px_80px] md:items-center">
                  <span className="font-black text-neutral-950">{order.orderNumber}</span>
                  <span className="font-semibold text-neutral-600">
                    {order.customer?.name ?? order.customerNameSnapshot ?? order.customerEmailSnapshot ?? "Cliente convidado"}
                  </span>
                  <span className="font-black text-neutral-700">{formatOrderStatus(order.status)}</span>
                  <span className="whitespace-nowrap font-black text-neutral-950">{formatMoney(order.totalInCents)}</span>
                  <Link href={`/admin/orders/${order.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                    Abrir
                  </Link>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-neutral-500">Nenhum pedido registrado.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Pedidos por status</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-500">Todos os pedidos já registrados.</p>
          <div className="mt-4">
            <MagnitudeBars rows={statusRows} emptyMessage="Nenhum pedido registrado ainda." />
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-neutral-950">Estoque crítico</h2>
            <Link href="/admin/analytics" className="text-xs font-black uppercase tracking-wide text-neutral-600 hover:text-black">
              Ver tudo
            </Link>
          </div>
          <div className="mt-4 divide-y divide-neutral-200">
            {snapshot.criticalStock.length ? (
              snapshot.criticalStock.slice(0, 8).map((variant) => (
                <div key={`${variant.productId}-${variant.size}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-black text-neutral-950">{variant.productTitle}</p>
                    <p className="font-semibold text-neutral-500">Tamanho {variant.size}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${variant.sellable <= 0 ? "text-red-700" : "text-neutral-950"}`}>
                      {variant.sellable <= 0 ? "Esgotado" : `${variant.sellable} disponível(is)`}
                    </p>
                    <Link
                      href={`/admin/products/${variant.productId}/edit`}
                      className="text-xs font-black uppercase tracking-wide text-neutral-600"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-neutral-500">Nenhuma variação ativa em nível crítico.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Mais vendidos · {snapshot.windowDays} dias</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-500">Receita bruta dos itens, antes do cupom do pedido.</p>
          <div className="mt-4">
            <MagnitudeBars rows={topProductRows} emptyMessage="Sem vendas pagas nesta janela." />
          </div>
        </section>
      </div>
    </div>
  );
}

function ActionCard({
  label,
  value,
  href,
  description,
  tone,
}: {
  label: string;
  value: string;
  href: string;
  description: string;
  tone: "attention" | "calm";
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        tone === "attention"
          ? "border-amber-200 bg-amber-50 hover:border-amber-400"
          : "border-neutral-200 bg-white hover:border-neutral-950"
      }`}
    >
      <p className={`text-[11px] font-black uppercase tracking-wide ${tone === "attention" ? "text-amber-700" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-neutral-500">{description}</p>
    </Link>
  );
}

function ReadinessSummaryCard({ report }: { report: ReadinessReport }) {
  return (
    <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <ReadinessStatusBadge report={report} />
          <h2 className="mt-3 text-lg font-black text-neutral-950">Prontidão de Venda</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-neutral-500">{report.summaryDescription}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <ReadinessCount label="OK" value={report.counts.ok} />
          <ReadinessCount label="Warnings" value={report.counts.warning} />
          <ReadinessCount label="Bloqueios" value={report.counts.blocked} />
          <ReadinessCount label="Cliente" value={report.clientActionCount} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-semibold text-neutral-500">Esta visão é somente leitura e nunca exibe secrets.</p>
        <Link
          href="/admin/readiness"
          className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
        >
          Ver detalhes
        </Link>
      </div>
    </section>
  );
}

function ReadinessStatusBadge({ report }: { report: ReadinessReport }) {
  const classes = report.finalStatus.includes("blocked")
    ? "border-red-200 bg-red-50 text-red-700"
    : report.finalStatus === "ready_for_limited_production"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${classes}`}>{report.summaryLabel}</span>;
}

function ReadinessCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-3 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
      {subtitle ? <p className="mt-1 text-[11px] font-semibold text-neutral-500">{subtitle}</p> : null}
    </div>
  );
}

function CatalogIssueBadge({ issue }: { issue: CatalogIssue }) {
  const classes = {
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-600",
  }[issue.tone];

  return <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes}`}>{issue.scope}</span>;
}
