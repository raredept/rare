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
      <section className="border-y border-neutral-200">
        <div className="hidden gap-4 border-b border-neutral-200 py-4 text-xs font-medium uppercase tracking-wide text-neutral-600 lg:grid lg:grid-cols-[1.1fr_1fr_1.2fr_1fr_0.6fr_0.7fr]">
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
              <div key={order.id} className="grid gap-4 py-6 lg:grid-cols-[1.1fr_1fr_1.2fr_1fr_0.6fr_0.7fr] lg:items-center">
                <span className="break-words font-medium text-neutral-950">{order.orderNumber}</span>
                <span className="text-sm text-neutral-600">{order.createdAt.toLocaleDateString("pt-BR")}</span>
                <span className="text-sm font-medium text-neutral-700">{formatOrderStatus(order.status)}</span>
                <span className="whitespace-nowrap text-sm font-medium text-neutral-950">{formatMoney(order.totalInCents)}</span>
                <span className="text-sm text-neutral-600">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                <Link href={`/minha-conta/pedidos/${order.id}`} className="inline-flex min-h-11 items-center justify-center border border-neutral-400 px-3 text-xs font-medium transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white">
                  Ver
                </Link>
                <span className="text-xs leading-5 text-neutral-600 lg:col-span-6">
                  Pagamento: {formatPaymentMethod(order.paymentMethod)}
                </span>
              </div>
            ))
          ) : (
            <div className="py-12 sm:py-16">
              <h2 className="text-xl font-medium tracking-tight text-neutral-950">Nenhum pedido vinculado</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">Entre na conta antes de finalizar a compra para vincular pedidos futuros.</p>
              <Link href="/" className="store-button-primary mt-6 w-full sm:w-auto">
                Explorar catálogo
              </Link>
            </div>
          )}
        </div>
      </section>
    </AccountShell>
  );
}
