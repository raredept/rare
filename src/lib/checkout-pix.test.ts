import { afterEach, describe, expect, it, vi } from "vitest";
import { processMercadoPagoPayment, releasePixOrderWithoutPayment } from "@/lib/checkout";
import type { MercadoPagoPayment } from "@/lib/mercadopago";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    productVariant: {
      updateMany: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    emailOutbox: {
      createMany: vi.fn(),
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

function pixOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_pix_1",
    orderNumber: "RARE-PIX",
    status: "awaiting_payment",
    paymentProvider: "mercadopago",
    mercadoPagoPaymentId: "1320000001",
    stripePaymentIntentId: null,
    paymentMethod: "pix",
    totalInCents: 14247,
    reservationExpiresAt: new Date("2026-10-13T15:30:00Z"),
    customerName: "Cliente Teste",
    customerEmail: "cliente@example.com",
    customerPhone: null,
    customerNameSnapshot: "Cliente Teste",
    customerEmailSnapshot: "cliente@example.com",
    customerPhoneSnapshot: null,
    shippingAddressSnapshot: { city: "São Paulo" },
    billingAddressSnapshot: null,
    items: [{ id: "item_1", productId: "product_1", variantId: "variant_1", quantity: 2 }],
    ...overrides,
  };
}

function payment(overrides: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment {
  return {
    id: "1320000001",
    status: "approved",
    statusDetail: "accredited",
    amountInCents: 14247,
    currency: "brl",
    externalReference: "order_pix_1",
    paymentMethodId: "pix",
    liveMode: true,
    pix: null,
    ...overrides,
  };
}

function expectNothingChanged() {
  expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  expect(mocks.tx.emailOutbox.createMany).not.toHaveBeenCalled();
  expect(mocks.notifyAdminsOfPaidOrder).not.toHaveBeenCalled();
}

describe("processMercadoPagoPayment", () => {
  it("confirms an approved Pix once: stock, order, e-mail, then the admin notification", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder());
    mocks.tx.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await processMercadoPagoPayment(payment());

    expect(result).toEqual({ status: "paid", orderId: "order_pix_1" });
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(1); // the order row lock
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "variant_1", stock: { gte: 2 }, reservedStock: { gte: 2 } },
      data: { stock: { decrement: 2 }, reservedStock: { decrement: 2 } },
    });
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "sale", orderId: "order_pix_1", stockDelta: -2, reservedDelta: -2, reason: "Pagamento Pix confirmado pelo Mercado Pago" }),
    });
    expect(mocks.tx.order.update).toHaveBeenCalledWith({
      where: { id: "order_pix_1" },
      data: expect.objectContaining({ status: "paid", paymentMethod: "pix", stripePaymentIntentId: null, paidAt: expect.any(Date) }),
    });
    expect(mocks.tx.emailOutbox.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderId: "order_pix_1", kind: "payment_approved", recipient: "cliente@example.com", totalInCents: 14247 })],
      skipDuplicates: true,
    });
    expect(mocks.notifyAdminsOfPaidOrder).toHaveBeenCalledWith("order_pix_1");
    expect(mocks.tx.order.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.notifyAdminsOfPaidOrder.mock.invocationCallOrder[0]);
  });

  it("does nothing the second time the same approval arrives", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder({ status: "paid" }));

    expect(await processMercadoPagoPayment(payment())).toEqual({ status: "already_paid" });
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  it.each([
    ["a smaller amount", { amountInCents: 100 }, /payment total does not match order RARE-PIX/],
    ["a larger amount", { amountInCents: 14248 }, /payment total does not match order RARE-PIX/],
    ["an unreadable amount", { amountInCents: null }, /payment total does not match order RARE-PIX/],
    ["another currency", { currency: "usd" }, /payment total does not match order RARE-PIX/],
    ["another payment method", { paymentMethodId: "account_money" }, /payment method does not match order RARE-PIX/],
    ["another payment id for the same order", { id: "999" }, /payment does not match order RARE-PIX/],
    ["another order reference", { externalReference: "order_other" }, /payment does not match order RARE-PIX/],
    ["no order reference", { externalReference: null }, /payment does not match order RARE-PIX/],
  ])("never confirms an approval with %s", async (_label, override, message) => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder());

    await expect(processMercadoPagoPayment(payment(override))).rejects.toThrow(message);
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  it("never lets a Mercado Pago payment confirm a card (Stripe) order", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder({ paymentProvider: "stripe", mercadoPagoPaymentId: null }));

    await expect(processMercadoPagoPayment(payment())).rejects.toThrow(/payment does not match order/);
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  it("links the payment to the order when the notification wins the race with the creation response", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder({ mercadoPagoPaymentId: null }));

    expect(await processMercadoPagoPayment(payment({ status: "pending" }))).toEqual({ status: "ignored" });
    expect(mocks.tx.order.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_pix_1" }, data: { mercadoPagoPaymentId: "1320000001" } });
    expectNothingChanged();
  });

  it("releases the reservation when Mercado Pago closed the Pix unpaid", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(pixOrder());
    mocks.tx.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });

    expect(await processMercadoPagoPayment(payment({ status: "cancelled" }))).toEqual({ status: "released" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "variant_1", reservedStock: { gte: 2 } },
      data: { reservedStock: { decrement: 2 } },
    });
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "release", reservedDelta: -2, reason: "Pix encerrado sem pagamento" }),
    });
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_pix_1" }, data: { status: "canceled" } });
    expect(mocks.tx.emailOutbox.createMany).not.toHaveBeenCalled();
    expect(mocks.notifyAdminsOfPaidOrder).not.toHaveBeenCalled();
  });

  it("does not release twice, and never un-pays an order because of a late cancellation", async () => {
    for (const status of ["canceled", "paid"]) {
      mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
      mocks.tx.order.findUniqueOrThrow.mockResolvedValue(pixOrder({ status }));
      expect(await processMercadoPagoPayment(payment({ status: "cancelled" }))).toEqual({ status: "ignored" });
    }
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expectNothingChanged();
  });

  it("takes fresh stock for a Pix paid after its reservation was released, or fails loudly", async () => {
    mocks.tx.order.findFirst.mockResolvedValue({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(pixOrder({ status: "canceled" }));

    mocks.tx.$executeRaw.mockResolvedValueOnce(1);
    expect(await processMercadoPagoPayment(payment())).toEqual({ status: "paid", orderId: "order_pix_1" });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();

    // No free stock left: nothing is marked paid, and the caller answers 5xx so it is retried and seen.
    vi.clearAllMocks();
    mocks.tx.order.findFirst.mockResolvedValue({ id: "order_pix_1" });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(pixOrder({ status: "canceled" }));
    mocks.tx.$executeRaw.mockResolvedValueOnce(0);
    await expect(processMercadoPagoPayment(payment())).rejects.toThrow(/Reserved stock is not available for order RARE-PIX/);
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.notifyAdminsOfPaidOrder).not.toHaveBeenCalled();
  });

  it("ignores a payment that belongs to no order and states that are not final", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce(null);
    expect(await processMercadoPagoPayment(payment())).toEqual({ status: "order_not_found" });

    for (const status of ["pending", "in_process", "refunded", "charged_back"]) {
      mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_pix_1" });
      mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder());
      expect(await processMercadoPagoPayment(payment({ status }))).toEqual({ status: "ignored" });
    }
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expectNothingChanged();
  });
});

describe("releasePixOrderWithoutPayment", () => {
  it("frees the stock of a Pix order that never got a payment", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(pixOrder({ mercadoPagoPaymentId: null }));
    mocks.tx.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });

    expect(await releasePixOrderWithoutPayment("order_pix_1")).toBe(true);
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "release", reservedDelta: -2 }),
    });
  });

  it("refuses when a payment exists or the order is a card order", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder());
    expect(await releasePixOrderWithoutPayment("order_pix_1")).toBe(false);
    mocks.tx.order.findUniqueOrThrow.mockResolvedValueOnce(pixOrder({ paymentProvider: "stripe", mercadoPagoPaymentId: null }));
    expect(await releasePixOrderWithoutPayment("order_pix_1")).toBe(false);
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });
});
