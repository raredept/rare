import type { OrderStatus } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Clock3, Package, PackageCheck, RotateCcw, Truck, XCircle, type LucideIcon } from "lucide-react";
import { AdminOrderItemThumbnail as OrderItemThumbnailImage } from "@/components/admin/order-item-thumbnail";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, getOrderStatusTone, type OrderStatusTone } from "@/lib/order-display";
import { resolveOrderItemDisplay, type OrderItemForDisplay } from "@/lib/order-item-snapshot";

// UIUX-ORDERS-001: the customer recognises a purchase by its pictures, not by its number. These parts
// only READ the order (snapshot first, current catalog only for orders created before the snapshot).

const statusIcons: Record<OrderStatus, LucideIcon> = {
  pending: Clock3,
  awaiting_payment: Clock3,
  paid: CheckCircle2,
  processing: Package,
  shipped: Truck,
  delivered: PackageCheck,
  canceled: XCircle,
  refunded: RotateCcw,
  failed: AlertTriangle,
};

const toneClasses: Record<OrderStatusTone, string> = {
  waiting: "border-amber-300 bg-amber-50 text-amber-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  progress: "border-sky-300 bg-sky-50 text-sky-900",
  danger: "border-red-300 bg-red-50 text-red-800",
  neutral: "border-neutral-300 bg-neutral-100 text-neutral-700",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const Icon = statusIcons[status] ?? Clock3;
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-black ${toneClasses[getOrderStatusTone(status)]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {formatOrderStatus(status)}
    </span>
  );
}

/** Fixed 4:5 box: the image never shifts the layout while it loads. */
export function CustomerOrderItemThumbnail({ url, alt, size = "md" }: { url: string | null; alt: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-[70px] w-14" : "h-20 w-16 sm:h-[100px] sm:w-20";
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 ${box}`} data-testid="customer-order-item-thumbnail">
      <OrderItemThumbnailImage url={url} alt={alt} />
    </div>
  );
}

export type CustomerOrderItem = OrderItemForDisplay & {
  id: string;
  productTitleSnapshot: string;
  quantity: number;
  unitPriceInCents: number;
  totalInCents: number;
};

/** Up to `max` distinct pictures for the order card, plus how many items are not pictured. */
export function pickOrderPreviewItems<T extends CustomerOrderItem>(items: T[], max = 3) {
  return { shown: items.slice(0, max), hiddenCount: Math.max(0, items.length - max) };
}

export function CustomerOrderItemRow({ item }: { item: CustomerOrderItem }) {
  const display = resolveOrderItemDisplay(item);
  // Only the SKU recorded with the order: today's catalog SKU would be a guess for the customer.
  const sku = display.skuSource === "order" ? display.sku : null;

  return (
    <li className="flex min-w-0 gap-3 py-4 text-sm sm:gap-4" data-testid="customer-order-item">
      <CustomerOrderItemThumbnail url={display.imageUrl} alt={item.productTitleSnapshot} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="min-w-0 font-black text-neutral-950 [overflow-wrap:anywhere]">{item.productTitleSnapshot}</p>
          <p className="whitespace-nowrap font-black text-neutral-950">{formatMoney(item.totalInCents)}</p>
        </div>
        <p className="mt-1 font-semibold text-neutral-600">
          Tamanho {item.sizeSnapshot} · Qtd {item.quantity}
          {item.quantity > 1 ? ` · ${formatMoney(item.unitPriceInCents)} cada` : ""}
        </p>
        {sku ? <p className="mt-1 font-mono text-xs font-semibold text-neutral-500 [overflow-wrap:anywhere]">Ref. {sku}</p> : null}
      </div>
    </li>
  );
}
