import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { CustomerOrderItemRow, OrderStatusBadge } from "@/components/store/customer-order-parts";
import { PRODUCT_MEDIA_LIMIT } from "@/lib/product-media";
import { formatCep } from "@/lib/cep";
import { formatAddressSnapshotLines } from "@/lib/customer-order";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { describeOrderInstallments, formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type CustomerOrderDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerOrderDetailPage({ params }: CustomerOrderDetailProps) {
  const customer = await requireCustomer("/minha-conta/pedidos");
  const { id } = await params;
  const [order, settings] = await Promise.all([
    prisma.order.findFirst({
      where: {
        id,
        customerId: customer.id,
      },
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            // Current catalog, read only to picture orders created before the item snapshot.
            product: { select: { images: { orderBy: { sortOrder: "asc" }, take: PRODUCT_MEDIA_LIMIT, select: { url: true } } } },
          },
        },
      },
    }),
    getStoreSettings(),
  ]);

  if (!order) notFound();

  const addressLines = formatAddressSnapshotLines(order.shippingAddressSnapshot);
  // The plan chosen at checkout, from this order's snapshot (never recalculated).
  const installments = describeOrderInstallments(order);
  const whatsappHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Olá, preciso de suporte no pedido ${order.orderNumber}.`)}`
    : null;

  return (
    <AccountShell title={`Pedido ${order.orderNumber}`} subtitle="Detalhes do pedido vinculado à sua conta.">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-neutral-950">Itens</h2>
            <OrderStatusBadge status={order.status} />
          </div>
          <ul className="mt-2 divide-y divide-neutral-200">
            {order.items.map((item) => (
              <CustomerOrderItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Resumo</h2>
            <div className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <div className="flex justify-between">
                <span>Status</span>
                <span>{formatOrderStatus(order.status)}</span>
              </div>
              {order.status === "awaiting_payment" ? (
                // Coming back from the payment page proves nothing: only the provider's confirmation
                // (webhook or reconciliation) moves the order to paid.
                <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Se você acabou de pagar, a confirmação do pagamento pode levar alguns instantes. Atualize esta página em seguida.
                </p>
              ) : null}
              <div className="flex justify-between">
                <span>Pagamento</span>
                <span>{installments ? "Cartão de crédito" : formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              {installments ? (
                <div className="flex justify-between gap-4">
                  <span>Parcelamento</span>
                  <span className="text-right">{installments.label}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="whitespace-nowrap">{formatMoney(order.subtotalInCents)}</span>
              </div>
              {order.discountInCents > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>Cupom {order.couponCode ?? ""}</span>
                  <span className="whitespace-nowrap">- {formatMoney(order.discountInCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="whitespace-nowrap">{formatMoney(order.shippingInCents)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Método</span>
                <span className="text-right">{order.shippingMethodSnapshot ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>CEP entrega</span>
                <span>{formatCep(order.shippingCepSnapshot ?? order.cep) || "-"}</span>
              </div>
              {installments && installments.feeInCents > 0 ? (
                <div className="flex justify-between gap-4">
                  <span>Acréscimo do parcelamento</span>
                  <span className="whitespace-nowrap">+ {formatMoney(installments.feeInCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-lg font-black text-neutral-950">
                <span>Total</span>
                <span className="whitespace-nowrap">{formatMoney(order.totalInCents)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Entrega</h2>
            {addressLines.length ? (
              <div className="mt-3 space-y-1 text-sm font-semibold text-neutral-600">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-medium text-neutral-500">Endereço não registrado neste pedido. Consulte o atendimento para confirmar.</p>
            )}
          </section>

          {whatsappHref ? (
            <Link href={whatsappHref} className="flex h-11 items-center justify-center rounded-lg bg-black px-4 text-sm font-black uppercase tracking-wide text-white">
              WhatsApp suporte
            </Link>
          ) : null}
        </aside>
      </div>
    </AccountShell>
  );
}
