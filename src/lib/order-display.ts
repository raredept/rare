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
