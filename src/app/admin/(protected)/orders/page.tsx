import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { status } = await searchParams;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as OrderStatus } : {},
    include: {
      items: true,
      customer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Pedidos</h1>
      <form className="mt-6 flex max-w-sm gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <select name="status" defaultValue={status ?? ""} className="admin-input">
          <option value="">Todos</option>
          <option value="awaiting_payment">Aguardando pagamento</option>
          <option value="paid">Pago</option>
          <option value="processing">Em preparo</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregue</option>
          <option value="canceled">Cancelado</option>
          <option value="failed">Falhou</option>
        </select>
        <button className="rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
      </form>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[160px_1fr_150px_140px_120px_100px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Status pedido</span>
          <span>Pagamento</span>
          <span>Total</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {orders.map((order) => (
            <div key={order.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[160px_1fr_150px_140px_120px_100px] lg:items-center">
              <span className="font-black text-neutral-950">{order.orderNumber}</span>
              <span className="text-sm font-semibold text-neutral-600">
                {order.customer?.name ?? order.customerNameSnapshot ?? order.customerEmailSnapshot ?? order.customerEmail ?? order.customerName ?? "Cliente convidado"}
              </span>
              <span className="text-sm font-black text-neutral-700">{formatOrderStatus(order.status)}</span>
              <span className="text-sm font-semibold text-neutral-600">{formatPaymentMethod(order.paymentMethod)}</span>
              <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(order.totalInCents)}</span>
              <Link href={`/admin/orders/${order.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                Abrir
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
