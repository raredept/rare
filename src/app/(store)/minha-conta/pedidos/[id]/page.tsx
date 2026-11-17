import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { CheckoutDeadline } from "@/components/store/checkout-deadline";
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
            product: { select: { slug: true, active: true, images: { orderBy: { sortOrder: "asc" }, take: PRODUCT_MEDIA_LIMIT, select: { url: true } } } },
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

  const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
  const paymentLabel = installments ? "Cartão de crédito" : formatPaymentMethod(order.paymentMethod);

  // UIUX-ORDERS-002: status, date and payment up top; money, payment and delivery as separate blocks;
  // the items card no longer stretches to the height of the side column.
  return (
    <AccountShell title={`Pedido ${order.orderNumber}`} subtitle="Detalhes do pedido vinculado à sua conta.">
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-neutral-600">
        <OrderStatusBadge status={order.status} />
        <span>Feito em {dateTime.format(order.createdAt)}</span>
        {order.paidAt ? <span>Pago em {dateTime.format(order.paidAt)}</span> : null}
        <span>{installments ? `Cartão · ${installments.count}x` : paymentLabel}</span>
      </div>

      {order.status === "awaiting_payment" ? (
        <>
          {/* Same window and link the checkout notice uses; nothing shows once the deadline passed. */}
          <CheckoutDeadline orderId={order.id} className="mb-6" />
          {/* Coming back from the payment page proves nothing: only the provider's confirmation
              (webhook or reconciliation) moves the order to paid. */}
          <p role="status" className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Se você acabou de pagar, a confirmação do pagamento pode levar alguns instantes. Atualize esta página em seguida.
          </p>
        </>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Itens</h2>
          <ul className="mt-2 divide-y divide-neutral-200">
            {order.items.map((item) => (
              <CustomerOrderItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="order-values">
            <h2 id="order-values" className="text-lg font-black text-neutral-950">Valores</h2>
            <dl className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd className="whitespace-nowrap">{formatMoney(order.subtotalInCents)}</dd>
              </div>
              {order.discountInCents > 0 ? (
                <div className="flex justify-between gap-4 text-emerald-700">
                  <dt>Cupom {order.couponCode ?? ""}</dt>
                  <dd className="whitespace-nowrap">- {formatMoney(order.discountInCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt>Frete</dt>
                <dd className="whitespace-nowrap">{formatMoney(order.shippingInCents)}</dd>
              </div>
              {installments && installments.feeInCents > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>Acréscimo do parcelamento</dt>
                  <dd className="whitespace-nowrap">+ {formatMoney(installments.feeInCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3 text-lg font-black text-neutral-950">
                <dt>Total</dt>
                <dd className="whitespace-nowrap">{formatMoney(order.totalInCents)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="order-payment">
            <h2 id="order-payment" className="text-lg font-black text-neutral-950">Pagamento</h2>
            <dl className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <div className="flex justify-between gap-4">
                <dt>Forma</dt>
                <dd className="text-right">{paymentLabel}</dd>
              </div>
              {installments ? (
                <div className="flex justify-between gap-4">
                  <dt>Parcelamento</dt>
                  <dd className="text-right">{installments.label}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt>Status</dt>
                <dd className="text-right">{formatOrderStatus(order.status)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="order-delivery">
            <h2 id="order-delivery" className="text-lg font-black text-neutral-950">Entrega</h2>
            <dl className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <div className="flex justify-between gap-4">
                <dt>Método</dt>
                <dd className="text-right">{order.shippingMethodSnapshot ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>CEP</dt>
                <dd>{formatCep(order.shippingCepSnapshot ?? order.cep) || "-"}</dd>
              </div>
            </dl>
            {addressLines.length ? (
              <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm font-semibold text-neutral-600">
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