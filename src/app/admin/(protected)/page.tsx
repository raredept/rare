import Link from "next/link";
import { buildOrderFlowCounts, calculateDashboardKpis } from "@/lib/admin-dashboard";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, isPaidRevenueStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, variants, activeProductRows, customers, recentOrders] = await Promise.all([
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
      where: { active: true },
      select: {
        id: true,
        variants: {
          where: { active: true },
          select: { stock: true, reservedStock: true },
        },
      },
    }),
    prisma.customer.count({ where: { active: true } }),
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
  ]);

  const soldOutProducts = activeProductRows.filter((product) => {
    if (!product.variants.length) return true;
    return product.variants.every((variant) => variant.stock - variant.reservedStock <= 0);
  }).length;
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
            {Object.entries(flowCounts).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-xs font-black uppercase tracking-wide text-neutral-500">
                  <span>{formatOrderStatus(status as keyof typeof flowCounts)}</span>
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

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-3 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}
