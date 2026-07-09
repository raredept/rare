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
    notifyAdminsOfPaidOrder: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/admin-notifications", () => ({
  notifyAdminsOfPaidOrder: mocks.notifyAdminsOfPaidOrder,
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
    expect(mocks.notifyAdminsOfPaidOrder).not.toHaveBeenCalled();
  });

  it("creates an admin notification after a Stripe checkout event confirms payment", async () => {
    mocks.tx.stripeEvent.findUnique.mockResolvedValueOnce(null);
    mocks.tx.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNumber: "RARE-PAID",
      status: "awaiting_payment",
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      customerNameSnapshot: null,
      customerEmailSnapshot: null,
      customerPhoneSnapshot: null,
      shippingAddressSnapshot: null,
      billingAddressSnapshot: null,
      stripePaymentIntentId: null,
      paymentMethod: null,
      items: [
        {
          id: "item_1",
          productId: "product_1",
          variantId: "variant_1",
          quantity: 1,
        },
      ],
    });
    mocks.tx.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });
    mocks.tx.inventoryMovement.create.mockResolvedValueOnce({});
    mocks.tx.order.update.mockResolvedValueOnce({});
    mocks.tx.stripeEvent.create.mockResolvedValueOnce({});
    mocks.notifyAdminsOfPaidOrder.mockResolvedValueOnce({ status: "notified" });

    const result = await processStripeCheckoutEvent(
      "evt_paid",
      "checkout.session.completed",
      {
        id: "cs_paid",
        payment_status: "paid",
        metadata: { orderId: "order_1" },
        payment_intent: "pi_paid",
        payment_method_types: ["card"],
        customer_details: {
          email: "cliente@example.com",
          name: "Cliente Teste",
          phone: null,
        },
      } as never,
    );

    expect(result).toEqual({ status: "paid", orderId: "order_1" });
    expect(mocks.notifyAdminsOfPaidOrder).toHaveBeenCalledWith("order_1");
  });
});
