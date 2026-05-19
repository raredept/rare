import type Stripe from "stripe";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCheckoutCustomerData,
  buildGuestCheckoutCustomerData,
  type CheckoutAddressSource,
  type CheckoutGuestCustomerSource,
} from "@/lib/customer-order";
import { getAppUrl } from "@/lib/env";
import { normalizePhone } from "@/lib/privacy";
import { calculateProvisionalShipping } from "@/lib/shipping";
import { getStoreSettings } from "@/lib/settings";
import { getStripe, normalizePaymentMethodTypes } from "@/lib/stripe";
import { checkoutRequestSchema } from "@/lib/validators";
import { makeOrderNumber } from "@/lib/slug";
import { releasableReservationStatuses, shouldReleaseReservationOnStatusChange } from "@/lib/order-status";

type CheckoutSessionCreateParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;
type CheckoutLineItem = NonNullable<CheckoutSessionCreateParams["line_items"]>[number];

type CheckoutItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

type CheckoutOptions = {
  customerId?: string | null;
};

type CustomerAddressForCheckout = CheckoutAddressSource & {
  id: string;
  customerId: string;
};

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

type StripeAddressDetails =
  | {
      address?: Stripe.Address | null;
      name?: string | null;
      phone?: string | null;
    }
  | null
  | undefined;

type StripeCustomerDetails =
  | {
      address?: Stripe.Address | null;
      email?: string | null;
      name?: string | null;
      phone?: string | null;
    }
  | null
  | undefined;

type PaidOrderSource = {
  customerDetails?: StripeCustomerDetails;
  shippingDetails?: StripeAddressDetails;
  paymentIntentId?: string | null;
  paymentMethod?: string | null;
  movementReason: string;
};

function toAbsoluteUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${getAppUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

function consolidateItems(items: CheckoutItem[]) {
  const byVariant = new Map<string, CheckoutItem>();
  for (const item of items) {
    const current = byVariant.get(item.variantId);
    if (current) {
      current.quantity += item.quantity;
    } else {
      byVariant.set(item.variantId, { ...item });
    }
  }
  return [...byVariant.values()];
}

function stripeAddressSnapshot(
  details?: { address?: Stripe.Address | null; name?: string | null; phone?: string | null } | null,
): Prisma.InputJsonObject | undefined {
  const address = details?.address;
  if (!address) return undefined;

  return {
    recipientName: "name" in details ? details.name ?? null : null,
    phone: "phone" in details ? details.phone ?? null : null,
    cep: address.postal_code,
    street: address.line1,
    number: null,
    complement: address.line2,
    neighborhood: null,
    city: address.city,
    state: address.state,
    country: address.country,
  };
}

function getPaymentIntentIdFromSession(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function getPaymentMethodFromIntent(paymentIntent: Stripe.PaymentIntent) {
  return paymentIntent.payment_method_types?.join(",") || null;
}

function getPaymentIntentOrderId(paymentIntent: Stripe.PaymentIntent) {
  return paymentIntent.metadata?.orderId || null;
}

async function findOrderForPaymentIntent(tx: Prisma.TransactionClient, paymentIntent: Stripe.PaymentIntent) {
  const orderId = getPaymentIntentOrderId(paymentIntent);
  return tx.order.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: paymentIntent.id },
        orderId ? { id: orderId } : undefined,
      ].filter(Boolean) as Prisma.OrderWhereInput[],
    },
    include: {
      items: true,
    },
  });
}

async function finalizePaidOrder(
  tx: Prisma.TransactionClient,
  order: OrderWithItems,
  source: PaidOrderSource,
) {
  if (["paid", "processing", "shipped", "delivered"].includes(order.status)) {
    return { status: "already_paid" as const };
  }

  for (const item of order.items) {
    if (!item.variantId) throw new Error(`Order item ${item.id} has no variant.`);

    const updated = await tx.productVariant.updateMany({
      where: {
        id: item.variantId,
        stock: { gte: item.quantity },
        reservedStock: { gte: item.quantity },
      },
      data: {
        stock: { decrement: item.quantity },
        reservedStock: { decrement: item.quantity },
      },
    });

    if (updated.count !== 1) {
      throw new Error(`Reserved stock is not available for order ${order.orderNumber}.`);
    }

    await tx.inventoryMovement.create({
      data: {
        type: "sale",
        productId: item.productId,
        variantId: item.variantId,
        orderId: order.id,
        orderItemId: item.id,
        stockDelta: -item.quantity,
        reservedDelta: -item.quantity,
        reason: source.movementReason,
      },
    });
  }

  await tx.order.update({
    where: { id: order.id },
    data: {
      status: "paid",
      customerName: source.customerDetails?.name ?? order.customerName,
      customerEmail: source.customerDetails?.email ?? order.customerEmail,
      customerPhone: source.customerDetails?.phone ?? order.customerPhone,
      customerNameSnapshot: order.customerNameSnapshot ?? source.customerDetails?.name ?? order.customerName,
      customerEmailSnapshot: order.customerEmailSnapshot ?? source.customerDetails?.email ?? order.customerEmail,
      customerPhoneSnapshot: order.customerPhoneSnapshot ?? source.customerDetails?.phone ?? order.customerPhone,
      shippingAddressSnapshot: order.shippingAddressSnapshot ?? stripeAddressSnapshot(source.shippingDetails),
      billingAddressSnapshot: order.billingAddressSnapshot ?? stripeAddressSnapshot(source.customerDetails),
      stripePaymentIntentId: source.paymentIntentId ?? order.stripePaymentIntentId,
      paymentMethod: source.paymentMethod ?? order.paymentMethod,
      paidAt: new Date(),
    },
  });

  return { status: "paid" as const, orderId: order.id };
}

export async function releaseExpiredReservations(tx: Prisma.TransactionClient = prisma) {
  const expiredOrders = await tx.order.findMany({
    where: {
      status: "awaiting_payment",
      reservationExpiresAt: {
        lt: new Date(),
      },
    },
    include: {
      items: true,
    },
  });

  for (const order of expiredOrders) {
    await releaseOrderReservation(tx, order.id, order.items, "canceled", "Reserva expirada");
  }

  return expiredOrders.length;
}

export async function updateOrderStatusWithReservationRelease(orderId: string, status: OrderStatus, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    if (shouldReleaseReservationOnStatusChange(order.status, status)) {
      await releaseOrderReservation(tx, order.id, order.items, status, reason);
      return;
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status },
    });
  });
}

async function releaseOrderReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: Array<{ id: string; productId: string | null; variantId: string | null; quantity: number }>,
  status: OrderStatus,
  reason: string,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  if (!order || !releasableReservationStatuses.includes(order.status)) {
    return;
  }

  for (const item of items) {
    if (!item.variantId) continue;

    const updated = await tx.productVariant.updateMany({
      where: {
        id: item.variantId,
        reservedStock: { gte: item.quantity },
      },
      data: {
        reservedStock: { decrement: item.quantity },
      },
    });

    if (updated.count !== 1) continue;

    await tx.inventoryMovement.create({
      data: {
        type: "release",
        productId: item.productId,
        variantId: item.variantId,
        orderId,
        orderItemId: item.id,
        reservedDelta: -item.quantity,
        reason,
      },
    });
  }

  await tx.order.update({
    where: { id: orderId },
    data: { status },
  });
}

export async function createCheckoutSession(input: unknown, options: CheckoutOptions = {}) {
  const parsed = checkoutRequestSchema.parse(input);
  const items = consolidateItems(parsed.items);

  await prisma.$transaction(async (tx) => {
    await releaseExpiredReservations(tx);
  });

  const settings = await getStoreSettings();
  const reservationMinutes = Math.max(30, settings.checkoutReservationMinutes);
  const reservationExpiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
  const checkoutCustomer = options.customerId
    ? await prisma.customer.findFirst({
        where: {
          id: options.customerId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          cpf: true,
        },
      })
    : null;
  const customerAddresses: CustomerAddressForCheckout[] = checkoutCustomer
    ? await prisma.customerAddress.findMany({
        where: { customerId: checkoutCustomer.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          customerId: true,
          label: true,
          recipientName: true,
          phone: true,
          cep: true,
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
        },
      })
    : [];
  const selectedCustomerAddress = checkoutCustomer
    ? parsed.customerAddressId
      ? customerAddresses.find((address) => address.id === parsed.customerAddressId) ?? null
      : customerAddresses[0] ?? null
    : null;

  if (checkoutCustomer && parsed.customerAddressId && !selectedCustomerAddress) {
    throw new Error("Endereço de entrega inválido.");
  }

  if (checkoutCustomer && settings.checkoutRequiresAddress && !selectedCustomerAddress) {
    throw new Error("Selecione um endereço de entrega.");
  }

  if (!checkoutCustomer && !parsed.guestCustomerData) {
    throw new Error("Informe seus dados de contato para finalizar.");
  }

  if (!checkoutCustomer && settings.checkoutRequiresAddress && !parsed.guestAddress) {
    throw new Error("Informe o endereço de entrega.");
  }

  const guestCustomerData: CheckoutGuestCustomerSource | null = parsed.guestCustomerData
    ? {
        ...parsed.guestCustomerData,
        phone: normalizePhone(parsed.guestCustomerData.phone),
      }
    : null;
  const guestAddress = parsed.guestAddress
    ? {
        ...parsed.guestAddress,
        phone: normalizePhone(parsed.guestAddress.phone),
      }
    : null;
  const selectedShippingAddress = selectedCustomerAddress ?? guestAddress;
  const checkoutCustomerData = checkoutCustomer
    ? buildCheckoutCustomerData({ ...checkoutCustomer, addresses: [] }, selectedCustomerAddress)
    : buildGuestCheckoutCustomerData(guestCustomerData!, guestAddress);

  const order = await prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: items.map((item) => item.variantId) },
      },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    });

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    const orderItems = items.map((item) => {
      const variant = variantsById.get(item.variantId);
      if (!variant) {
        throw new Error("Variação inválida.");
      }

      if (variant.productId !== item.productId || !variant.active || !variant.product.active) {
        throw new Error("Produto indisponível.");
      }

      const totalInCents = variant.product.priceInCents * item.quantity;
      return {
        productId: variant.productId,
        productTitleSnapshot: variant.product.title,
        variantId: variant.id,
        sizeSnapshot: variant.size,
        quantity: item.quantity,
        unitPriceInCents: variant.product.priceInCents,
        totalInCents,
      };
    });

    const subtotalInCents = orderItems.reduce((sum, item) => sum + item.totalInCents, 0);
    const shipping = calculateProvisionalShipping({
      subtotalInCents,
      cep: selectedShippingAddress?.cep,
      settings,
    });

    const createdOrder = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        ...checkoutCustomerData,
        subtotalInCents,
        shippingInCents: shipping.shippingInCents,
        shippingMethodSnapshot: shipping.shippingMethod,
        shippingCepSnapshot: shipping.shippingCep,
        totalInCents: subtotalInCents + shipping.shippingInCents,
        status: "awaiting_payment",
        reservationExpiresAt,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    for (const item of createdOrder.items) {
      if (!item.variantId) throw new Error("Variação inválida.");

      const updated = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
          AND "active" = true
          AND ("stock" - "reservedStock") >= ${item.quantity}
      `;

      if (updated !== 1) {
        throw new Error("Estoque insuficiente para finalizar este carrinho.");
      }

      await tx.inventoryMovement.create({
        data: {
          type: "reserve",
          productId: item.productId,
          variantId: item.variantId,
          orderId: createdOrder.id,
          orderItemId: item.id,
          reservedDelta: item.quantity,
          reason: "Reserva temporária criada no checkout",
        },
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: createdOrder.id },
      include: {
        items: {
          include: {
            product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
          },
        },
      },
    });
  });

  const paymentMethodTypes = normalizePaymentMethodTypes();
  const appUrl = getAppUrl();
  const lineItems: CheckoutLineItem[] = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: "brl",
      unit_amount: item.unitPriceInCents,
      product_data: {
        name: `${item.productTitleSnapshot} - ${item.sizeSnapshot}`,
        images: [toAbsoluteUrl(item.product?.images[0]?.url)].filter(Boolean) as string[],
      },
    },
  }));

  if (order.shippingInCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "brl",
        unit_amount: order.shippingInCents,
        product_data: {
          name: "Frete",
        },
      },
    });
  }

  try {
    const stripe = getStripe();
    const sessionParams: CheckoutSessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: `${appUrl}/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart?checkout=cancelado`,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        ...(checkoutCustomer ? { customerId: checkoutCustomer.id } : {}),
        ...(order.shippingMethodSnapshot ? { shippingMethod: order.shippingMethodSnapshot } : {}),
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...(checkoutCustomer ? { customerId: checkoutCustomer.id } : {}),
        },
      },
      expires_at: Math.floor(reservationExpiresAt.getTime() / 1000),
      phone_number_collection: {
        enabled: true,
      },
      billing_address_collection: "auto",
    };

    if (paymentMethodTypes?.length) {
      sessionParams.payment_method_types = paymentMethodTypes;
      if (paymentMethodTypes.includes("pix")) {
        sessionParams.payment_method_options = {
          pix: {
            expires_after_seconds: reservationMinutes * 60,
          },
        };
      }
    }

    const checkoutEmail = order.customerEmailSnapshot ?? order.customerEmail;
    if (checkoutEmail) {
      sessionParams.customer_email = checkoutEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeCheckoutSessionId: session.id,
      },
    });

    return {
      url: session.url,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const freshOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });
      if (freshOrder) {
        await releaseOrderReservation(tx, freshOrder.id, freshOrder.items, "failed", "Falha ao criar sessão Stripe");
      }
    });

    throw error;
  }
}

export async function processStripeCheckoutEvent(eventId: string, eventType: string, session: Stripe.Checkout.Session) {
  return prisma.$transaction(async (tx) => {
    const alreadyProcessed = await tx.stripeEvent.findUnique({ where: { id: eventId } });
    if (alreadyProcessed) {
      return { status: "already_processed" as const };
    }

    const order = await tx.order.findFirst({
      where: {
        OR: [
          { stripeCheckoutSessionId: session.id },
          session.metadata?.orderId ? { id: session.metadata.orderId } : undefined,
        ].filter(Boolean) as Prisma.OrderWhereInput[],
      },
      include: {
        items: true,
      },
    });

    await tx.stripeEvent.create({
      data: {
        id: eventId,
        type: eventType,
        orderId: order?.id,
      },
    });

    if (!order) {
      return { status: "order_not_found" as const };
    }

    if (eventType === "checkout.session.expired") {
      await releaseOrderReservation(tx, order.id, order.items, "canceled", "Checkout Stripe expirado");
      return { status: "released" as const };
    }

    if (eventType === "checkout.session.async_payment_failed") {
      await releaseOrderReservation(tx, order.id, order.items, "failed", "Pagamento assincrono falhou");
      return { status: "failed" as const };
    }

    const shouldMarkPaid =
      eventType === "checkout.session.async_payment_succeeded" ||
      (eventType === "checkout.session.completed" && session.payment_status === "paid");

    if (!shouldMarkPaid) {
      return { status: "ignored" as const };
    }

    const sessionWithShipping = session as Stripe.Checkout.Session & {
      shipping_details?: { address?: Stripe.Address | null; name?: string | null; phone?: string | null } | null;
    };

    return finalizePaidOrder(tx, order, {
      customerDetails: session.customer_details,
      shippingDetails: sessionWithShipping.shipping_details,
      paymentIntentId: getPaymentIntentIdFromSession(session),
      paymentMethod: session.payment_method_types?.join(",") ?? null,
      movementReason: "Pagamento confirmado pela Stripe",
    });
  });
}

export async function processStripePaymentIntentEvent(
  eventId: string,
  eventType: string,
  paymentIntent: Stripe.PaymentIntent,
) {
  return prisma.$transaction(async (tx) => {
    const alreadyProcessed = await tx.stripeEvent.findUnique({ where: { id: eventId } });
    if (alreadyProcessed) {
      return { status: "already_processed" as const };
    }

    const order = await findOrderForPaymentIntent(tx, paymentIntent);

    await tx.stripeEvent.create({
      data: {
        id: eventId,
        type: eventType,
        orderId: order?.id,
      },
    });

    if (!order) {
      return { status: "order_not_found" as const };
    }

    const paymentMethod = getPaymentMethodFromIntent(paymentIntent);

    if (eventType === "payment_intent.payment_failed") {
      await tx.order.update({
        where: { id: order.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          paymentMethod: paymentMethod ?? order.paymentMethod,
        },
      });
      await releaseOrderReservation(tx, order.id, order.items, "failed", "Pagamento recusado pela Stripe");
      return { status: "failed" as const };
    }

    if (eventType === "payment_intent.succeeded" && paymentIntent.status === "succeeded") {
      return finalizePaidOrder(tx, order, {
        paymentIntentId: paymentIntent.id,
        paymentMethod,
        movementReason: "Pagamento confirmado pela Stripe",
      });
    }

    return { status: "ignored" as const };
  });
}
