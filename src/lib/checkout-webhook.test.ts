import { afterEach, describe, expect, it, vi } from "vitest";
import { processStripeCheckoutEvent } from "@/lib/checkout";

const mocks = vi.hoisted(() => {
  const tx = {
    stripeEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    productVariant: {
      updateMany: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("processStripeCheckoutEvent", () => {
  it("does not decrement stock when the Stripe event was already processed", async () => {
    mocks.tx.stripeEvent.findUnique.mockResolvedValueOnce({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      orderId: "order_1",
    });

    const result = await processStripeCheckoutEvent(
      "evt_duplicate",
      "checkout.session.completed",
      {
        id: "cs_duplicate",
        payment_status: "paid",
        metadata: { orderId: "order_1" },
      } as never,
    );

    expect(result).toEqual({ status: "already_processed" });
    expect(mocks.tx.order.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
  });
});
