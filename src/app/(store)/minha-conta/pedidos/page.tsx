import Link from "next/link";
import { AccountShell } from "@/components/store/account-shell";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const customer = await requireCustomer("/minha-conta/pedidos");
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AccountShell title="Meus pedidos" subtitle="Somente pedidos feitos enquanto você estava logado aparecem aqui.">
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[150px_130px_150px_120px_120px_110px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Pedido</span>
          <span>Data</span>
          <span>Status</span>
          <span>Total</span>
          <span>Itens</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {orders.length ? (
            orders.map((order) => (
              <div key={order.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[150px_130px_150px_120px_120px_110px] lg:items-center">
                <span className="font-black text-neutral-950">{order.orderNumber}</span>
                <span className="text-sm font-semibold text-neutral-600">{order.createdAt.toLocaleDateString("pt-BR")}</span>
                <span className="text-sm font-black text-neutral-700">{formatOrderStatus(order.status)}</span>
                <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(order.totalInCents)}</span>
                <span className="text-sm font-semibold text-neutral-600">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                <Link href={`/minha-conta/pedidos/${order.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                  Ver
                </Link>
                <span className="text-xs font-semibold text-neutral-500 lg:col-span-6">
                  Pagamento: {formatPaymentMethod(order.paymentMethod)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <h2 className="text-lg font-black text-neutral-950">Nenhum pedido vinculado</h2>
              <p className="mt-2 text-sm font-medium text-neutral-500">Entre na conta antes de finalizar a compra para vincular pedidos futuros.</p>
              <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white">
                Comprar agora
              </Link>
            </div>
          )}
        </div>
      </section>
    </AccountShell>
  );
}
