import Link from "next/link";
import { buildCatalogIssues, type CatalogIssue } from "@/lib/admin-catalog-issues";
import { buildAdminReadiness, type ReadinessReport } from "@/lib/admin-readiness";
import { buildOrderFlowCounts, calculateDashboardKpis, getSortedOrderFlowEntries } from "@/lib/admin-dashboard";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, isPaidRevenueStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, variants, catalogProducts, catalogCategories, customers, settings, recentOrders, recentNotifications] = await Promise.all([
    prisma.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalInCents: true,
        createdAt: true,
        customerEmailSnapshot: true,
        customerNameSnapshot: true,
        customer: { select: { name: true, email: true } },
        items: {
          select: {
            productTitleSnapshot: true,
            quantity: true,
            totalInCents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productVariant.findMany({
      where: { active: true },
      include: { product: { select: { id: true, title: true } } },
      orderBy: { stock: "asc" },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        title: true,
        active: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: { url: true },
        },
        variants: {
          select: { active: true, stock: true, reservedStock: true },
        },
      },
    }),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        _count: {
          select: {
            products: true,
            subcategoryProducts: true,
          },
        },
      },
    }),
    prisma.customer.count({ where: { active: true } }),
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
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  const activeProductRows = catalogProducts.filter((product) => product.active);
  const soldOutProducts = activeProductRows.filter((product) => {
    const activeVariants = product.variants.filter((variant) => variant.active);
    if (!activeVariants.length) return true;
    return activeVariants.every((variant) => variant.stock - variant.reservedStock <= 0);
  }).length;
  const catalogIssues = buildCatalogIssues({ products: catalogProducts, categories: catalogCategories });
  const readinessReport = buildAdminReadiness({
    settings,
    products: catalogProducts,
    categories: catalogCategories,
  });
  const kpis = calculateDashboardKpis({
    orders,
    variants,
    activeProducts: activeProductRows.length,
    soldOutProducts,
    customers,
  });
  const lowStockVariants = variants.filter((variant) => {
    const available = variant.stock - variant.reservedStock;
    return available > 0 && available <= 3;
  });
  const flowCounts = buildOrderFlowCounts(orders);
  const flowEntries = getSortedOrderFlowEntries(flowCounts);
  const maxFlowCount = Math.max(1, ...Object.values(flowCounts));
  const bestSellers = new Map<string, { product: string; quantity: number; revenue: number }>();

  for (const order of orders.filter((item) => isPaidRevenueStatus(item.status))) {
    for (const item of order.items) {
      const current = bestSellers.get(item.productTitleSnapshot) ?? {
        product: item.productTitleSnapshot,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.totalInCents;
      bestSellers.set(item.productTitleSnapshot, current);
    }
  }

  const topProducts = [...bestSellers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6);

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Visao geral</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Receita paga" value={formatMoney(kpis.revenueTotalInCents)} />
        <Metric title="Receita 7 dias" value={formatMoney(kpis.revenue7DaysInCents)} />
        <Metric title="Receita 30 dias" value={formatMoney(kpis.revenue30DaysInCents)} />
        <Metric title="Ticket medio" value={formatMoney(kpis.averageTicketInCents)} />
        <Metric title="Pedidos totais" value={kpis.ordersTotal.toString()} />
        <Metric title="Pedidos pagos" value={kpis.paidOrders.toString()} />
        <Metric title="Pendentes" value={kpis.pendingOrders.toString()} />
        <Metric title="Cancelados/falhos" value={kpis.failedOrders.toString()} />
        <Metric title="Produtos ativos" value={kpis.activeProducts.toString()} />
        <Metric title="Produtos esgotados" value={kpis.soldOutProducts.toString()} />
        <Metric title="Estoque baixo" value={kpis.lowStockVariants.toString()} />
        <Metric title="Clientes ativos" value={kpis.customers.toString()} />
      </div>

      <ReadinessSummaryCard report={readinessReport} />

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-neutral-950">Notificacoes recentes</h2>
          <Link href="/admin/notifications" className="text-xs font-black uppercase tracking-wide text-neutral-600 hover:text-black">
            Ver todas
          </Link>
        </div>
        <div className="mt-4 divide-y divide-neutral-200">
          {recentNotifications.length ? (
            recentNotifications.map((notification) => (
              <div key={notification.id} className="grid gap-3 py-3 text-sm md:grid-cols-[110px_1fr_90px] md:items-center">
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
            <p className="py-8 text-sm font-semibold text-neutral-500">Nenhuma notificacao registrada ainda.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-950">Pendencias do catalogo</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-500">Itens que precisam de revisao antes da venda aberta.</p>
          </div>
          <span className="w-fit rounded-lg border border-neutral-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-neutral-600">
            {catalogIssues.length} pendencia(s)
          </span>
        </div>

        <div className="mt-4 divide-y divide-neutral-200">
          {catalogIssues.length ? (
            catalogIssues.slice(0, 8).map((issue) => (
              <div key={issue.id} className="grid gap-3 py-3 text-sm md:grid-cols-[120px_1fr_130px] md:items-center">
                <CatalogIssueBadge issue={issue} />
                <div>
                  <p className="font-black text-neutral-950">{issue.title}</p>
                  <p className="mt-1 font-semibold text-neutral-500">{issue.description}</p>
                </div>
                <Link href={issue.href} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950">
                  {issue.actionLabel}
                </Link>
              </div>
            ))
          ) : (
            <p className="py-8 text-sm font-semibold text-neutral-500">Nenhuma pendencia de catalogo encontrada.</p>
          )}
        </div>

        {catalogIssues.length > 8 ? (
          <p className="mt-3 text-xs font-semibold text-neutral-500">Mostrando 8 de {catalogIssues.length} pendencias encontradas.</p>
        ) : null}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-neutral-950">Pedidos recentes</h2>
            <Link href="/admin/orders" className="text-xs font-black uppercase tracking-wide text-neutral-600 hover:text-black">
              Ver todos
            </Link>
          </div>
          <div className="mt-4 divide-y divide-neutral-200">
            {recentOrders.length ? (
              recentOrders.map((order) => (
                <div key={order.id} className="grid gap-2 py-3 text-sm md:grid-cols-[130px_1fr_140px_110px_80px] md:items-center">
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
          <h2 className="text-lg font-black text-neutral-950">Fluxo de pedidos</h2>
          <div className="mt-4 space-y-3">
            {flowEntries.map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-xs font-black uppercase tracking-wide text-neutral-500">
                  <span>{formatOrderStatus(status)}</span>
                  <span>{count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-neutral-100">
                  <div className="h-2 rounded-full bg-neutral-950" style={{ width: `${Math.max(4, (count / maxFlowCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Produtos com estoque baixo</h2>
          <div className="mt-4 divide-y divide-neutral-200">
            {lowStockVariants.length ? (
              lowStockVariants.slice(0, 8).map((variant) => (
                <div key={variant.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-black text-neutral-950">{variant.product.title}</p>
                    <p className="font-semibold text-neutral-500">Variacao {variant.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-red-700">{variant.stock - variant.reservedStock} disponivel(is)</p>
                    <Link href={`/admin/products/${variant.product.id}/edit`} className="text-xs font-black uppercase tracking-wide text-neutral-600">
                      Editar
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-neutral-500">Nenhum estoque baixo no momento.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Produtos mais vendidos</h2>
          <div className="mt-4 divide-y divide-neutral-200">
            {topProducts.length ? (
              topProducts.map((product) => (
                <div key={product.product} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-black text-neutral-950">{product.product}</p>
                    <p className="font-semibold text-neutral-500">{product.quantity} unidade(s)</p>
                  </div>
                  <p className="whitespace-nowrap font-black text-neutral-950">{formatMoney(product.revenue)}</p>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-neutral-500">Sem vendas pagas ainda.</p>
            )}
          </div>
        </section>
      </div>
    </div>
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
        <div className="grid gap-3 sm:grid-cols-4">
          <ReadinessCount label="OK" value={report.counts.ok} />
          <ReadinessCount label="Warnings" value={report.counts.warning} />
          <ReadinessCount label="Bloqueios" value={report.counts.blocked} />
          <ReadinessCount label="Cliente" value={report.clientActionCount} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-semibold text-neutral-500">Esta visão é somente leitura e nunca exibe secrets.</p>
        <Link href="/admin/readiness" className="w-fit rounded-lg border border-neutral-300 px-4 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950">
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

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-3 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function CatalogIssueBadge({ issue }: { issue: CatalogIssue }) {
  const classes = {
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-600",
  }[issue.tone];

  return (
    <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes}`}>
      {issue.scope}
    </span>
  );
}
