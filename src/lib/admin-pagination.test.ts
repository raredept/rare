import { describe, expect, it } from "vitest";
import { buildAdminListHref, normalizeAdminPage } from "@/lib/admin-pagination";

describe("admin pagination", () => {
  it("rejects repeated page parameters rather than coercing arrays", () => {
    expect(normalizeAdminPage(["2"])).toBe(1);
    expect(normalizeAdminPage(["2", "3"])).toBe(1);
  });
  it("normalizes invalid pages", () => {
    expect(normalizeAdminPage("2")).toBe(2);
    expect(normalizeAdminPage("0")).toBe(1);
    expect(normalizeAdminPage("2.5")).toBe(1);
    expect(normalizeAdminPage("invalid")).toBe(1);
    expect(normalizeAdminPage("1000000000")).toBe(10_000);
    expect(normalizeAdminPage(Number.MAX_SAFE_INTEGER + 1)).toBe(1);
  });

  it("preserves filters and omits the first page", () => {
    expect(buildAdminListHref("/admin/orders", { q: "RARE +", status: "paid", page: 2 }))
      .toBe("/admin/orders?q=RARE+%2B&status=paid&page=2");
    expect(buildAdminListHref("/admin/orders", { q: "", page: 1 })).toBe("/admin/orders");
  });
});
