import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountShell } from "@/components/store/account-shell";
import { formatCep } from "@/lib/cep";
import { formatAddressSnapshotLines } from "@/lib/customer-order";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
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
        items: true,
      },
    }),
    getStoreSettings(),
  ]);

  if (!order) notFound();

  const addressLines = formatAddressSnapshotLines(order.shippingAddressSnapshot);
  const whatsappHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Olá, preciso de suporte no pedido ${order.orderNumber}.`)}`
    : null;

  return (
    <AccountShell title={`Pedido ${order.orderNumber}`} subtitle="Detalhes do pedido vinculado à sua conta.">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-16">
        <section className="min-w-0 border-y border-neutral-200 py-6">
          <h2 className="text-xl font-medium tracking-tight text-neutral-950">Itens</h2>
          <div className="mt-4 divide-y divide-neutral-200">
            {order.items.map((item) => (
              <div key={item.id} className="grid gap-3 py-6 text-sm sm:grid-cols-[minmax(0,1fr)_60px_90px_100px] sm:items-center">
                <div className="min-w-0">
                  <p className="font-medium leading-6 text-neutral-950">{item.productTitleSnapshot}</p>
                  <p className="mt-1 leading-6 text-neutral-600">Tamanho/variação: {item.sizeSnapshot}</p>
                </div>
                <span className="text-neutral-600">Qtd {item.quantity}</span>
                <span className="whitespace-nowrap text-neutral-600">{formatMoney(item.unitPriceInCents)}</span>
                <span className="whitespace-nowrap font-medium text-neutral-950">{formatMoney(item.totalInCents)}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="min-w-0 space-y-8">
          <section className="border-y border-neutral-200 py-6">
            <h2 className="text-xl font-medium tracking-tight text-neutral-950">Resumo</h2>
            <div className="mt-5 space-y-3 text-sm text-neutral-600">
              <div className="flex justify-between gap-4">
                <span>Status</span>
                <span>{formatOrderStatus(order.status)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Pagamento</span>
                <span>{formatPaymentMethod(order.paymentMethod)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Subtotal</span>
                <span className="whitespace-nowrap">{formatMoney(order.subtotalInCents)}</span>
              </div>
              {order.discountInCents > 0 ? (
                <div className="flex justify-between gap-4 text-neutral-700">
                  <span>Cupom {order.couponCode ?? ""}</span>
                  <span className="whitespace-nowrap">- {formatMoney(order.discountInCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span>Frete</span>
                <span className="whitespace-nowrap">{formatMoney(order.shippingInCents)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Método</span>
                <span className="text-right">{order.shippingMethodSnapshot ?? "-"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>CEP entrega</span>
                <span>{formatCep(order.shippingCepSnapshot ?? order.cep) || "-"}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-neutral-200 pt-4 text-lg font-medium text-neutral-950">
                <span>Total</span>
                <span className="whitespace-nowrap">{formatMoney(order.totalInCents)}</span>
              </div>
            </div>
          </section>

          <section className="border-b border-neutral-200 pb-8">
            <h2 className="text-xl font-medium tracking-tight text-neutral-950">Entrega</h2>
            {addressLines.length ? (
              <div className="mt-4 space-y-1 text-sm leading-6 text-neutral-600">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-neutral-600">Endereço não registrado neste pedido. Consulte o atendimento para confirmar.</p>
            )}
          </section>

          {whatsappHref ? (
            <Link href={whatsappHref} className="store-button-primary w-full">
              WhatsApp suporte
            </Link>
          ) : null}
        </aside>
      </div>
    </AccountShell>
  );
}
