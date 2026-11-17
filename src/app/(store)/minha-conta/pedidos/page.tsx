import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountShell } from "@/components/store/account-shell";
import { CustomerOrderItemThumbnail, OrderStatusBadge, pickOrderPreviewItems } from "@/components/store/customer-order-parts";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { formatItemCount, formatOrderPaymentSummary } from "@/lib/order-display";
import { resolveOrderItemDisplay } from "@/lib/order-item-snapshot";
import { prisma } from "@/lib/prisma";
import { PRODUCT_MEDIA_LIMIT } from "@/lib/product-media";

export const dynamic = "force-dynamic";

const orderDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function CustomerOrdersPage() {
  const customer = await requireCustomer("/minha-conta/pedidos");
  const orders = await prisma.order.findMany({
    // Always scoped to the signed-in customer.
    where: { customerId: customer.id },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          // Current catalog, read only to picture orders created before the item snapshot.
          product: { select: { images: { orderBy: { sortOrder: "asc" }, take: PRODUCT_MEDIA_LIMIT, select: { url: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AccountShell title="Meus pedidos" subtitle="Somente pedidos feitos enquanto você estava logado aparecem aqui.">
      {orders.length ? (
        // A block list, not a grid: an implicit grid column would grow to the (nowrap) product names.
        <ul className="space-y-4" aria-label="Pedidos">
          {orders.map((order) => {
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const preview = pickOrderPreviewItems(order.items);
            return (
              <li key={order.id} className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5" data-testid="customer-order-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Decorative here: the product names are listed as text right beside the pictures. */}
                  <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
                    {preview.shown.map((item) => (
                      <CustomerOrderItemThumbnail key={item.id} size="sm" url={resolveOrderItemDisplay(item).imageUrl} alt={item.productTitleSnapshot} />
                    ))}
                    {preview.hiddenCount ? (
                      <span className="flex h-[70px] w-14 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-black text-neutral-700">
                        +{preview.hiddenCount}
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h2 className="font-black text-neutral-950">Pedido {order.orderNumber}</h2>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-neutral-600">
                      {orderDate.format(order.createdAt)} · {formatItemCount(itemCount)} · {formatOrderPaymentSummary(order)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-neutral-500">
                      {order.items.map((item) => item.productTitleSnapshot).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <p className="whitespace-nowrap text-lg font-black text-neutral-950">
                      <span className="sr-only">Total: </span>
                      {formatMoney(order.totalInCents)}
                    </p>
                    <Link
                      href={`/minha-conta/pedidos/${order.id}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-neutral-300 px-4 text-sm font-black text-neutral-950 transition hover:border-neutral-950"
                      aria-label={`Ver pedido ${order.orderNumber}`}
                    >
                      Ver pedido
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="rounded-lg border border-neutral-200 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-black text-neutral-950">Nenhum pedido vinculado</h2>
          <p className="mt-2 text-sm font-medium text-neutral-500">Entre na conta antes de finalizar a compra para vincular pedidos futuros.</p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white">
            Comprar agora
          </Link>
        </section>
      )}
    </AccountShell>
  );
}
