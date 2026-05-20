import { describe, expect, it } from "vitest";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";

describe("admin action refresh helper", () => {
  it("adds a refresh marker to admin redirects without replacing existing params", () => {
    expect(withAdminActionRefresh("/admin/products?success=product-saved", 123)).toBe(
      "/admin/products?success=product-saved&refresh=123",
    );
    expect(withAdminActionRefresh("/admin/categories", 456)).toBe("/admin/categories?refresh=456");
  });
});
