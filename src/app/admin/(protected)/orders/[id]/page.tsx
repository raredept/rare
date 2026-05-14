import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderStatusAction } from "@/app/admin/(protected)/orders/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { formatCep } from "@/lib/cep";
import { formatAddressSnapshotLines } from "@/lib/customer-order";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
import { maskCpf } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      inventoryMovements: { orderBy: { createdAt: "desc" } },
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) notFound();
  const addressLines = formatAddressSnapshotLines(order.shippingAddressSnapshot);

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Pedido {order.orderNumber}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Itens</h2>
          <div className="mt-4 divide-y divide-neutral-200">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-black text-neutral-950">{item.productTitleSnapshot}</p>
                  <p className="font-semibold text-neutral-500">
                    Tamanho {item.sizeSnapshot} · Qtd {item.quantity}
                  </p>
                </div>
                <p className="whitespace-nowrap font-black text-neutral-950">{formatMoney(item.totalInCents)}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Resumo</h2>
            <div className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <div className="flex justify-between">
                <span>Status</span>
                <span>{formatOrderStatus(order.status)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pagamento</span>
                <span>{formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="whitespace-nowrap">{formatMoney(order.subtotalInCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="whitespace-nowrap">{formatMoney(order.shippingInCents)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Metodo</span>
                <span className="text-right">{order.shippingMethodSnapshot ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>CEP entrega</span>
                <span>{formatCep(order.shippingCepSnapshot ?? order.cep) || "-"}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-lg font-black text-neutral-950">
                <span>Total</span>
                <span className="whitespace-nowrap">{formatMoney(order.totalInCents)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Cliente</h2>
            <div className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <p>Nome: {order.customer?.name ?? order.customerNameSnapshot ?? order.customerName ?? "-"}</p>
              <p>E-mail: {order.customer?.email ?? order.customerEmailSnapshot ?? order.customerEmail ?? "-"}</p>
              <p>Telefone: {order.customerPhoneSnapshot ?? order.customerPhone ?? "-"}</p>
              <p>CPF: {order.customerCpfSnapshot ? maskCpf(order.customerCpfSnapshot) : "-"}</p>
              {order.customer ? (
                <Link href={`/admin/customers/${order.customer.id}`} className="inline-flex rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black text-neutral-950">
                  Abrir cliente
                </Link>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Endereco de entrega</h2>
            {addressLines.length ? (
              <div className="mt-4 space-y-1 text-sm font-semibold text-neutral-600">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">Nenhum endereco salvo no snapshot.</p>
            )}
          </section>

          <form action={updateOrderStatusAction} className="rounded-lg border border-neutral-200 bg-white p-5">
            <input type="hidden" name="id" value={order.id} />
            <h2 className="text-lg font-black text-neutral-950">Atualizar envio</h2>
            <select name="status" defaultValue={order.status} className="admin-input mt-4">
              <option value="processing">Em preparo</option>
              <option value="shipped">Enviado</option>
              <option value="delivered">Entregue</option>
              <option value="canceled">Cancelado</option>
              <option value="refunded">Reembolsado</option>
            </select>
            <AdminSubmitButton
              idleLabel="Salvar status"
              pendingLabel="Salvando..."
              className="mt-4 h-11 w-full rounded-lg bg-black text-sm font-black text-white"
            />
          </form>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Pagamento</h2>
            <div className="mt-4 space-y-2 break-all text-xs font-semibold text-neutral-600">
              <p>Checkout: {maskExternalId(order.stripeCheckoutSessionId)}</p>
              <p>Payment Intent: {maskExternalId(order.stripePaymentIntentId)}</p>
              <p>Método: {order.paymentMethod ?? "-"}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function maskExternalId(value: string | null) {
  if (!value) return "-";
  if (value.length <= 12) return "[registrado]";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
