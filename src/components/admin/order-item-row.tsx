import { AdminOrderItemThumbnail } from "@/components/admin/order-item-thumbnail";
import { formatMoney } from "@/lib/money";
import { resolveOrderItemDisplay, type OrderItemForDisplay } from "@/lib/order-item-snapshot";

export type AdminOrderItemRowItem = OrderItemForDisplay & {
  id: string;
  productTitleSnapshot: string;
  quantity: number;
  unitPriceInCents: number;
  totalInCents: number;
  basePriceInCents: number | null;
  promotionId: string | null;
  promotionName: string | null;
  promotionCode: string | null;
  promotionDiscountInCents: number;
};

// 80 x 100 px on desktop (the catalog's 4:5 photo ratio, so nothing is distorted), 64 x 80 on
// phones. The box has a fixed size, so the image never shifts the layout while it loads.
const thumbnailBoxClass =
  "relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 sm:h-[100px] sm:w-20";

export function AdminOrderItemRow({ item }: { item: AdminOrderItemRowItem }) {
  const display = resolveOrderItemDisplay(item);

  return (
    <li className="flex min-w-0 gap-3 py-4 text-sm sm:gap-4" data-testid="admin-order-item">
      <div className={thumbnailBoxClass} data-testid="admin-order-item-thumbnail">
        <AdminOrderItemThumbnail url={display.imageUrl} alt={item.productTitleSnapshot} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="min-w-0 font-black text-neutral-950 [overflow-wrap:anywhere]">{item.productTitleSnapshot}</p>
          <p className="whitespace-nowrap font-black text-neutral-950">{formatMoney(item.totalInCents)}</p>
        </div>
        <p className="mt-1 font-semibold text-neutral-500">
          Tamanho {item.sizeSnapshot} · Qtd {item.quantity}
          {item.quantity > 1 ? ` · ${formatMoney(item.unitPriceInCents)}/un.` : ""}
        </p>
        {display.sku ? (
          <p className="mt-1 font-mono text-xs font-semibold text-neutral-600 [overflow-wrap:anywhere]" data-testid="admin-order-item-sku">
            {display.skuSource === "current-catalog" ? (
              <>
                SKU atual: {display.sku}{" "}
                <span className="font-sans text-[11px] text-neutral-500">(do catálogo hoje; o pedido é anterior ao registro do SKU)</span>
              </>
            ) : (
              <>SKU: {display.sku}</>
            )}
          </p>
        ) : null}
        {item.promotionId ? (
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            {item.promotionName ?? "Promoção"}
            {item.promotionCode ? ` (${item.promotionCode})` : ""}: {formatMoney(item.basePriceInCents ?? item.unitPriceInCents)} →{" "}
            {formatMoney(item.unitPriceInCents)} (- {formatMoney(item.promotionDiscountInCents)}/un.)
          </p>
        ) : null}
      </div>
    </li>
  );
}
