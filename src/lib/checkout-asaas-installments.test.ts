import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { createCheckoutSession, installmentUnavailableMessage, minimumPaymentMessage, processAsaasPayment, requestAsaasRefund } from "@/lib/checkout";
import { AsaasError, type AsaasInstallment, type AsaasPayment } from "@/lib/asaas";

// RARE-CARD-INSTALLMENTS-01: server-side pricing, Asaas plan contract, plan-level settlement.

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    order: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    customer: { findUnique: vi.fn() },
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
      getAsaasPayment: vi.fn(),
      getAsaasInstallment: vi.fn(),
      findAsaasCustomerByReference: vi.fn(),
      createAsaasCustomer: vi.fn(),
      refundAsaasPayment: vi.fn(),
      refundAsaasInstallment: vi.fn(),
    },
    getStoreSettings: vi.fn(),
    notifyAdminsOfPaidOrder: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/settings", () => ({ getStoreSettings: mocks.getStoreSettings }));
vi.mock("@/lib/admin-notifications", () => ({ notifyAdminsOfPaidOrder: mocks.notifyAdminsOfPaidOrder }));
vi.mock("@/lib/checkout-expiry", () => ({ reconcileCheckoutExpiry: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(), normalizePaymentMethodTypes: vi.fn() }));
vi.mock("@/lib/asaas", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/asaas")>()), ...mocks.asaas }));

const originalEnv = process.env;
const sandboxKey = ["$aact", "hmlg", `fixture${"0".repeat(40)}`].join("_");
const PLAN_ID = "5e1f7c2a-0b1d-4c3e-9f00-0000000000aa";
const CUSTOMER = "cus_000005401844";
const INVOICE = "https://sandbox.asaas.com/i/080225913252";

// Base of every checkout below: product R$ 200,00 + fixed shipping R$ 20,00 = R$ 220,00.
const BASE = 22_000;
const installmentSettings = {
  cardInstallmentsEnabled: true,
  cardInstallmentsMax: 6,
  cardInstallmentsMinInCents: 1_000,
  cardInstallment4xBps: 600,
  cardInstallment5xBps: 750,
  cardInstallment6xBps: 900,
};

function seed({ priceInCents = 20_000, shippingInCents = 2_000, settings = installmentSettings }: { priceInCents?: number; shippingInCents?: number; settings?: Record<string, unknown> } = {}) {
  mocks.prisma.order.findMany.mockResolvedValue([]);
  mocks.prisma.order.count.mockResolvedValue(0);
  mocks.prisma.customer.findFirst.mockResolvedValue({ id: "customer_000001", name: "Ana Souza", email: "ana@example.com", phone: null, cpf: "12345678909" });
  mocks.prisma.customer.findUnique.mockResolvedValue({ asaasCustomerId: CUSTOMER });
  mocks.prisma.customerAddress.findMany.mockResolvedValue([{ id: "addr_1", customerId: "customer_000001", label: null, recipientName: null, phone: null, cep: "01001000", street: "Rua A", number: "1", complement: null, neighborhood: "Centro", city: "São Paulo", state: "SP" }]);
  mocks.getStoreSettings.mockResolvedValue({ checkoutRequiresAddress: true, shippingMode: "fixed", fixedShippingInCents: shippingInCents, manualShippingInCents: 0, freeShippingThresholdInCents: null, checkoutReservationMinutes: 30, ...settings });
  mocks.tx.productVariant.findMany.mockResolvedValue([{ id: "var_1", productId: "prod_1", size: "M", active: true, product: { id: "prod_1", title: "Jaqueta", active: true, priceInCents, categoryId: null, subcategoryId: null, weightGrams: 400, lengthCm: 30, widthCm: 24, heightCm: 4, images: [] } }]);
  mocks.tx.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", ...data, items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1 }] }));
  mocks.tx.order.findUniqueOrThrow.mockImplementation(async () => ({ ...(await mocks.tx.order.create.mock.results[0].value), items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1, product: { images: [] } }] }));
  // The Asaas answer to an installment plan: its FIRST installment (value = one installment).
  mocks.asaas.createAsaasPayment.mockImplementation(async (_config: unknown, input: { totalInCents: number; installmentCount?: number }) => {
    const count = input.installmentCount ?? 1;
    return payment({
      status: "PENDING", billingType: "CREDIT_CARD", invoiceUrl: INVOICE,
      amountInCents: Math.floor(input.totalInCents / count),
      installmentId: count > 1 ? PLAN_ID : null, installmentNumber: count > 1 ? 1 : null,
    });
  });
  mocks.asaas.getAsaasInstallment.mockImplementation(async () => {
    const input = mocks.asaas.createAsaasPayment.mock.calls[0][1] as { totalInCents: number; installmentCount: number };
    return plan({ totalInCents: input.totalInCents, installmentCount: input.installmentCount });
  });
}

function payment(overrides: Partial<AsaasPayment> = {}): AsaasPayment {
  return { id: "pay_080225913252", status: "CONFIRMED", billingType: "CREDIT_CARD", amountInCents: 3_996, customerId: CUSTOMER, externalReference: "order_asaas_1", invoiceUrl: null, deleted: false, installmentId: PLAN_ID, installmentNumber: 1, ...overrides };
}

function plan(overrides: Partial<AsaasInstallment> = {}): AsaasInstallment {
  return { id: PLAN_ID, totalInCents: 23_980, installmentCount: 6, billingType: "CREDIT_CARD", customerId: CUSTOMER, deleted: false, ...overrides };
}

const cardInput = (extra: Record<string, unknown> = {}) => ({ items: [{ productId: "prod_1", variantId: "var_1", quantity: 1 }], customerAddressId: "addr_1", shippingOptionId: "fixed", paymentMethod: "card", ...extra });
const createdOrder = () => mocks.tx.order.create.mock.calls[0]?.[0].data as Record<string, unknown> | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  process.env = { ...originalEnv, APP_ENV: "staging", APP_URL: "https://staging.rare.example", PAYMENT_PROVIDER: "asaas", ASAAS_ENV: "sandbox", ASAAS_API_KEY: sandboxKey, ASAAS_WEBHOOK_TOKEN: "w".repeat(40), SHIPPING_ENABLED: "true", SHIPPING_PROVIDER: "manual", SHIPPING_ORIGIN_CEP: "01001000", CARD_INSTALLMENTS_ENABLED: "true" };
  mocks.prisma.$transaction.mockImplementation(async (work: unknown) => (typeof work === "function" ? (work as (client: typeof mocks.tx) => unknown)(mocks.tx) : Promise.all(work as Promise<unknown>[])));
  mocks.tx.order.findFirst.mockResolvedValue({ id: "order_asaas_1" });
  mocks.tx.customer.findUnique.mockResolvedValue({ asaasCustomerId: CUSTOMER });
  mocks.tx.$queryRaw.mockResolvedValue([]);
  mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.promotion.findMany.mockResolvedValue([]);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("checkout: the server prices the plan (Asaas contract)", () => {
  it("6x: charges the FINANCED total as one Asaas plan (CREDIT_CARD, 6 installments, totalValue, reference)", async () => {
    seed();
    const result = await createCheckoutSession(cardInput({ installmentCount: 6 }), { customerId: "customer_000001" });
    // R$ 220,00 + 9% = R$ 239,80.
    expect(createdOrder()).toMatchObject({
      totalInCents: 23_980, paymentInstallmentCount: 6, paymentInstallmentRateBps: 900, paymentInstallmentFeeInCents: 1_980,
      paymentBaseTotalInCents: BASE, paymentInstallmentValueInCents: 3_996, paymentLastInstallmentValueInCents: 4_000,
    });
    expect(mocks.asaas.createAsaasPayment.mock.calls[0][1]).toMatchObject({ method: "card", installmentCount: 6, totalInCents: 23_980, orderId: "order_asaas_1", customerId: CUSTOMER });
    expect(mocks.asaas.getAsaasInstallment).toHaveBeenCalledWith(expect.anything(), PLAN_ID);
    expect(mocks.prisma.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { asaasPaymentId: "pay_080225913252", asaasInstallmentId: PLAN_ID, paymentUrl: INVOICE } });
    expect(result.url).toBe(INVOICE);
  });

  it("3x: interest-free plan for exactly the base total", async () => {
    seed();
    await createCheckoutSession(cardInput({ installmentCount: 3 }), { customerId: "customer_000001" });
    expect(createdOrder()).toMatchObject({ totalInCents: BASE, paymentInstallmentCount: 3, paymentInstallmentRateBps: 0, paymentInstallmentFeeInCents: 0 });
    expect(mocks.asaas.createAsaasPayment.mock.calls[0][1]).toMatchObject({ installmentCount: 3, totalInCents: BASE });
  });

  it("1x: today's single card charge, unchanged (no plan, no surcharge)", async () => {
    seed();
    await createCheckoutSession(cardInput(), { customerId: "customer_000001" });
    expect(createdOrder()).toMatchObject({ totalInCents: BASE, paymentInstallmentCount: 1, paymentInstallmentFeeInCents: 0 });
    expect(mocks.asaas.createAsaasPayment.mock.calls[0][1]).toMatchObject({ installmentCount: 1, totalInCents: BASE });
    expect(mocks.asaas.getAsaasInstallment).not.toHaveBeenCalled();
    expect(mocks.prisma.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { asaasPaymentId: "pay_080225913252", paymentUrl: INVOICE } });
  });

  it("ignores every financial value sent by the browser (rate, fee, totals, installment value)", async () => {
    seed();
    await createCheckoutSession(cardInput({ installmentCount: 6, rate: 0, rateBps: 0, fee: 0, feeInCents: 0, totalInCents: 100, total: 1, financedTotal: 1, installmentValue: 1, paymentInstallmentFeeInCents: 0 }), { customerId: "customer_000001" });
    expect(createdOrder()).toMatchObject({ totalInCents: 23_980, paymentInstallmentFeeInCents: 1_980 });
    expect(mocks.asaas.createAsaasPayment.mock.calls[0][1]).toMatchObject({ totalInCents: 23_980 });
  });

  it.each([0, -1, 7, 999, 2.5, "6"])("rejects installmentCount=%s before reserving anything", async (count) => {
    seed();
    await expect(createCheckoutSession(cardInput({ installmentCount: count }), { customerId: "customer_000001" })).rejects.toBeInstanceOf(ZodError);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.asaas.createAsaasPayment).not.toHaveBeenCalled();
  });

  it("refuses 2x+ when the deploy flag is off (instant rollback to 1x)", async () => {
    seed();
    process.env.CARD_INSTALLMENTS_ENABLED = "false";
    await expect(createCheckoutSession(cardInput({ installmentCount: 2 }), { customerId: "customer_000001" })).rejects.toThrow(installmentUnavailableMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    // 1x keeps working.
    await expect(createCheckoutSession(cardInput({ installmentCount: 1 }), { customerId: "customer_000001" })).resolves.toMatchObject({ url: INVOICE });
  });

  it("refuses 2x+ when the Admin toggle is off", async () => {
    seed({ settings: { ...installmentSettings, cardInstallmentsEnabled: false } });
    await expect(createCheckoutSession(cardInput({ installmentCount: 3 }), { customerId: "customer_000001" })).rejects.toThrow(installmentUnavailableMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("refuses a count without a configured surcharge", async () => {
    seed({ settings: { ...installmentSettings, cardInstallment6xBps: null } });
    await expect(createCheckoutSession(cardInput({ installmentCount: 6 }), { customerId: "customer_000001" })).rejects.toThrow(installmentUnavailableMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("refuses an installment below the minimum (no order, no charge)", async () => {
    seed({ priceInCents: 2_000, shippingInCents: 2_000 }); // R$ 40 + 9% = R$ 43,60 -> 6x R$ 7,26 < R$ 10
    await expect(createCheckoutSession(cardInput({ installmentCount: 6 }), { customerId: "customer_000001" })).rejects.toThrow(installmentUnavailableMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.asaas.createAsaasPayment).not.toHaveBeenCalled();
  });

  it("never sends installments with Pix (Pix stays exactly as it was)", async () => {
    seed();
    await expect(createCheckoutSession(cardInput({ paymentMethod: "pix", installmentCount: 3 }), { customerId: "customer_000001" })).rejects.toThrow(installmentUnavailableMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("keeps the reservation and shows no invoice when the plan at Asaas does not match the order", async () => {
    seed();
    // A plan for the base total (without the 6x surcharge) is not this order's plan.
    mocks.asaas.getAsaasInstallment.mockResolvedValue(plan({ totalInCents: BASE }));
    await expect(createCheckoutSession(cardInput({ installmentCount: 6 }), { customerId: "customer_000001" })).rejects.toMatchObject({ code: "AsaasChargeMismatch" });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });
});

describe("checkout: Asaas minimum charge (R$ 10,00) is enforced before anything exists", () => {
  it.each(["pix", "card"])("%s: R$ 8,00 is refused before the order, the reservation or the charge", async (method) => {
    seed({ priceInCents: 500, shippingInCents: 300 });
    await expect(createCheckoutSession(cardInput({ paymentMethod: method }), { customerId: "customer_000001" })).rejects.toThrow(minimumPaymentMessage);
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.asaas.createAsaasPayment).not.toHaveBeenCalled();
  });

  it("exactly R$ 10,00 is accepted", async () => {
    seed({ priceInCents: 700, shippingInCents: 300 });
    await expect(createCheckoutSession(cardInput(), { customerId: "customer_000001" })).resolves.toMatchObject({ url: INVOICE });
  });
});

describe("webhook / reconciliation: a plan is matched as a whole", () => {
  const planOrder = (overrides: Record<string, unknown> = {}) => ({
    id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "awaiting_payment", paymentProvider: "asaas", paymentMethod: "card",
    asaasPaymentId: "pay_080225913252", asaasInstallmentId: PLAN_ID, paymentInstallmentCount: 6, paymentInstallmentValueInCents: 3_996,
    stripePaymentIntentId: null, totalInCents: 23_980, reservationExpiresAt: new Date("2026-11-27T15:30:00Z"),
    customerId: "customer_000001", customerName: "Ana", customerEmail: "ana@example.com", customerPhone: null, customerNameSnapshot: "Ana", customerEmailSnapshot: "ana@example.com",
    customerPhoneSnapshot: null, shippingAddressSnapshot: { city: "São Paulo" }, billingAddressSnapshot: null,
    items: [{ id: "item_1", productId: "prod_1", variantId: "var_1", quantity: 1 }],
    ...overrides,
  });

  beforeEach(() => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(planOrder());
  });

  it("any installment of the matching plan marks the order paid once (stock sold once, e-mail with the plan)", async () => {
    await expect(processAsaasPayment(payment({ id: "pay_000000000002", installmentNumber: 2 }), plan())).resolves.toEqual({ status: "paid", orderId: "order_asaas_1" });
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "sale", stockDelta: -1, reservedDelta: -1 }) }));
    expect(mocks.tx.emailOutbox.createMany.mock.calls[0][0].data[0]).toMatchObject({ totalInCents: 23_980, installmentCount: 6, installmentValueInCents: 3_996 });
  });

  it("is idempotent: the other installments' events (duplicates) change nothing", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(planOrder({ status: "paid" }));
    await expect(processAsaasPayment(payment({ id: "pay_000000000003", installmentNumber: 3 }), plan())).resolves.toEqual({ status: "already_paid" });
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it.each([
    ["plan for the base total, without the surcharge", plan({ totalInCents: BASE })],
    ["plan with another installment count", plan({ installmentCount: 5 })],
    ["plan of another customer", plan({ customerId: "cus_000000099999" })],
    ["plan that is not card", plan({ billingType: "BOLETO" })],
    ["plan not read from the API", null],
  ])("does NOT mark paid: %s", async (_label, read) => {
    await expect(processAsaasPayment(payment(), read)).resolves.toEqual({ status: "payment_mismatch" });
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_mismatch" });
  });

  it("does NOT mark paid: wrong externalReference, wrong customer, or another plan's installment", async () => {
    await expect(processAsaasPayment(payment({ externalReference: "order_other_1" }), plan())).resolves.toEqual({ status: "payment_mismatch" });
    await expect(processAsaasPayment(payment({ customerId: "cus_000000099999" }), plan())).resolves.toEqual({ status: "payment_mismatch" });
    await expect(processAsaasPayment(payment({ installmentId: "5e1f7c2a-0b1d-4c3e-9f00-0000000000bb" }), plan({ id: "5e1f7c2a-0b1d-4c3e-9f00-0000000000bb" }))).resolves.toEqual({ status: "payment_mismatch" });
    await expect(processAsaasPayment(payment({ installmentId: null }), plan())).resolves.toEqual({ status: "payment_mismatch" });
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("a single-charge order never accepts an installment payment", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(planOrder({ asaasInstallmentId: null, paymentInstallmentCount: 1, totalInCents: 3_996 }));
    await expect(processAsaasPayment(payment({ amountInCents: 3_996 }), plan())).resolves.toEqual({ status: "payment_mismatch" });
  });

  it("one removed installment does not release a plan that still exists", async () => {
    await expect(processAsaasPayment(payment({ status: "PENDING", deleted: true }), plan())).resolves.toEqual({ status: "ignored" });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.adminNotification.createMany.mock.calls[0][0].data[0]).toMatchObject({ type: "payment_plan_partial" });
  });

  it("releases the reservation once the whole plan is removed at Asaas", async () => {
    await expect(processAsaasPayment(payment({ status: "PENDING", deleted: true }), plan({ deleted: true }))).resolves.toEqual({ status: "released" });
  });

  it("binds the plan id recovered from the first installment when the creation response was lost", async () => {
    mocks.tx.order.findUniqueOrThrow.mockResolvedValue(planOrder({ asaasPaymentId: null, asaasInstallmentId: null }));
    await processAsaasPayment(payment({ status: "PENDING" }), plan());
    expect(mocks.tx.order.update).toHaveBeenCalledWith({ where: { id: "order_asaas_1" }, data: { asaasInstallmentId: PLAN_ID, asaasPaymentId: "pay_080225913252" } });
  });
});

describe("refund of a plan", () => {
  it("refunds the whole installment plan, not one installment", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "paid", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", asaasInstallmentId: PLAN_ID, refundRequestedAt: null });
    mocks.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.asaas.refundAsaasInstallment.mockResolvedValue(plan());
    await expect(requestAsaasRefund("order_asaas_1", { id: "admin_1", label: "ops" })).resolves.toEqual({ status: "requested" });
    expect(mocks.asaas.refundAsaasInstallment).toHaveBeenCalledWith(expect.anything(), PLAN_ID);
    expect(mocks.asaas.refundAsaasPayment).not.toHaveBeenCalled();
  });

  it("keeps the claim when the outcome is unknown", async () => {
    mocks.prisma.order.findUnique.mockResolvedValue({ id: "order_asaas_1", orderNumber: "RARE-ASAAS", status: "paid", paymentProvider: "asaas", asaasPaymentId: "pay_080225913252", asaasInstallmentId: PLAN_ID, refundRequestedAt: null });
    mocks.prisma.order.updateMany.mockResolvedValue({ count: 1 });
    mocks.asaas.refundAsaasInstallment.mockRejectedValue(new AsaasError("unknown", "AsaasDeadlineExceeded"));
    await expect(requestAsaasRefund("order_asaas_1", { id: "admin_1", label: "ops" })).resolves.toEqual({ status: "unknown" });
  });
});
