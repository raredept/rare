import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  processStripeCheckoutEvent,
  processStripePaymentIntentEvent,
} from "@/lib/checkout";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    stripeEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
  };

  const stripeSessionsCreate = vi.fn();

  return {
    tx,
    stripeSessionsCreate,
    prisma: {
      $transaction: vi.fn(),
      customer: {
        findFirst: vi.fn(),
      },
      customerAddress: {
        findMany: vi.fn(),
      },
      order: {
        update: vi.fn(),
      },
    },
    getStoreSettings: vi.fn(),
    getStripe: vi.fn(),
    normalizePaymentMethodTypes: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/settings", () => ({
  getStoreSettings: mocks.getStoreSettings,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: mocks.getStripe,
  normalizePaymentMethodTypes: mocks.normalizePaymentMethodTypes,
}));

const originalEnv = process.env;

const validCheckoutInput = {
  items: [{ productId: "prod_1", variantId: "var_1", quantity: 2 }],
  guestCustomerData: {
    name: "Cliente Teste",
    email: "cliente@example.com",
    phone: "11999999999",
  },
  guestAddress: {
    cep: "01001000",
    street: "Rua Teste",
    number: "123",
    neighborhood: "Centro",
    city: "Sao Paulo",
    state: "SP",
  },
};

const orderItem = {
  id: "item_1",
  productId: "prod_1",
  variantId: "var_1",
  productTitleSnapshot: "Camiseta RARE",
  sizeSnapshot: "M",
  quantity: 2,
  unitPriceInCents: 10000,
  totalInCents: 20000,
};

function buildOrder(status = "awaiting_payment") {
  return {
    id: "order_1",
    orderNumber: "RARE-TEST",
    status,
    customerName: "Cliente Teste",
    customerEmail: "cliente@example.com",
    customerPhone: "11999999999",
    customerNameSnapshot: "Cliente Teste",
    customerEmailSnapshot: "cliente@example.com",
    customerPhoneSnapshot: "11999999999",
    shippingAddressSnapshot: null,
    billingAddressSnapshot: null,
    stripePaymentIntentId: null,
    paymentMethod: null,
    subtotalInCents: 20000,
    shippingInCents: 1500,
    totalInCents: 21500,
    items: [orderItem],
  };
}

function seedCheckoutCreationMocks() {
  mocks.tx.order.findMany.mockResolvedValue([]);
  mocks.tx.productVariant.findMany.mockResolvedValue([
    {
      id: "var_1",
      productId: "prod_1",
      size: "M",
      active: true,
      product: {
        id: "prod_1",
        title: "Camiseta RARE",
        active: true,
        priceInCents: 10000,
        images: [{ url: "/uploads/camiseta.jpg" }],
      },
    },
  ]);
  mocks.tx.order.create.mockResolvedValue({
    ...buildOrder(),
    reservationExpiresAt: new Date("2030-01-01T00:30:00.000Z"),
  });
  mocks.tx.$executeRaw.mockResolvedValue(1);
  mocks.tx.order.findUniqueOrThrow.mockResolvedValue({
    ...buildOrder(),
    items: [
      {
        ...orderItem,
        product: {
          images: [{ url: "/uploads/camiseta.jpg" }],
        },
      },
    ],
  });
  mocks.stripeSessionsCreate.mockResolvedValue({
    id: "cs_test_123",
    url: "https://checkout.stripe.test/session",
  });
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    APP_URL: "https://staging.rare.example",
    NEXT_PUBLIC_APP_URL: "https://public.rare.example",
  };
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (callback: (transaction: typeof mocks.tx) => unknown) =>
    callback(mocks.tx),
  );
  mocks.prisma.customer.findFirst.mockResolvedValue(null);
  mocks.prisma.customerAddress.findMany.mockResolvedValue([]);
  mocks.prisma.order.update.mockResolvedValue({});
  mocks.getStoreSettings.mockResolvedValue({
    checkoutReservationMinutes: 30,
    checkoutRequiresAddress: true,
    shippingMode: "fixed",
    fixedShippingInCents: 1500,
    manualShippingInCents: 0,
    freeShippingMinInCents: null,
    freeShippingThresholdInCents: null,
  });
  mocks.getStripe.mockReturnValue({
    checkout: {
      sessions: {
        create: mocks.stripeSessionsCreate,
      },
    },
  });
  mocks.normalizePaymentMethodTypes.mockReturnValue(undefined);
  seedCheckoutCreationMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("createCheckoutSession", () => {
  it("rejects an empty cart before creating an order", async () => {
    await expect(createCheckoutSession({ ...validCheckoutInput, items: [] })).rejects.toThrow();

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a missing product with a controlled domain error", async () => {
    mocks.tx.productVariant.findMany.mockResolvedValueOnce([
      {
        id: "var_1",
        productId: "prod_other",
        size: "M",
        active: true,
        product: {
          id: "prod_other",
          title: "Outra peça",
          active: true,
          priceInCents: 10000,
          images: [],
        },
      },
    ]);

    await expect(createCheckoutSession(validCheckoutInput)).rejects.toThrow("Produto indisponível.");

    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a missing variant with a controlled domain error", async () => {
    mocks.tx.productVariant.findMany.mockResolvedValueOnce([]);

    await expect(createCheckoutSession(validCheckoutInput)).rejects.toThrow("Variação inválida.");

    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects insufficient stock before creating a Stripe session", async () => {
    mocks.tx.$executeRaw.mockResolvedValueOnce(0);

    await expect(createCheckoutSession(validCheckoutInput)).rejects.toThrow(
      "Estoque insuficiente para finalizar este carrinho.",
    );

    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("recalculates price, freight, total and URLs on the backend", async () => {
    const result = await createCheckoutSession({
      ...validCheckoutInput,
      items: [
        {
          productId: "prod_1",
          variantId: "var_1",
          quantity: 2,
          priceInCents: 1,
          totalInCents: 2,
        },
      ],
      totalInCents: 2,
    });

    expect(result).toEqual({
      url: "https://checkout.stripe.test/session",
      orderId: "order_1",
      orderNumber: "RARE-TEST",
    });
    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalInCents: 20000,
          shippingInCents: 1500,
          totalInCents: 21500,
          status: "awaiting_payment",
          items: {
            create: [
              expect.objectContaining({
                unitPriceInCents: 10000,
                totalInCents: 20000,
              }),
            ],
          },
        }),
      }),
    );
    expect(mocks.tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.stripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://staging.rare.example/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://staging.rare.example/cart?checkout=cancelado",
        line_items: expect.arrayContaining([
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              unit_amount: 10000,
            }),
          }),
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 1500,
              product_data: { name: "Frete" },
            }),
          }),
        ]),
        payment_intent_data: {
          metadata: {
            orderId: "order_1",
            orderNumber: "RARE-TEST",
          },
        },
      }),
    );
  });
});

describe("Stripe webhook reconciliation", () => {
  beforeEach(() => {
    mocks.tx.stripeEvent.findUnique.mockResolvedValue(null);
    mocks.tx.stripeEvent.create.mockResolvedValue({});
    mocks.tx.order.findFirst.mockResolvedValue(buildOrder());
    mocks.tx.order.findUnique.mockResolvedValue({ status: "awaiting_payment" });
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.inventoryMovement.create.mockResolvedValue({});
    mocks.tx.order.update.mockResolvedValue({});
  });

  it("marks checkout.session.completed as paid and consumes reserved stock once", async () => {
    const result = await processStripeCheckoutEvent("evt_checkout_completed", "checkout.session.completed", {
      id: "cs_test_123",
      payment_status: "paid",
      payment_intent: "pi_test_123",
      payment_method_types: ["card"],
      metadata: { orderId: "order_1" },
      customer_details: { email: "cliente@example.com", name: "Cliente Teste", phone: "11999999999" },
    } as never);

    expect(result).toEqual({ status: "paid", orderId: "order_1" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          stock: { decrement: 2 },
          reservedStock: { decrement: 2 },
        },
      }),
    );
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "paid",
          stripePaymentIntentId: "pi_test_123",
          paymentMethod: "card",
        }),
      }),
    );
  });

  it("releases reservations on checkout.session.expired", async () => {
    const result = await processStripeCheckoutEvent("evt_checkout_expired", "checkout.session.expired", {
      id: "cs_test_123",
      metadata: { orderId: "order_1" },
    } as never);

    expect(result).toEqual({ status: "released" });
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          reservedStock: { decrement: 2 },
        },
      }),
    );
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "canceled" },
      }),
    );
  });

  it("does not decrement stock again when payment_intent.succeeded arrives after an already paid order", async () => {
    mocks.tx.order.findFirst.mockResolvedValueOnce(buildOrder("paid"));

    const result = await processStripePaymentIntentEvent("evt_pi_succeeded", "payment_intent.succeeded", {
      id: "pi_test_123",
      status: "succeeded",
      payment_method_types: ["card"],
      metadata: { orderId: "order_1" },
    } as never);

    expect(result).toEqual({ status: "already_paid" });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
  });

  it("releases reservations on payment_intent.payment_failed", async () => {
    const result = await processStripePaymentIntentEvent("evt_pi_failed", "payment_intent.payment_failed", {
      id: "pi_test_123",
      status: "requires_payment_method",
      payment_method_types: ["card"],
      metadata: { orderId: "order_1" },
    } as never);

    expect(result).toEqual({ status: "failed" });
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripePaymentIntentId: "pi_test_123",
          paymentMethod: "card",
        }),
      }),
    );
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "failed" },
      }),
    );
  });
});
