import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutSession,
  processStripeCheckoutEvent,
  processStripePaymentIntentEvent,
  releaseExpiredReservations,
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
  shippingOptionId: "manual:PAC",
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
    shippingInCents: 1990,
    totalInCents: 21990,
    shippingQuoteSnapshot: {
      provider: "manual",
      service: "PAC",
      amountCents: 1990,
      destinationCep: "01001000",
    },
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
        weightGrams: 400,
        lengthCm: 30,
        widthCm: 24,
        heightCm: 4,
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
    SHIPPING_ENABLED: "true",
    SHIPPING_PROVIDER: "manual",
    SHIPPING_ORIGIN_CEP: "01001000",
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
    shippingMode: "manual",
    originCep: "01001000",
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
  vi.unstubAllGlobals();
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
          shippingInCents: 1990,
          shippingMethodSnapshot: "PAC — Chega em 5 a 9 dias úteis",
          shippingCepSnapshot: "01001000",
          shippingQuoteSnapshot: expect.objectContaining({
            provider: "manual",
            service: "PAC",
            amountCents: 1990,
            originCep: "01001000",
            destinationCep: "01001000",
          }),
          totalInCents: 21990,
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
        cancel_url: "https://staging.rare.example/finalizar-compra?checkout=cancelado",
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              unit_amount: 10000,
            }),
          }),
        ],
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              type: "fixed_amount",
              display_name: "PAC - cálculo manual",
              fixed_amount: {
                amount: 1990,
                currency: "brl",
              },
            }),
          }),
        ],
        shipping_address_collection: {
          allowed_countries: ["BR"],
        },
        payment_intent_data: {
          metadata: {
            orderId: "order_1",
            orderNumber: "RARE-TEST",
            shippingProvider: "manual",
            shippingService: "PAC",
            shippingAmountCents: "1990",
            shippingEstimatedDays: "Chega em 5 a 9 dias úteis",
            destinationCep: "01001000",
          },
        },
      }),
    );
  });

  it("validates fixed shipping from settings without trusting frontend freight values or origin CEP", async () => {
    process.env.SHIPPING_ORIGIN_CEP = "";
    process.env.SHIPPING_PROVIDER = "";
    mocks.getStoreSettings.mockResolvedValueOnce({
      checkoutReservationMinutes: 30,
      checkoutRequiresAddress: true,
      shippingMode: "fixed",
      originCep: null,
      fixedShippingInCents: 2500,
      manualShippingInCents: 0,
      freeShippingMinInCents: null,
      freeShippingThresholdInCents: null,
    });

    await createCheckoutSession({
      ...validCheckoutInput,
      shippingOptionId: "fixed",
      totalInCents: 1,
      selectedShippingMethod: "manual:PAC",
    });

    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalInCents: 20000,
          shippingInCents: 2500,
          shippingMethodSnapshot: "Frete fixo — Entrega combinada com valor fixo para este pedido.",
          shippingCepSnapshot: "01001000",
          shippingQuoteSnapshot: expect.objectContaining({
            provider: "fixed",
            service: "fixed",
            amountCents: 2500,
            originCep: null,
            destinationCep: "01001000",
          }),
          totalInCents: 22500,
        }),
      }),
    );
    expect(mocks.stripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              display_name: "Frete fixo",
              fixed_amount: {
                amount: 2500,
                currency: "brl",
              },
              metadata: expect.objectContaining({
                shippingProvider: "fixed",
                shippingService: "fixed",
                shippingAmountCents: "2500",
                destinationCep: "01001000",
              }),
            }),
          }),
        ],
        payment_intent_data: {
          metadata: expect.objectContaining({
            shippingProvider: "fixed",
            shippingService: "fixed",
            shippingAmountCents: "2500",
          }),
        },
      }),
    );
  });

  it("rejects checkout when automatic shipping has no selected option", async () => {
    await expect(createCheckoutSession({ ...validCheckoutInput, shippingOptionId: undefined })).rejects.toThrow(
      "Escolha uma opção de entrega para continuar.",
    );

    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects checkout when the selected shipping option is not in fresh backend quotes", async () => {
    await expect(createCheckoutSession({ ...validCheckoutInput, shippingOptionId: "manual:EXPRESS" })).rejects.toThrow(
      "Escolha uma opção de entrega válida para continuar.",
    );

    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects checkout when selected provider/service metadata does not match the backend option", async () => {
    await expect(
      createCheckoutSession({
        ...validCheckoutInput,
        shippingOptionId: "manual:PAC",
        shippingOptionProvider: "melhor_envio",
        shippingOptionService: "1",
      }),
    ).rejects.toThrow("Escolha uma opção de entrega válida para continuar.");

    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("recalculates Melhor Envio freight on the backend and ignores adulterated frontend amounts", async () => {
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    process.env.SHIPPING_ORIGIN_CEP = "";
    process.env.MELHOR_ENVIO_TOKEN = "test-token";
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify([{ id: 1, name: "PAC", custom_price: "44.90", custom_delivery_time: 5, company: { name: "Correios" } }]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createCheckoutSession({
      ...validCheckoutInput,
      shippingOptionId: "melhor_envio:1",
      shippingOptionProvider: "melhor_envio",
      shippingOptionService: "1",
      shippingAmountCents: 1,
      totalInCents: 1,
    });

    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(payload.from.postal_code).toBe("01001000");
    expect(payload.products[0]).toMatchObject({
      id: "prod_1",
      width: 24,
      height: 4,
      length: 30,
      weight: 0.4,
      insurance_value: 100,
      quantity: 2,
    });
    expect(mocks.tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalInCents: 20000,
          shippingInCents: 4490,
          shippingMethodSnapshot: "Correios PAC — Prazo estimado em até 5 dias úteis",
          shippingQuoteSnapshot: expect.objectContaining({
            provider: "melhor_envio",
            service: "1",
            label: "Correios PAC",
            amountCents: 4490,
            originCep: "01001000",
            destinationCep: "01001000",
            package: expect.objectContaining({
              usedFallback: false,
            }),
          }),
          totalInCents: 24490,
        }),
      }),
    );
    expect(mocks.stripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              display_name: "Correios PAC",
              fixed_amount: {
                amount: 4490,
                currency: "brl",
              },
              metadata: expect.objectContaining({
                shippingProvider: "melhor_envio",
                shippingService: "1",
                shippingAmountCents: "4490",
              }),
            }),
          }),
        ],
      }),
    );
  });

  it("rejects a Melhor Envio option that no longer exists in the backend quote", async () => {
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    process.env.MELHOR_ENVIO_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: 1, name: "PAC", price: "20.00", delivery_time: 5 }]), { status: 200 })),
    );

    await expect(
      createCheckoutSession({
        ...validCheckoutInput,
        shippingOptionId: "melhor_envio:9",
        shippingOptionProvider: "melhor_envio",
        shippingOptionService: "9",
      }),
    ).rejects.toThrow("Escolha uma opção de entrega válida para continuar.");

    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("blocks checkout when Melhor Envio quote fails", async () => {
    process.env.SHIPPING_PROVIDER = "melhor_envio";
    process.env.MELHOR_ENVIO_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "temporary" }), { status: 500 })));

    await expect(
      createCheckoutSession({
        ...validCheckoutInput,
        shippingOptionId: "melhor_envio:1",
        shippingOptionProvider: "melhor_envio",
        shippingOptionService: "1",
      }),
    ).rejects.toThrow("Frete indisponível no momento. Tente novamente em alguns instantes.");

    expect(mocks.tx.order.create).not.toHaveBeenCalled();
    expect(mocks.stripeSessionsCreate).not.toHaveBeenCalled();
  });
});

describe("expired reservation release job", () => {
  it("queries only expired awaiting-payment orders", async () => {
    mocks.tx.order.findMany.mockResolvedValueOnce([]);

    const count = await releaseExpiredReservations(mocks.tx as never);

    expect(count).toBe(0);
    expect(mocks.tx.order.findMany).toHaveBeenCalledWith({
      where: {
        status: "awaiting_payment",
        reservationExpiresAt: {
          lt: expect.any(Date),
        },
      },
      include: {
        items: true,
      },
    });
    expect(mocks.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("is idempotent when the release job runs more than once", async () => {
    mocks.tx.order.findMany.mockResolvedValueOnce([buildOrder()]).mockResolvedValueOnce([]);
    mocks.tx.order.findUnique.mockResolvedValue({ status: "awaiting_payment" });
    mocks.tx.productVariant.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.inventoryMovement.create.mockResolvedValue({});
    mocks.tx.order.update.mockResolvedValue({});

    const firstRun = await releaseExpiredReservations(mocks.tx as never);
    const secondRun = await releaseExpiredReservations(mocks.tx as never);

    expect(firstRun).toBe(1);
    expect(secondRun).toBe(0);
    expect(mocks.tx.productVariant.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "canceled" },
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
