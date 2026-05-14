import type { OrderStatus } from "@prisma/client";

export const releasableReservationStatuses: OrderStatus[] = ["pending", "awaiting_payment"];
export const reservationReleaseTargetStatuses: OrderStatus[] = ["canceled", "failed", "refunded"];

export function shouldReleaseReservationOnStatusChange(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  return releasableReservationStatuses.includes(currentStatus) && reservationReleaseTargetStatuses.includes(nextStatus);
}
