import { describe, expect, it } from "vitest";
import { shouldReleaseReservationOnStatusChange } from "@/lib/order-status";

describe("order status helpers", () => {
  it("releases reservations only for unpaid orders moved to terminal failure statuses", () => {
    expect(shouldReleaseReservationOnStatusChange("awaiting_payment", "canceled")).toBe(true);
    expect(shouldReleaseReservationOnStatusChange("pending", "refunded")).toBe(true);
    expect(shouldReleaseReservationOnStatusChange("paid", "refunded")).toBe(false);
    expect(shouldReleaseReservationOnStatusChange("awaiting_payment", "processing")).toBe(false);
  });
});
