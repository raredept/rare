import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, pixUnavailableMessage, supersedeOpenCheckouts, checkoutInProgressMessage } from "@/lib/checkout";
import { PIX_PROVIDER_EXPIRY_GRACE_SECONDS, PIX_RESERVATION_MINUTES } from "@/lib/checkout-policy";
import { MercadoPagoError } from "@/lib/mercadopago";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    productVariant: { findMany: vi.fn(), updateMany: vi.fn() },
    inventoryMovement: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      customer: { findFirst: vi.fn() },
      customerAddress: { findMany: vi.fn() },
      order: { update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      pixCharge: { upsert: vi.fn() },
    },
    reconcileCheckoutExpiry: vi.fn(),
    getStoreSettings: vi.fn(),
    getStripe: vi.fn(),
    normalizePaymentMethodTypes: vi.fn(),
    createPixPayment: vi.fn(),
    isPixCheckoutAvailable: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/checkout-expiry", () => ({ reconcileCheckoutExpiry: mocks.reconcileCheckoutExpiry }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.getStoreSettings }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe, normalizePaymentMethodTypes: mocks.normalizePaymentMethodTypes }));
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  createPixPayment: mocks.createPixPayment,
  isPixCheckoutAvailable: mocks.isPixCheckoutAvailable,
  getMercadoPagoConfig: () => ({ accessToken: "synthetic", webhookSecret: "synthetic", mode: "test" }),
}));

const originalEnv = process.env;
const pixInput = {
  items: [{ productId: "prod_1", variantId: "var_1", quantity: 2 }],
  shippingOptionId: "manual:PAC",
  customerAddressId: "addr_1",
  shippingDestinationCep: "01001000",
  paymentMethod: "pix" as const,
};
const options = { customerId: "customer_1" };
const orderItem = { id: "item_1", productId: "prod_1", variantId: "var_1", productTitleSnapshot: "Camiseta RARE", sizeSnapshot: "M", quantity: 2, unitPriceInCents: 10000, totalInCents: 20000 };
const storedOrder = {
  id: "order_pix_1",
  orderNumber: "RARE-PIX",
  status: "awaiting_payment",
  customerEmailSnapshot: "cliente@example.com",
  customerNameSnapshot: "Cliente Teste",
  subtotalInCents: 20000,
  discountInCents: 0,
  shippingInCents: 1990,
  totalInCents: 21990,
  items: [{ ...orderItem, product: { images: [] } }],
};

function approvedCreation(overrides: Record<string, unknown> = {}) {
  return {
    id: "1320000001",
    status: "pending",
    statusDetail: "pending_waiting_transfer",
    amountInCents: 21990,
    currency: "brl",
    externalReference: "order_pix_1",
    paymentMethodId: "pix",
    liveMode: false,
    pix: { copyPaste: "00020126synthetic", qrCodeBase64: "QUJD", ticketUrl: "https://www.mercadopago.com.br/payments/1320000001/ticket" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T15:00:00.000Z"));
  process.env = { ...originalEnv, APP_URL: "https://staging.rare.example", SHIPPING_ENABLED: "true", SHIPPING_PROVIDER: "manual", SHIPPING_ORIGIN_CEP: "01001000" };
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (work: unknown) =>
    typeof work === "function" ? (work as (transaction: typeof mocks.tx) => unknown)(mocks.tx) : Promise.all(work as Promise<unknown>[]),
  );
  mocks.prisma.order.findMany.mockResolvedValue([]);
  mocks.prisma.order.update.mockResolvedValue({});
  mocks.prisma.pixCharge.upsert.mockResolvedValue({});
  mocks.prisma.customer.findFirst.mockResolvedValue({ id: "customer_1", name: "Cliente Teste", email: "cliente@example.com", phone: "11999999999", cpf: "12345678909" });
  mocks.prisma.customerAddress.findMany.mockResolvedValue([
    { id: "addr_1", customerId: "customer_1", label: "Casa", recipientName: null, phone: null, cep: "01001000", street: "Rua Teste", number: "123", complement: null, neighborhood: "Centro", city: "Sao Paulo", state: "SP" },
  ]);
  mocks.getStoreSettings.mockResolvedValue({ checkoutRequiresAddress: true, shippingMode: "manual", originCep: "01001000", fixedShippingInCents: 1500, manualShippingInCents: 0, freeShippingMinInCents: null, freeShippingThresholdInCents: null });
  mocks.tx.productVariant.findMany.mockResolvedValue([
    { id: "var_1", productId: "prod_1", size: "M", active: true, product: { id: "prod_1", title: "Camiseta RARE", active: true, priceInCents: 10000, weightGrams: 400, lengthCm: 30, widthCm: 24, heightCm: 4, images: [] } },
  ]);
  mocks.tx.order.create.mockResolvedValue({ ...storedOrder, items: [orderItem] });
  mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue(storedOrder);
  mocks.isPixCheckoutAvailable.mockReturnValue(true);
  mocks.createPixPayment.mockResolvedValue(approvedCreation());
});

afterEach(() => {
  process.env = originalEnv;
  vi.useRealTimers();
});

describe("createCheckoutSession with Pix", () => {
  it("reserves stock like a card order, then creates a Pix for the server total and never calls Stripe", async () => {
    const result = await createCheckoutSession(pixInput, options);

    expect(result).toEqual({
      url: "/pedido/pix/order_pix_1",
      orderId: "order_pix_1",
      orderNumber: "RARE-PIX",
      checkoutDeadlineAt: new Date(Date.now() + PIX_RESERVATION_MINUTES * 60_000).toISOString(),
    });

    const created = mocks.tx.order.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ status: "awaiting_payment", paymentProvider: "mercadopago", paymentMethod: "pix", subtotalInCents: 20000 });
    expect(created.reservationExpiresAt).toEqual(new Date("2026-10-13T15:30:00.000Z"));
    expect(created.checkoutExpiryJob.create.deadlineAt).toEqual(created.reservationExpiresAt);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(1); // the atomic reservation

    expect(mocks.createPixPayment).toHaveBeenCalledTimes(1);
    expect(mocks.createPixPayment.mock.calls[0][1]).toEqual({
      orderId: "order_pix_1",
      orderNumber: "RARE-PIX",
      totalInCents: 21990,
      providerExpiresAt: new Date(new Date("2026-10-13T15:30:00.000Z").getTime() + PIX_PROVIDER_EXPIRY_GRACE_SECONDS * 1000),
      payer: { email: "cliente@example.com", name: "Cliente Teste", cpf: "12345678909" },
      notificationUrl: "https://staging.rare.example/api/mercadopago/webhook",
    });
    expect(mocks.prisma.order.update).toHaveBeenCalledWith({ where: { id: "order_pix_1" }, data: { mercadoPagoPaymentId: "1320000001" } });
    expect(mocks.prisma.pixCharge.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderId: "order_pix_1" },
      create: { orderId: "order_pix_1", copyPaste: "00020126synthetic", qrCodeBase64: "QUJD", ticketUrl: "https://www.mercadopago.com.br/payments/1320000001/ticket" },
    }));
    expect(mocks.getStripe).not.toHaveBeenCalled();
    expect(mocks.normalizePaymentMethodTypes).not.toHaveBeenCalled();
  });

  it("refuses before reserving anything when Pix is switched off or not configured", async () => {
    mocks.isPixCheckoutAvailable.mockReturnValue(false);
    await expect(createCheckoutSession(pixInput, options)).rejects.toThrow(pixUnavailableMessage);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.createPixPayment).not.toHaveBeenCalled();
  });

  it("keeps the card flow untouched when no payment method is sent", async () => {
    mocks.getStripe.mockReturnValue({ checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.test/session" }) } } });
    const cardInput = { items: pixInput.items, shippingOptionId: pixInput.shippingOptionId, customerAddressId: pixInput.customerAddressId, shippingDestinationCep: pixInput.shippingDestinationCep };
    const result = await createCheckoutSession(cardInput, options);

    expect(result.url).toBe("https://checkout.stripe.test/session");
    expect(mocks.tx.order.create.mock.calls[0][0].data).not.toHaveProperty("paymentProvider");
    expect(mocks.tx.order.create.mock.calls[0][0].data.reservationExpiresAt).toEqual(new Date("2026-10-13T15:15:00.000Z"));
    expect(mocks.createPixPayment).not.toHaveBeenCalled();
    expect(mocks.isPixCheckoutAvailable).not.toHaveBeenCalled();
  });

  it("gives the stock back at once when Mercado Pago refuses to create the Pix", async () => {
    mocks.createPixPayment.mockRejectedValueOnce(new MercadoPagoError("rejected", "MercadoPagoRejectedRequest", 400));
    mocks.tx.order.findUnique.mockResolvedValueOnce({ id: "order_pix_1", items: [orderItem] });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue({ ...storedOrder, items: [orderItem] });
    mocks.tx.productVariant.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(createCheckoutSession(pixInput, options)).rejects.toMatchObject({ code: "MercadoPagoRejectedRequest" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: "var_1", reservedStock: { gte: 2 } }, data: { reservedStock: { decrement: 2 } } });
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_pix_1" }, data: { status: "failed" } });
    expect(mocks.prisma.pixCharge.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["an ambiguous provider failure", () => mocks.createPixPayment.mockRejectedValueOnce(new MercadoPagoError("unknown", "MercadoPagoDeadlineExceeded"))],
    ["a Pix for another amount", () => mocks.createPixPayment.mockResolvedValueOnce(approvedCreation({ amountInCents: 2199 }))],
    ["a Pix for another order", () => mocks.createPixPayment.mockResolvedValueOnce(approvedCreation({ externalReference: "order_other" }))],
    ["a payment that is not Pix", () => mocks.createPixPayment.mockResolvedValueOnce(approvedCreation({ paymentMethodId: "bolbradesco" }))],
    ["a failure while storing the Pix", () => mocks.prisma.pixCharge.upsert.mockRejectedValueOnce(new Error("Temporary database failure"))],
  ])("keeps the reservation for the worker after %s, and shows no code", async (_label, arrange) => {
    arrange();
    await expect(createCheckoutSession(pixInput, options)).rejects.toThrow();
    // No release: a payable Pix may exist, so the worker closes it at Mercado Pago first.
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.order.findUnique).not.toHaveBeenCalled();
  });
});

describe("supersedeOpenCheckouts with a Pix order", () => {
  it("waits while a Pix creation is still in flight and reconciles once it has a payment", async () => {
    const now = new Date("2026-10-13T15:00:30.000Z");
    mocks.prisma.order.findMany.mockResolvedValueOnce([{ id: "order_pix_1", createdAt: new Date("2026-10-13T15:00:00.000Z"), stripeCheckoutSessionId: null, mercadoPagoPaymentId: null }]);
    await expect(supersedeOpenCheckouts("customer_1", now)).rejects.toThrow(checkoutInProgressMessage);
    expect(mocks.reconcileCheckoutExpiry).not.toHaveBeenCalled();

    mocks.prisma.order.findMany.mockResolvedValueOnce([{ id: "order_pix_1", createdAt: new Date("2026-10-13T15:00:00.000Z"), stripeCheckoutSessionId: null, mercadoPagoPaymentId: "1320000001" }]);
    mocks.reconcileCheckoutExpiry.mockResolvedValueOnce({ outcome: "released" });
    await expect(supersedeOpenCheckouts("customer_1", now)).resolves.toBeUndefined();
    expect(mocks.reconcileCheckoutExpiry).toHaveBeenCalledWith("order_pix_1");
  });
});
