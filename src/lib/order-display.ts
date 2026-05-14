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
