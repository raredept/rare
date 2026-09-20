import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_STATUS_REFRESH_INTERVAL_MS, ORDER_STATUS_REFRESH_MAX_ATTEMPTS } from "@/components/store/order-status-refresh";

describe("order status refresh policy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is bounded so a stuck order never polls forever", () => {
    expect(ORDER_STATUS_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(2_000);
    expect(ORDER_STATUS_REFRESH_INTERVAL_MS * ORDER_STATUS_REFRESH_MAX_ATTEMPTS).toBeLessThanOrEqual(90_000);
  });
});
