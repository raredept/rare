import { describe, expect, it } from "vitest";
import {
  buildOrdersHref,
  isOrderStatus,
  ORDERS_PAGE_SIZE,
  ORDER_STATUS_VALUES,
  parseAdminOrderFilters,
} from "@/lib/admin-order-filters";

describe("isOrderStatus", () => {
  it("accepts every status the schema defines", () => {
    for (const status of ORDER_STATUS_VALUES) {
      expect(isOrderStatus(status)).toBe(true);
    }
  });

  it("rejects anything else, so it never reaches Prisma as an enum", () => {
    for (const value of ["", "PAID", "notastatus", "paid; DROP TABLE", null, undefined, 7, {}]) {
      expect(isOrderStatus(value)).toBe(false);
    }
  });
});

describe("parseAdminOrderFilters", () => {
  it("passes a valid status through", () => {
    expect(parseAdminOrderFilters({ status: "paid" })).toMatchObject({ status: "paid", invalidStatus: null });
  });

  it("reports an unknown status instead of querying with it", () => {
    expect(parseAdminOrderFilters({ status: "notastatus" })).toMatchObject({
      status: null,
      invalidStatus: "notastatus",
    });
  });

  it("treats an empty status as no filter rather than an invalid one", () => {
    expect(parseAdminOrderFilters({ status: "" })).toMatchObject({ status: null, invalidStatus: null });
    expect(parseAdminOrderFilters({ status: "   " })).toMatchObject({ status: null, invalidStatus: null });
  });

  it("defaults to the first page and computes the offset", () => {
    expect(parseAdminOrderFilters({})).toMatchObject({ page: 1, skip: 0, take: ORDERS_PAGE_SIZE });
    expect(parseAdminOrderFilters({ page: "3" })).toMatchObject({ page: 3, skip: 2 * ORDERS_PAGE_SIZE });
  });

  it("falls back to page 1 for nonsense page numbers", () => {
    for (const page of ["0", "-4", "abc", "1.5", ""]) {
      expect(parseAdminOrderFilters({ page })).toMatchObject({ page: 1, skip: 0 });
    }
  });

  it("caps the page so one request cannot ask for an enormous offset", () => {
    expect(parseAdminOrderFilters({ page: "99999999" }).page).toBe(10_000);
  });

  it("trims and bounds the search term", () => {
    expect(parseAdminOrderFilters({ q: "  RARE-2026  " }).search).toBe("RARE-2026");
    expect(parseAdminOrderFilters({ q: "x".repeat(500) }).search).toHaveLength(80);
  });
});

describe("buildOrdersHref", () => {
  const base = parseAdminOrderFilters({ status: "paid", q: "RARE-1", page: "2" });

  it("keeps the other filters when changing the page", () => {
    expect(buildOrdersHref(base, { page: 3 })).toBe("/admin/orders?status=paid&q=RARE-1&page=3");
  });

  it("drops page 1 from the URL", () => {
    expect(buildOrdersHref(base, { page: 1 })).toBe("/admin/orders?status=paid&q=RARE-1");
  });

  it("returns the bare path when nothing is filtered", () => {
    expect(buildOrdersHref(parseAdminOrderFilters({}))).toBe("/admin/orders");
  });

  it("clears a filter when asked to", () => {
    expect(buildOrdersHref(base, { status: null, q: "", page: 1 })).toBe("/admin/orders");
  });

  it("escapes a search term with URL characters", () => {
    expect(buildOrdersHref(parseAdminOrderFilters({ q: "a&b=c" }))).toBe("/admin/orders?q=a%26b%3Dc");
  });
});
