import type { OrderStatus } from "@prisma/client";

/**
 * Query-string parsing for the Admin order list.
 *
 * The status used to be cast straight to the enum and handed to Prisma, so any
 * unexpected value (a stale bookmark, a typo, a crawler) raised
 * PrismaClientValidationError and the operator got the generic error page
 * instead of their orders.
 */

export const ORDER_STATUS_VALUES = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "canceled",
  "refunded",
  "failed",
] as const satisfies readonly OrderStatus[];

export const ORDERS_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 80;

export type AdminOrderFilters = {
  status: OrderStatus | null;
  /** Set when a status was supplied but is not a real one, so the UI can say so. */
  invalidStatus: string | null;
  search: string;
  page: number;
  skip: number;
  take: number;
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

function parsePage(value: unknown) {
  const page = Number(typeof value === "string" ? value.trim() : value);
  if (!Number.isInteger(page) || page < 1) return 1;
  // A page number far past the end is harmless but pointless; cap the offset.
  return Math.min(page, 10_000);
}

function parseSearch(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_SEARCH_LENGTH);
}

export function parseAdminOrderFilters(query: {
  status?: string;
  q?: string;
  page?: string;
} = {}): AdminOrderFilters {
  const rawStatus = typeof query.status === "string" ? query.status.trim() : "";
  const status = isOrderStatus(rawStatus) ? rawStatus : null;
  const page = parsePage(query.page);

  return {
    status,
    invalidStatus: rawStatus && !status ? rawStatus : null,
    search: parseSearch(query.q),
    page,
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
  };
}

/** Rebuilds the current query string with one value replaced. */
export function buildOrdersHref(filters: AdminOrderFilters, overrides: { page?: number; status?: string | null; q?: string } = {}) {
  const params = new URLSearchParams();
  const status = overrides.status !== undefined ? overrides.status : filters.status;
  const search = overrides.q !== undefined ? overrides.q : filters.search;
  const page = overrides.page ?? filters.page;

  if (status) params.set("status", status);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));

  const queryString = params.toString();
  return queryString ? `/admin/orders?${queryString}` : "/admin/orders";
}
