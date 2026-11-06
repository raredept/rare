import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyAsaasPayment, createCheckoutSession, processAsaasPayment, requestAsaasRefund } from "@/lib/checkout";
import { AsaasError, type AsaasPayment } from "@/lib/asaas";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    productVariant: { findMany: vi.fn(), updateMany: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    emailOutbox: { createMany: vi.fn() },
    adminNotification: { createMany: vi.fn() },
    promotion: { findMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      customer: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
      customerAddress: { findMany: vi.fn() },
      order: { update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
      pixCharge: { upsert: vi.fn() },
      adminAuditLog: { create: vi.fn() },
    },
    asaas: {
      createAsaasPayment: vi.fn(),
      getAsaasPixQrCode: vi.fn(),
      findAsaasCustomerByReference: vi.fn(),
      createAsaasCustomer: vi.fn(),
      refundAsaasPayment: vi.fn(),
    },
    getStoreSettings: vi.fn(),
    notifyAdminsOfPaidOrder: vi.fn(),
    getStripe: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.getStoreSettings }));
vi.mock("@/lib/admin-notifications", () => ({ notifyAdminsOfPaidOrder: mocks.notifyAdminsOfPaidOrder }));
vi.mock("@/lib/checkout-expiry", () => ({ reconcileCheckoutExpiry: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.getStripe, normalizePaymentMethodTypes: vi.fn() }));
vi.mock("@/lib/asaas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/asaas")>()), ...mocks.asaas }));

const originalEnv = process.env;
const sandboxKey = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjAwMDAwMDAwMDAwMDAwMDA";

function asaasOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "awaiting_payment", paymentProvider: "asaas", paymentMethod: "pix",
    asaasPaymentId: "pay_080225913252", stripePaymentIntentId: null, totalInCents: 17000, reservationExpiresAt: new Date("2026-11-27T15:30:00Z"),
    customerName: "Ana", customerEmail: "ana@example.com", customerPhone: null, customerNameSnapshot: "Ana", customerEmailSnapshot: "ana@example.com",
    customerPhoneSnapshot: null, shippingAddressSnapshot: { city: "São Paulo" }, billingAddressSnapshot: null,
    items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1 }],
    ...overrides,
  };
}

function payment(overrides: Partial<AsaasPayment> = {}): AsaasPayment {
  return { id: "pay_080225913252", status: "RECEIVED", billingType: "PIX", amountInCents: 17000, customerId: "cus_000005401844", externalReference: "order_asaas_1", invoiceUrl: null, deleted: false, ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env = { ...originalEnv, APP_ENV: "staging", APP_URL: "https://staging.rare.example", PAYMENT_PROVIDER: "asaas", ASAAS_ENV: "sandbox", ASAAS_API_KEY: sandboxKey, ASAAS_WEBHOOK_TOKEN: "w".repeat(40), SHIPPING_ENABLED: "true", SHIPPING_PROVIDER: "manual", SHIPPING_ORIGIN_CEP: "01001000" };
  mocks.prisma.$transaction.mockImplementation(async (work: unknown) => (typeof work === "function" ? (work as (client: typeof mocks.tx) => unknown)(mocks.tx) : Promise.all(work as Promise<unknown>[])));
  mocks.tx.order.findFirst.mockResolvedValue({ id: "order_asaas_1" });
  mocks.tx.$queryRaw.mockResolvedValue([]);
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder());
  mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.promotion.findMany.mockResolvedValue([]);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("Asaas status mapping", () => {
  it.each([
    ["CONFIRMED", "paid"], ["RECEIVED", "paid"], ["RECEIVED_IN_CASH", "paid"], ["PENDING", "pending"], ["OVERDUE", "pending"],
    ["AWAITING_RISK_ANALYSIS", "processing"], ["REFUNDED", "refunded"], ["REFUND_REQUESTED", "refund_pending"],
    ["CHARGEBACK_REQUESTED", "chargeback"], ["CHARGEBACK_DISPUTE", "chargeback"], ["SOMETHING_NEW", "unknown"],
  ])("%s -> %s", (status, outcome) => {
    expect(classifyAsaasPayment({ status, deleted: false })).toBe(outcome);
  });

  it("a deleted charge is closed whatever its last status", () => {
    expect(classifyAsaasPayment({ status: "PENDING", deleted: true })).toBe("closed");
  });
});

describe("processAsaasPayment (authoritative state)", () => {
  it("marks the order paid once, consuming the reservation", async () => {
    await expect(processAsaasPayment(payment())).resolves.toEqual({ status: "paid", orderId: "order_asaas_1" });
    expect(mocks.tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "paid" }) }));
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "sale", stockDelta: -1, reservedDelta: -1 }) }));
    expect(mocks.notifyAdminsOfPaidOrder).toHaveBeenCalledWith("order_asaas_1");
  });

  it("warns the Admin not to ship a Pix that Asaas holds in CONFIRMED (precautionary block)", async () => {
    await expect(processAsaasPayment(payment({ status: "CONFIRMED", billingType: "PIX" }))).resolves.toEqual({ status: "paid", orderId: "order_asaas_1" });
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_pix_held", orderId: "order_asaas_1" });
  });

  it("does not raise the Pix hold warning for a received Pix or a confirmed card", async () => {
    await processAsaasPayment(payment({ status: "RECEIVED", billingType: "PIX" }));
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ paymentMethod: "card" }));
    await processAsaasPayment(payment({ status: "CONFIRMED", billingType: "CREDIT_CARD" }));
    expect(mocks.tx.adminNotification.createMany).not.toHaveBeenCalled();
  });

  it("is idempotent: a duplicate or late CONFIRMED after RECEIVED changes nothing", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "paid" }));
    await expect(processAsaasPayment(payment({ status: "CONFIRMED" }))).resolves.toEqual({ status: "already_paid" });
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
  });

  it("never moves a paid order back when an older PENDING state is replayed", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "paid" }));
    await expect(processAsaasPayment(payment({ status: "PENDING" }))).resolves.toEqual({ status: "ignored" });
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
  });

  it("does not mark paid on a divergent amount: incident recorded, order untouched", async () => {
    await expect(processAsaasPayment(payment({ amountInCents: 100 }))).resolves.toEqual({ status: "payment_mismatch" });
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_mismatch", orderId: "order_asaas_1" });
  });

  it("does not accept a different charge id for the order", async () => {
    await expect(processAsaasPayment(payment({ id: "pay_999999999999" }))).resolves.toEqual({ status: "payment_mismatch" });
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
  });

  it("does not accept a charge whose reference points to another order", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce({ id: "order_asaas_1" });
    await expect(processAsaasPayment(payment({ externalReference: "someone_elses_order" }))).resolves.toEqual({ status: "payment_mismatch" });
  });

  it("does not mark a card order paid by a Pix confirmation", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ paymentMethod: "card" }));
    await expect(processAsaasPayment(payment({ billingType: "PIX" }))).resolves.toEqual({ status: "payment_mismatch" });
  });

  it("releases the reservation when the charge was deleted unpaid", async () => {
    await expect(processAsaasPayment(payment({ status: "PENDING", deleted: true }))).resolves.toEqual({ status: "released" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith({ where: { id: "var_1", reservedStock: { gte: 1 } }, data: { reservedStock: { decrement: 1 } } });
  });

  it("refunds a paid order without putting stock back automatically", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "paid" }));
    await expect(processAsaasPayment(payment({ status: "REFUNDED" }))).resolves.toEqual({ status: "refunded" });
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { status: "refunded" } });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("never pays a refunded order again", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "refunded" }));
    await expect(processAsaasPayment(payment({ status: "RECEIVED" }))).resolves.toEqual({ status: "already_refunded" });
  });

  it("flags a chargeback for the Admin without changing the order", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "paid" }));
    await expect(processAsaasPayment(payment({ status: "CHARGEBACK_REQUESTED" }))).resolves.toEqual({ status: "chargeback" });
    expect(mocks.tx.order.update).not.toHaveBeenCalled();
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_chargeback" });
  });

  it("holds the stock during risk analysis", async () => {
    await expect(processAsaasPayment(payment({ status: "AWAITING_RISK_ANALYSIS" }))).resolves.toEqual({ status: "processing" });
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { reservationExpiresAt: null } });
  });

  it("refuses to pay when stock was not reserved and is gone (late payment after release)", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder({ status: "canceled" }));
    mocks.tx.$executeRaw.mockResolvedValueOnce(0);
    await expect(processAsaasPayment(payment())).rejects.toThrow("Reserved stock is not available");
  });
});

describe("createCheckoutSession through Asaas", () => {
  function seed(priceInCents = 20000) {
    mocks.prisma.order.findMany.mockResolvedValue([]);
    mocks.prisma.order.count.mockResolvedValue(0);
    mocks.prisma.customer.findFirst.mockResolvedValue({ id: "customer_000001", name: "Ana Souza", email: "ana@example.com", phone: null, cpf: "12345678909" });
    mocks.prisma.customer.findUnique.mockResolvedValue({ asaasCustomerId: null });
    mocks.prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.customerAddress.findMany.mockResolvedValue([{ id: "addr_1", customerId: "customer_000001", label: null, recipientName: null, phone: null, cep: "01001000", street: "Rua A", number: "1", complement: null, neighborhood: "Centro", city: "São Paulo", state: "SP" }]);
    mocks.getStoreSettings.mockResolvedValue({ checkoutRequiresAddress: true, shippingMode: "fixed", fixedShippingInCents: 2000, manualShippingInCents: 0, freeShippingThresholdInCents: null, checkoutReservationMinutes: 30 });
    mocks.tx.productVariant.findMany.mockResolvedValue([{ id: "var_1", productId: "prod_1", size: "M", active: true, product: { id: "prod_1", title: "Jaqueta", active: true, priceInCents, categoryId: null, subcategoryId: null, weightGrams: 400, lengthCm: 30, widthCm: 24, heightCm: 4, images: [] } }]);
    mocks.tx.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", ...data, items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1 }] }));
    mocks.tx.order.findUniqueOrThrow.mockImplementation(async () => ({ ...(await mocks.tx.order.create.mock.results[0].value), items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1, product: { images: [] } }] }));
    mocks.asaas.findAsaasCustomerByReference.mockResolvedValue(null);
    mocks.asaas.createAsaasCustomer.mockResolvedValue("cus_000005401844");
  }

  const pixInput = { items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }], customerAddressId: "addr_1", shippingOptionId: "fixed", paymentMethod: "pix" };

  it("charges R$ 170 (R$ 200 - 25% + R$ 20 freight) computed server-side, ignoring a R$ 1 total from the browser", async () => {
    seed();
    process.env.SHIPPING_ENABLED = "false";
    mocks.tx.promotion.findMany.mockResolvedValue([{ id: "promo_bf", name: "BF", slug: "bf", status: "ACTIVE", type: "PERCENTAGE", value: 25, scope: "ALL_PRODUCTS", startsAt: null, endsAt: null, priority: 0, createdAt: new Date(), badgeText: null, products: [], categories: [] }]);
    mocks.asaas.createAsaasPayment.mockImplementation(async (_config: unknown, input: { totalInCents: number }) => payment({ status: "PENDING", amountInCents: input.totalInCents, externalReference: "order_asaas_1" }));
    mocks.asaas.getAsaasPixQrCode.mockResolvedValue({ copyPaste: "000201...", qrCodeBase64: "iVBORw0KGgo=", expiresAt: null });
    const result = await createCheckoutSession({ ...pixInput, totalInCents: 100, amount: 1, finalTotal: 1, shipping: 0 }, { customerId: "customer_000001" });
    expect(mocks.asaas.createAsaasPayment.mock.calls[0][1]).toMatchObject({ totalInCents: 17000, method: "pix", customerId: "cus_000005401844", orderId: "order_asaas_1" });
    expect(mocks.tx.order.create.mock.calls[0][0].data).toMatchObject({ paymentProvider: "asaas", paymentMethod: "pix", totalInCents: 17000 });
    expect(mocks.prisma.pixCharge.upsert).toHaveBeenCalled();
    expect(result.url).toBe("/pedido/pix/order_asaas_1");
  });

  it("reuses the stored Asaas customer instead of creating one per attempt", async () => {
    seed();
    mocks.prisma.customer.findUnique.mockResolvedValue({ asaasCustomerId: "cus_000000000777" });
    mocks.asaas.createAsaasPayment.mockImplementation(async (_config: unknown, input: { totalInCents: number }) => payment({ status: "PENDING", amountInCents: input.totalInCents, customerId: "cus_000000000777" }));
    mocks.asaas.getAsaasPixQrCode.mockResolvedValue({ copyPaste: "000201...", qrCodeBase64: null, expiresAt: null });
    await createCheckoutSession(pixInput, { customerId: "customer_000001" });
    expect(mocks.asaas.createAsaasCustomer).not.toHaveBeenCalled();
    expect(mocks.asaas.findAsaasCustomerByReference).not.toHaveBeenCalled();
  });

  it("sends the shopper to the Asaas invoice for card (no card data in the store)", async () => {
    seed();
    mocks.asaas.createAsaasPayment.mockImplementation(async (_config: unknown, input: { totalInCents: number }) => payment({ status: "PENDING", billingType: "CREDIT_CARD", amountInCents: input.totalInCents, invoiceUrl: "https://sandbox.asaas.com/i/080225913252" }));
    const result = await createCheckoutSession({ ...pixInput, paymentMethod: "card" }, { customerId: "customer_000001" });
    expect(result.url).toBe("https://sandbox.asaas.com/i/080225913252");
    expect(mocks.asaas.getAsaasPixQrCode).not.toHaveBeenCalled();
    expect(mocks.prisma.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { asaasPaymentId: "pay_080225913252", paymentUrl: "https://sandbox.asaas.com/i/080225913252" } });
  });

  it("releases the stock at once when Asaas refuses the charge (nothing was created)", async () => {
    seed();
    mocks.tx.order.findUnique.mockResolvedValue({ id: "order_asaas_1", items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1 }] });
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(asaasOrder());
    mocks.asaas.createAsaasPayment.mockRejectedValue(new AsaasError("rejected", "AsaasRejectedRequest", 400));
    await expect(createCheckoutSession(pixInput, { customerId: "customer_000001" })).rejects.toMatchObject({ code: "AsaasRejectedRequest" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reservedStock: { decrement: 1 } } }));
  });

  it("keeps the reservation when the outcome is unknown (timeout / 5xx): the worker closes the charge first", async () => {
    seed();
    mocks.asaas.createAsaasPayment.mockRejectedValue(new AsaasError("unknown", "AsaasDeadlineExceeded"));
    await expect(createCheckoutSession(pixInput, { customerId: "customer_000001" })).rejects.toMatchObject({ code: "AsaasDeadlineExceeded" });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("never shows a charge that does not match the order (value tampered upstream)", async () => {
    seed();
    mocks.asaas.createAsaasPayment.mockResolvedValue(payment({ status: "PENDING", amountInCents: 100 }));
    await expect(createCheckoutSession(pixInput, { customerId: "customer_000001" })).rejects.toMatchObject({ code: "AsaasChargeMismatch" });
    expect(mocks.asaas.getAsaasPixQrCode).not.toHaveBeenCalled();
    expect(mocks.prisma.pixCharge.upsert).not.toHaveBeenCalled();
  });

  it("refuses before reserving stock when Asaas is misconfigured for the environment", async () => {
    seed();
    process.env.APP_ENV = "production";
    await expect(createCheckoutSession(pixInput, { customerId: "customer_000001" })).rejects.toThrow("Pagamentos temporariamente indisponíveis");
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("refuses a method not enabled for Asaas", async () => {
    seed();
    process.env.ASAAS_PAYMENT_METHODS = "pix";
    await expect(createCheckoutSession({ ...pixInput, paymentMethod: "card" }, { customerId: "customer_000001" })).rejects.toThrow("cartão está indisponível");
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });
});

describe("requestAsaasRefund", () => {
  const actor = { id: "admin_1", label: "ops" };

  it("claims the refund once, then calls Asaas", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "paid", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", refundRequestedAt: null });
    mocks.prisma.order.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mocks.asaas.refundAsaasPayment.mockResolvedValue(payment({ status: "REFUND_REQUESTED" }));
    await expect(requestAsaasRefund("order_asaas_1", actor)).resolves.toEqual({ status: "requested" });
    await expect(requestAsaasRefund("order_asaas_1", actor)).resolves.toEqual({ status: "already_requested" });
    expect(mocks.asaas.refundAsaasPayment).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({ action: "order.refund_requested" });
  });

  it("releases the claim when Asaas refuses, so a corrected retry is possible", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "paid", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", refundRequestedAt: null });
    mocks.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.asaas.refundAsaasPayment.mockRejectedValue(new AsaasError("rejected", "AsaasRejectedRequest", 400));
    await expect(requestAsaasRefund("order_asaas_1", actor)).resolves.toMatchObject({ status: "rejected" });
    expect(mocks.prisma.order.updateMany).toHaveBeenLastCalledWith({ where: { id: "order_asaas_1" }, data: { refundRequestedAt: null } });
  });

  it("refuses unpaid or non-Asaas orders", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "o", orderNumber: "x", status: "awaiting_payment", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", refundRequestedAt: null });
    await expect(requestAsaasRefund("o", actor)).resolves.toEqual({ status: "not_refundable" });
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "o", orderNumber: "x", status: "paid", paymentProvider: "stripe", asaasPaymentId: null, refundRequestedAt: null });
    await expect(requestAsaasRefund("o", actor)).resolves.toEqual({ status: "not_refundable" });
    expect(mocks.asaas.refundAsaasPayment).not.toHaveBeenCalled();
  });
});
