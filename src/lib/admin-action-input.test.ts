import { describe, expect, it } from "vitest";
import { parseAdminEntityId } from "@/lib/admin-action-input";

describe("admin action input", () => {
  it("accepts bounded identifiers and rejects malformed values", () => {
    expect(parseAdminEntityId(" product-1 ")).toBe("product-1");
    expect(parseAdminEntityId(" ")).toBeNull();
    expect(parseAdminEntityId("x".repeat(129))).toBeNull();
    expect(parseAdminEntityId(null)).toBeNull();
  });
});
