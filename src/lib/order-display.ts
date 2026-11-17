import { formatBpsAsPercent, formatInstallmentValue } from "@/lib/card-installments";
import type { OrderStatus } from "@prisma/client";

export const paidRevenueStatuses: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

const statusLabels: Record<OrderStatus, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparo",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado",
  failed: "Falhou",
};

export function formatOrderStatus(status: OrderStatus) {
  return statusLabels[status] ?? status;
}

export function isPaidRevenueStatus(status: OrderStatus) {
  return paidRevenueStatuses.includes(status);
}

export function formatPaymentMethod(method?: string | null) {
  if (!method) return "Não informado";
  if (method.includes("pix")) return "Pix";
  if (method.includes("card")) return "Cartão";
  return method;
}

/** Short payment line for order lists: "Pix", "Cartão · 8x", "Cartão" (from the order's snapshot). */
export function formatOrderPaymentSummary(order: Parameters<typeof describeOrderInstallments>[0]) {
  const installments = describeOrderInstallments(order);
  return installments ? `Cartão · ${installments.count}x` : formatPaymentMethod(order.paymentMethod);
}

export type OrderStatusTone = "waiting" | "success" | "progress" | "neutral" | "danger";

/** Visual tone of a status (the label is always shown too: color is never the only signal). */
export function getOrderStatusTone(status: OrderStatus): OrderStatusTone {
  if (status === "pending" || status === "awaiting_payment") return "waiting";
  if (status === "paid" || status === "delivered") return "success";
  if (status === "processing" || status === "shipped") return "progress";
  if (status === "failed" || status === "canceled") return "danger";
  return "neutral";
}

/** "1 item" / "3 itens". */
export function formatItemCount(count: number) {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

/**
 * Installment summary of an order, read ONLY from its own snapshot (never from the current rules):
 * changing the Admin rates later never changes what an existing order shows.
 */
export function describeOrderInstallments(order: {
  paymentMethod?: string | null;
  paymentInstallmentCount?: number | null;
  paymentInstallmentRateBps?: number | null;
  paymentInstallmentFeeInCents?: number | null;
  paymentInstallmentValueInCents?: number | null;
  paymentLastInstallmentValueInCents?: number | null;
}) {
  const count = order.paymentInstallmentCount;
  const value = order.paymentInstallmentValueInCents;
  if (!order.paymentMethod?.includes("card") || !count || count < 2 || !value || value <= 0) return null;
  const feeInCents = order.paymentInstallmentFeeInCents ?? 0;
  const installments = formatInstallmentValue({ installmentCount: count, installmentValueInCents: value, lastInstallmentValueInCents: order.paymentLastInstallmentValueInCents ?? value });
  return {
    count,
    feeInCents,
    interestFree: feeInCents === 0,
    rateText: order.paymentInstallmentRateBps ? formatBpsAsPercent(order.paymentInstallmentRateBps) : null,
    label: feeInCents === 0 ? `${installments} sem juros` : `${installments} com acréscimo`,
  };
}
