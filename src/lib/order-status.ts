import type { OrderStatus } from "@prisma/client";

export const releasableReservationStatuses: OrderStatus[] = ["pending", "awaiting_payment"];
export const reservationReleaseTargetStatuses: OrderStatus[] = ["canceled", "failed", "refunded"];

export function shouldReleaseReservationOnStatusChange(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  return releasableReservationStatuses.includes(currentStatus) && reservationReleaseTargetStatuses.includes(nextStatus);
}

/**
 * Manual (Admin) transitions. Payment-driven transitions (awaiting_payment -> paid,
 * expired/failed -> canceled/failed, late payment on a closed order) belong to the
 * Stripe webhook and the expiry worker and are validated there, never by this table.
 * A paid order is closed with "refunded" (the refund itself is issued in Stripe);
 * "canceled" is only for orders that were never paid, so stock is released exactly once.
 */
export const manualStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["canceled"],
  awaiting_payment: ["canceled"],
  paid: ["processing", "shipped", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  canceled: [],
  failed: [],
  refunded: [],
};

export function getManualStatusOptions(current: OrderStatus): OrderStatus[] {
  return manualStatusTransitions[current] ?? [];
}

export function canTransitionManually(current: OrderStatus, next: OrderStatus) {
  return getManualStatusOptions(current).includes(next);
}

export const invalidOrderTransitionMessage = "Transição de status inválida para este pedido.";
