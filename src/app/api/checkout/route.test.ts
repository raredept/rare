import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/checkout/route";

const routeMocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getCurrentCustomer: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({
  createCheckoutSession: routeMocks.createCheckoutSession,
}));

vi.mock("@/lib/customer-auth", () => ({
  getCurrentCustomer: routeMocks.getCurrentCustomer,
}));

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    CHECKOUT_ENABLED: "false",
  };
  vi.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("checkout route readiness", () => {
  it("returns a controlled response when checkout is disabled", async () => {
    const request = new Request("http://localhost/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items: [] }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Checkout temporariamente indisponível." });
    expect(routeMocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(routeMocks.getCurrentCustomer).not.toHaveBeenCalled();
  });
});
