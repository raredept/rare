import type Stripe from "stripe";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCheckoutCustomerData, type CheckoutAddressSource } from "@/lib/customer-order";
import { isValidCpf } from "@/lib/cpf";
import { getAppUrl } from "@/lib/env";
import {
  buildPackageFromCart,
  buildShippingQuoteSnapshot,
  calculateProvisionalShipping,
  findShippingOption,
  formatShippingLabel,
  getConfiguredShippingOriginCep,
  getConfiguredShippingProvider,
  getEffectiveFreeShippingThresholdInCents,
  getFixedShippingQuotes,
  getShippingQuotes,
  isFixedShippingModeActive,
  isShippingEnabled,
  type ShippingOption,
} from "@/lib/shipping";
import { getStoreSettings } from "@/lib/settings";
import { getStripe, normalizePaymentMethodTypes } from "@/lib/stripe";
import { checkoutRequestSchema } from "@/lib/validators";
import { makeOrderNumber } from "@/lib/slug";
import { canTransitionManually, invalidOrderTransitionMessage, releasableReservationStatuses, shouldReleaseReservationOnStatusChange } from "@/lib/order-status";
import { notifyAdminsOfPaidOrder } from "@/lib/admin-notifications";
import { getFirstOrderCouponDiscount, paidOrderStatuses } from "@/lib/coupons";
import { priceProduct } from "@/lib/promotions/engine";
import { loadApplicablePromotionRules } from "@/lib/promotions/store";
import { enqueueOrderShippedEmail, enqueuePaidOrderEmail } from "@/lib/email-outbox";
import { ASAAS_RESERVATION_MINUTES, CHECKOUT_RESERVATION_MINUTES, PIX_PROVIDER_EXPIRY_GRACE_SECONDS, PIX_RESERVATION_MINUTES, STRIPE_SESSION_FALLBACK_SECONDS } from "@/lib/checkout-policy";
import { createPixPayment, getMercadoPagoConfig, isPixCheckoutAvailable, MercadoPagoError, type MercadoPagoConfig, type MercadoPagoPayment } from "@/lib/mercadopago";
import {
  AsaasError,
  createAsaasCustomer,
  createAsaasPayment,
  findAsaasCustomerByReference,
  getAsaasConfig,
  getAsaasPixQrCode,
  refundAsaasPayment,
  type AsaasConfig,
  type AsaasPayment,
} from "@/lib/asaas";
import { getAsaasConfigurationIssue, getAsaasPaymentMethods, isAsaasSuccessRedirectEnabled } from "@/lib/asaas-config";
import { getPaymentProvider, type CheckoutMethod } from "@/lib/payment-provider-config";
import { recordAdminAudit, type AdminAuditActor } from "@/lib/admin-audit";

type CheckoutSessionCreateParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;
type CheckoutLineItem = NonNullable<CheckoutSessionCreateParams["line_items"]>[number];
type CheckoutShippingOption = NonNullable<CheckoutSessionCreateParams["shipping_options"]>[number];

type CheckoutItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

type CheckoutOptions = {
  customerId?: string | null;
};

export const checkoutRequiresLoginMessage = "Para finalizar sua compra, entre ou crie sua conta.";
export const checkoutRequiresCpfMessage = "Precisamos de um CPF válido para finalizar sua compra.";
export const checkoutInProgressMessage = "Você já tem um checkout em andamento. Aguarde alguns instantes e tente novamente.";
export const paymentInProgressMessage = "Você já tem um pagamento em andamento. Aguarde a confirmação antes de iniciar outra compra.";
export const pixUnavailableMessage = "O Pix está indisponível no momento. Escolha cartão ou tente novamente em instantes.";
export const cardUnavailableMessage = "O pagamento com cartão está indisponível no momento. Escolha Pix ou tente novamente em instantes.";
export const paymentUnavailableMessage = "Pagamentos temporariamente indisponíveis. Tente novamente em alguns minutos.";

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
  amountInCents: number | null;
  currency: string | null;
  customerDetails?: StripeCustomerDetails;
  shippingDetails?: StripeAddressDetails;
  paymentIntentId?: string | null;
  paymentMethod?: string | null;
  movementReason: string;
  provider?: "Stripe" | "Mercado Pago" | "Asaas";
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
  return [...byVariant.values()].sort((a, b) => a.variantId.localeCompare(b.variantId));
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

function getShippingMetadata(option: ShippingOption | null): Record<string, string> {
  if (!option) return {};

  return {
    shippingProvider: option.provider,
    shippingService: option.service,
    shippingAmountCents: String(option.amountCents),
    shippingEstimatedDays: option.deliveryEstimateText,
    destinationCep: option.destinationCep,
  };
}

function buildStripeDeliveryEstimate(option: ShippingOption) {
  if (!option.estimatedDaysMin && !option.estimatedDaysMax) return undefined;

  return {
    ...(option.estimatedDaysMin
      ? {
          minimum: {
            unit: "business_day" as const,
            value: option.estimatedDaysMin,
          },
        }
      : {}),
    ...(option.estimatedDaysMax
      ? {
          maximum: {
            unit: "business_day" as const,
            value: option.estimatedDaysMax,
          },
        }
      : {}),
  };
}

function buildStripeShippingOption(option: ShippingOption): CheckoutShippingOption {
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: option.label,
      fixed_amount: {
        amount: option.amountCents,
        currency: "brl",
      },
      delivery_estimate: buildStripeDeliveryEstimate(option),
      metadata: getShippingMetadata(option),
    },
  };
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

// The order row serializes every payment/release transition, including different
// Stripe event IDs for the same purchase. Variant counters alone cannot do this.
async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
}

async function notifyPaidOrderIfNeeded(result: { status: string; orderId?: string }) {
  if (result.status !== "paid" || !result.orderId) return;

  try {
    await notifyAdminsOfPaidOrder(result.orderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown admin notification error.";
    console.error("[admin-notifications] paid order notification failed", {
      orderId: result.orderId,
      message: message.replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]"),
    });
  }
}

async function finalizePaidOrder(
  tx: Prisma.TransactionClient,
  order: OrderWithItems,
  source: PaidOrderSource,
) {
  if (source.currency !== "brl" || source.amountInCents !== order.totalInCents) {
    throw new Error(`${source.provider ?? "Stripe"} payment total does not match order ${order.orderNumber}.`);
  }
  if (order.stripePaymentIntentId && source.paymentIntentId !== order.stripePaymentIntentId) {
    throw new Error(`Stripe PaymentIntent does not match order ${order.orderNumber}.`);
  }
  if (["paid", "processing", "shipped", "delivered"].includes(order.status)) {
    return { status: "already_paid" as const };
  }
  if (order.status === "refunded") {
    return { status: "already_refunded" as const };
  }

  const hasReservation = releasableReservationStatuses.includes(order.status);

  for (const item of [...order.items].sort((a, b) => (a.variantId ?? "").localeCompare(b.variantId ?? ""))) {
    if (!item.variantId) throw new Error(`Order item ${item.id} has no variant.`);

    const updated = hasReservation ? await tx.productVariant.updateMany({
      where: {
        id: item.variantId,
        stock: { gte: item.quantity },
        reservedStock: { gte: item.quantity },
      },
      data: {
        stock: { decrement: item.quantity },
        reservedStock: { decrement: item.quantity },
      },
    }) : { count: await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${item.quantity}, "updatedAt" = NOW()
      WHERE "id" = ${item.variantId}
        AND ("stock" - "reservedStock") >= ${item.quantity}
    ` };

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
        reservedDelta: hasReservation ? -item.quantity : 0,
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

  await enqueuePaidOrderEmail(tx, {
    id: order.id,
    orderNumber: order.orderNumber,
    totalInCents: order.totalInCents,
    customerEmailSnapshot: order.customerEmailSnapshot ?? source.customerDetails?.email ?? order.customerEmail,
    customerNameSnapshot: order.customerNameSnapshot ?? source.customerDetails?.name ?? order.customerName,
  });

  return { status: "paid" as const, orderId: order.id };
}

export async function releaseExpiredReservations(): Promise<number> {
  // Compatibility entry point for the authenticated maintenance endpoint.
  // Provider requests must run OUTSIDE a transaction holding inventory locks.
  const { runCheckoutExpiryBatch } = await import("@/lib/checkout-expiry");
  return (await runCheckoutExpiryBatch()).released;
}

export async function updateOrderStatusWithReservationRelease(orderId: string, status: OrderStatus, reason: string) {
  const before = await prisma.order.findUnique({ where: { id: orderId } });
  if (!before) throw new Error("Pedido não encontrado.");
  if (!canTransitionManually(before.status, status)) throw new Error(invalidOrderTransitionMessage);
  const needsProviderConfirmation = before && shouldReleaseReservationOnStatusChange(before.status, status)
    && Boolean(before.stripeCheckoutSessionId || before.checkoutDeadlineAt);
  if (needsProviderConfirmation) {
    const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
    const result = await reconcileCheckoutExpiry(orderId);
    if (result.outcome === "paid" || result.outcome === "processing") {
      throw new Error("Pagamento confirmado ou em processamento. Aguarde a conciliação antes de alterar este pedido.");
    }
  }
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);

    if (!order) {
      throw new Error("Pedido não encontrado.");
    }

    // Re-check under the row lock: a webhook may have moved the order meanwhile.
    if (!canTransitionManually(order.status, status)) {
      throw new Error(invalidOrderTransitionMessage);
    }

    if (needsProviderConfirmation && (releasableReservationStatuses.includes(order.status) || (paidOrderStatuses as readonly string[]).includes(order.status))) {
      throw new Error("Não foi possível confirmar o encerramento seguro deste pagamento.");
    }

    if (shouldReleaseReservationOnStatusChange(order.status, status)) {
      await releaseOrderReservation(tx, order.id, order.items, status, reason);
      return;
    }

    await tx.order.update({
      where: { id: order.id },
      data: { status },
    });

    if (status === "shipped") {
      await enqueueOrderShippedEmail(tx, {
        id: order.id,
        orderNumber: order.orderNumber,
        totalInCents: order.totalInCents,
        customerEmailSnapshot: order.customerEmailSnapshot ?? order.customerEmail,
        customerNameSnapshot: order.customerNameSnapshot ?? order.customerName,
      });
    }
  });
}

async function releaseOrderReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: Array<{ id: string; productId: string | null; variantId: string | null; quantity: number }>,
  status: OrderStatus,
  reason: string,
  expiredBefore?: Date,
) {
  const order = await lockOrder(tx, orderId);

  if (!order || !releasableReservationStatuses.includes(order.status)) {
    return false;
  }
  if (expiredBefore && (!order.reservationExpiresAt || order.reservationExpiresAt >= expiredBefore)) return false;

  for (const item of [...items].sort((a, b) => (a.variantId ?? "").localeCompare(b.variantId ?? ""))) {
    if (!item.variantId) throw new Error(`Order item ${item.id} has no variant.`);

    const updated = await tx.productVariant.updateMany({
      where: {
        id: item.variantId,
        reservedStock: { gte: item.quantity },
      },
      data: {
        reservedStock: { decrement: item.quantity },
      },
    });

    if (updated.count !== 1) throw new Error(`Reserved stock is not available for order ${order.orderNumber}.`);

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
  return true;
}

/**
 * One unpaid checkout per customer. Starting a new one closes the previous unpaid session
 * at Stripe and releases its reservation, so retries, double clicks and abandoned attempts
 * cannot pile up reserved stock. A payment already captured or still processing is never
 * closed: the customer is told to wait instead. Ambiguous provider states keep the hold.
 */
export async function supersedeOpenCheckouts(customerId: string, now = new Date()) {
  const open = await prisma.order.findMany({
    where: { customerId, status: "awaiting_payment", reservationExpiresAt: { not: null } },
    select: { id: true, createdAt: true, stripeCheckoutSessionId: true, mercadoPagoPaymentId: true, asaasPaymentId: true },
    take: 10,
  });
  if (!open.length) return;

  const { reconcileCheckoutExpiry } = await import("@/lib/checkout-expiry");
  for (const order of open) {
    // Creation may still be in flight (the provider call happens after the order is stored).
    if (!order.stripeCheckoutSessionId && !order.mercadoPagoPaymentId && !order.asaasPaymentId && now.getTime() - order.createdAt.getTime() < 120_000) {
      throw new Error(checkoutInProgressMessage);
    }
    let outcome: string;
    try {
      outcome = (await reconcileCheckoutExpiry(order.id)).outcome;
    } catch {
      throw new Error(checkoutInProgressMessage);
    }
    if (outcome === "paid" || outcome === "processing") throw new Error(paymentInProgressMessage);
  }
}

export async function createCheckoutSession(input: unknown, options: CheckoutOptions = {}) {
  if (!options.customerId) {
    throw new Error(checkoutRequiresLoginMessage);
  }

  const parsed = checkoutRequestSchema.parse(input);
  // Validate configuration before reserving stock. The gateway for NEW payments comes from
  // PAYMENT_PROVIDER; nothing in the request chooses it.
  const provider = getPaymentProvider();
  if (provider === "disabled") throw new Error(paymentUnavailableMessage);
  const method: CheckoutMethod = parsed.paymentMethod === "pix" ? "pix" : "card";
  const asaasConfig = provider === "asaas" ? requireAsaasCheckout(method) : null;
  const pixConfig = !asaasConfig && method === "pix" ? requirePixCheckout() : null;
  const paymentMethodTypes = asaasConfig || pixConfig ? null : normalizePaymentMethodTypes();
  const appUrl = getAppUrl();
  const items = consolidateItems(parsed.items);
  let stripeShippingOption: ShippingOption | null = null;

  const settings = await getStoreSettings();
  const reservationMinutes = asaasConfig ? ASAAS_RESERVATION_MINUTES : pixConfig ? PIX_RESERVATION_MINUTES : CHECKOUT_RESERVATION_MINUTES;
  const reservationExpiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
  const checkoutCustomer = await prisma.customer.findFirst({
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
  });

  if (!checkoutCustomer) {
    throw new Error(checkoutRequiresLoginMessage);
  }

  if (!isValidCpf(checkoutCustomer.cpf)) {
    throw new Error(checkoutRequiresCpfMessage);
  }

  await supersedeOpenCheckouts(checkoutCustomer.id);
  // Network call BEFORE any stock is reserved: a provider failure here holds nothing.
  const asaasCustomerId = asaasConfig
    ? await ensureAsaasCustomer(asaasConfig, { ...checkoutCustomer, cpf: checkoutCustomer.cpf as string })
    : null;

  const paidOrderCount = parsed.couponCode
    ? await prisma.order.count({
        where: {
          customerId: checkoutCustomer.id,
          status: { in: [...paidOrderStatuses] },
        },
      })
    : 0;

  const customerAddresses: CustomerAddressForCheckout[] = await prisma.customerAddress.findMany({
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
  });
  const selectedCustomerAddress = parsed.customerAddressId
    ? customerAddresses.find((address) => address.id === parsed.customerAddressId) ?? null
    : customerAddresses[0] ?? null;

  if (parsed.customerAddressId && !selectedCustomerAddress) {
    throw new Error("Endereço de entrega inválido.");
  }

  if (settings.checkoutRequiresAddress && !selectedCustomerAddress) {
    throw new Error("Selecione um endereço de entrega.");
  }

  const selectedShippingAddress = selectedCustomerAddress;
  const checkoutCustomerData = buildCheckoutCustomerData({ ...checkoutCustomer, addresses: [] }, selectedCustomerAddress);

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
    // Prices come only from the catalog and the promotions active at this instant, read inside
    // the same transaction. Nothing price-related in the request body is used.
    const pricingNow = new Date();
    const promotionRules = await loadApplicablePromotionRules(tx, pricingNow);
    const orderItems = items.map((item) => {
      const variant = variantsById.get(item.variantId);
      if (!variant) {
        throw new Error("Variação inválida.");
      }

      if (variant.productId !== item.productId || !variant.active || !variant.product.active) {
        throw new Error("Produto indisponível.");
      }

      const price = priceProduct(promotionRules, variant.product, pricingNow);
      const totalInCents = price.finalPriceInCents * item.quantity;
      return {
        productId: variant.productId,
        productTitleSnapshot: variant.product.title,
        variantId: variant.id,
        sizeSnapshot: variant.size,
        quantity: item.quantity,
        unitPriceInCents: price.finalPriceInCents,
        totalInCents,
        // Self-contained audit trail: the order stays readable if the promotion changes later.
        basePriceInCents: price.basePriceInCents,
        promotionId: price.promotion?.id ?? null,
        promotionName: price.promotion?.name ?? null,
        promotionCode: price.promotion?.slug ?? null,
        promotionDiscountInCents: price.discountInCents,
      };
    });

    const subtotalInCents = orderItems.reduce((sum, item) => sum + item.totalInCents, 0);
    const promotionDiscountInCents = orderItems.reduce((sum, item) => sum + item.promotionDiscountInCents * item.quantity, 0);
    // Stacking policy: the first-order coupon applies only to items WITHOUT an automatic
    // promotion. With nothing eligible, the coupon is simply not applied (not an error).
    const couponEligibleSubtotalInCents = orderItems.filter((item) => !item.promotionId).reduce((sum, item) => sum + item.totalInCents, 0);
    // The code is still validated (invalid / not first purchase -> error) even when nothing is eligible.
    const requestedCoupon = getFirstOrderCouponDiscount({
      code: parsed.couponCode,
      subtotalInCents: couponEligibleSubtotalInCents,
      paidOrderCount,
    });
    const coupon = couponEligibleSubtotalInCents > 0 ? requestedCoupon : { code: null, discountInCents: 0 };
    const quoteEnabled = isShippingEnabled(settings);
    const shipping = quoteEnabled
      ? await (async () => {
          if (!parsed.shippingOptionId) {
            throw new Error("Escolha uma opção de entrega para continuar.");
          }

          const destinationCep = selectedShippingAddress?.cep ?? parsed.shippingDestinationCep;
          const pkg = buildPackageFromCart(
            items.map((item) => {
              const variant = variantsById.get(item.variantId);
              if (!variant) {
                throw new Error("Variação inválida.");
              }
              return {
                productId: variant.productId,
                title: variant.product.title,
                quantity: item.quantity,
                weightGrams: variant.product.weightGrams,
                lengthCm: variant.product.lengthCm,
                widthCm: variant.product.widthCm,
                heightCm: variant.product.heightCm,
                priceInCents: orderItems.find((orderItem) => orderItem.variantId === variant.id)?.unitPriceInCents ?? variant.product.priceInCents,
              };
            }),
          );
          const quotes =
            isFixedShippingModeActive(settings)
              ? getFixedShippingQuotes({
                  settings,
                  destinationCep: destinationCep ?? "",
                  package: pkg,
                  subtotalInCents,
                })
              : await (async () => {
                  const provider = getConfiguredShippingProvider(settings);
                  const originCep = getConfiguredShippingOriginCep(settings);
                  return getShippingQuotes({
                    provider,
                    originCep,
                    destinationCep: destinationCep ?? "",
                    package: pkg,
                    subtotalInCents,
                    freeShippingThresholdInCents: getEffectiveFreeShippingThresholdInCents(settings),
                  });
                })();
          const selectedOption = findShippingOption(quotes.options, parsed.shippingOptionId);
          if (!selectedOption) {
            throw new Error("Escolha uma opção de entrega válida para continuar.");
          }
          if (
            (parsed.shippingOptionProvider && parsed.shippingOptionProvider !== selectedOption.provider) ||
            (parsed.shippingOptionService && parsed.shippingOptionService !== selectedOption.service)
          ) {
            throw new Error("Escolha uma opção de entrega válida para continuar.");
          }

          stripeShippingOption = selectedOption;
          return {
            shippingInCents: selectedOption.amountCents,
            shippingMethod: formatShippingLabel(selectedOption),
            shippingCep: selectedOption.destinationCep,
            shippingQuoteSnapshot: buildShippingQuoteSnapshot(selectedOption, pkg),
          };
        })()
      : {
          ...calculateProvisionalShipping({
            subtotalInCents,
            cep: selectedShippingAddress?.cep,
            settings,
          }),
          shippingQuoteSnapshot: undefined,
        };

    const createdOrder = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        ...checkoutCustomerData,
        subtotalInCents,
        couponCode: coupon.code,
        discountInCents: coupon.discountInCents,
        promotionDiscountInCents,
        shippingInCents: shipping.shippingInCents,
        shippingMethodSnapshot: shipping.shippingMethod,
        shippingCepSnapshot: shipping.shippingCep,
        shippingQuoteSnapshot: shipping.shippingQuoteSnapshot as Prisma.InputJsonObject | undefined,
        totalInCents: subtotalInCents - coupon.discountInCents + shipping.shippingInCents,
        status: "awaiting_payment",
        ...(asaasConfig
          ? { paymentProvider: "asaas" as const, paymentMethod: method }
          : pixConfig ? { paymentProvider: "mercadopago" as const, paymentMethod: "pix" } : {}),
        reservationExpiresAt,
        checkoutDeadlineAt: reservationExpiresAt,
        checkoutExpiryJob: { create: { deadlineAt: reservationExpiresAt, nextAttemptAt: reservationExpiresAt } },
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
  }, { timeout: 45_000 });

  if (asaasConfig && asaasCustomerId) {
    return createAsaasCharge(asaasConfig, order, asaasCustomerId, method, reservationExpiresAt, appUrl);
  }
  if (pixConfig) {
    return createPixCharge(pixConfig, order, { ...checkoutCustomer, cpf: checkoutCustomer.cpf as string }, reservationExpiresAt, appUrl);
  }

  const orderDiscountInCents = order.discountInCents ?? 0;
  const lineItems: CheckoutLineItem[] =
    orderDiscountInCents <= 0
      ? order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "brl",
            unit_amount: item.unitPriceInCents,
            product_data: {
              name: `${item.productTitleSnapshot} - ${item.sizeSnapshot}`,
              images: [toAbsoluteUrl(item.product?.images[0]?.url)].filter(Boolean) as string[],
            },
          },
        }))
      : (() => {
          let remainingDiscountInCents = orderDiscountInCents;
          return order.items.map((item, index) => {
            const itemDiscountInCents =
              index === order.items.length - 1
                ? remainingDiscountInCents
                : Math.min(
                    remainingDiscountInCents,
                    Math.floor((orderDiscountInCents * item.totalInCents) / order.subtotalInCents),
                  );
            remainingDiscountInCents -= itemDiscountInCents;

            return {
              quantity: 1,
              price_data: {
                currency: "brl",
                unit_amount: item.totalInCents - itemDiscountInCents,
                product_data: {
                  name: `${item.productTitleSnapshot} - ${item.sizeSnapshot}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`,
                  images: [toAbsoluteUrl(item.product?.images[0]?.url)].filter(Boolean) as string[],
                },
              },
            };
          });
        })();

  // Charge legacy fixed shipping even when quote retrieval is disabled.
  if (!stripeShippingOption && order.shippingInCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "brl",
        unit_amount: order.shippingInCents,
        product_data: { name: order.shippingMethodSnapshot ?? "Frete" },
      },
    });
  }

  let stripeSessionCreated = false;
  try {
    const stripe = getStripe();
    const shippingMetadata = getShippingMetadata(stripeShippingOption);
    const sessionParams: CheckoutSessionCreateParams = {
      mode: "payment",
      line_items: lineItems,
      success_url: `${appUrl}/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/finalizar-compra?checkout=cancelado&pedido=${encodeURIComponent(order.id)}`,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutDeadlineAt: reservationExpiresAt.toISOString(),
        ...(checkoutCustomer ? { customerId: checkoutCustomer.id } : {}),
        ...(order.shippingMethodSnapshot ? { shippingMethod: order.shippingMethodSnapshot } : {}),
        ...shippingMetadata,
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...(checkoutCustomer ? { customerId: checkoutCustomer.id } : {}),
          ...shippingMetadata,
        },
      },
      expires_at: Math.ceil(Date.now() / 1000) + STRIPE_SESSION_FALLBACK_SECONDS,
      custom_text: { submit: { message: "Finalize em até 15 minutos após iniciar a compra na RARE. A reserva termina no prazo informado pela loja; um pagamento já em processamento aguarda confirmação." } },
      // The delivery address and phone were chosen and validated in the store (and are
      // stored on the order); asking again at Stripe would let a different address be typed
      // that we never ship to. Collect only what is missing.
      phone_number_collection: {
        enabled: !(order.customerPhoneSnapshot ?? order.customerPhone),
      },
      billing_address_collection: "auto",
    };

    if (stripeShippingOption) {
      sessionParams.shipping_options = [buildStripeShippingOption(stripeShippingOption)];
      if (!selectedShippingAddress) {
        sessionParams.shipping_address_collection = {
          allowed_countries: ["BR"],
        };
      }
    }

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

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `rare-checkout-session:${order.id}`,
    });
    stripeSessionCreated = true;

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
      checkoutDeadlineAt: reservationExpiresAt.toISOString(),
    };
  } catch (error) {
    const stripeErrorType = typeof error === "object" && error && "type" in error ? error.type : null;
    // A lost response can still mean a payable session exists at Stripe. Keep
    // its reservation for webhook reconciliation/expiry instead of freeing it.
    if (stripeSessionCreated || stripeErrorType === "StripeConnectionError" || stripeErrorType === "StripeAPIError") {
      throw error;
    }
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

function requireAsaasCheckout(method: CheckoutMethod): AsaasConfig {
  if (getAsaasConfigurationIssue()) throw new Error(paymentUnavailableMessage);
  if (!getAsaasPaymentMethods().includes(method)) throw new Error(method === "pix" ? pixUnavailableMessage : cardUnavailableMessage);
  return getAsaasConfig();
}

/**
 * The Asaas customer of this shopper: the stored id, else one found by our customer id (a previous
 * creation whose response was lost), else a new one. Never an id sent by the browser, and never a
 * second customer per checkout attempt.
 */
async function ensureAsaasCustomer(config: AsaasConfig, customer: { id: string; name: string; email: string; cpf: string }) {
  const stored = await prisma.customer.findUnique({ where: { id: customer.id }, select: { asaasCustomerId: true } });
  if (stored?.asaasCustomerId) return stored.asaasCustomerId;
  const asaasCustomerId = (await findAsaasCustomerByReference(config, customer.id))
    ?? (await createAsaasCustomer(config, { reference: customer.id, name: customer.name, cpf: customer.cpf, email: customer.email }));
  await prisma.customer.updateMany({ where: { id: customer.id, asaasCustomerId: null }, data: { asaasCustomerId } });
  return asaasCustomerId;
}

/**
 * Second half of an Asaas checkout: the order and its reservation exist, priced by the server.
 * Creates the charge for exactly that total. Pix is paid on the store's own page (QR + copy and
 * paste); card on Asaas's hosted invoice, so no card number ever reaches the store.
 */
async function createAsaasCharge(
  config: AsaasConfig,
  order: { id: string; orderNumber: string; totalInCents: number },
  customerId: string,
  method: CheckoutMethod,
  reservationExpiresAt: Date,
  appUrl: string,
) {
  let paymentId: string | null = null;
  try {
    const payment = await createAsaasPayment(config, {
      customerId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalInCents: order.totalInCents,
      method,
      dueDate: reservationExpiresAt,
      successUrl: isAsaasSuccessRedirectEnabled() ? `${appUrl}/pedido/sucesso?pedido=${encodeURIComponent(order.id)}` : undefined,
    });
    paymentId = payment.id;
    // Store the id before anything else can fail, so the worker can always find and close it.
    await prisma.order.update({ where: { id: order.id }, data: { asaasPaymentId: payment.id, paymentUrl: method === "card" ? payment.invoiceUrl : null } });
    // Never show a charge for anything other than this order's total and method.
    if (
      payment.externalReference !== order.id ||
      payment.amountInCents !== order.totalInCents ||
      payment.customerId !== customerId ||
      payment.billingType !== (method === "pix" ? "PIX" : "CREDIT_CARD")
    ) {
      throw new AsaasError("unknown", "AsaasChargeMismatch");
    }
    if (method === "pix") {
      const pix = await getAsaasPixQrCode(config, payment.id);
      await prisma.pixCharge.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, copyPaste: pix.copyPaste, qrCodeBase64: pix.qrCodeBase64, ticketUrl: payment.invoiceUrl },
        update: { copyPaste: pix.copyPaste, qrCodeBase64: pix.qrCodeBase64, ticketUrl: payment.invoiceUrl },
      });
      return { url: `/pedido/pix/${order.id}`, orderId: order.id, orderNumber: order.orderNumber, checkoutDeadlineAt: reservationExpiresAt.toISOString() };
    }
    if (!payment.invoiceUrl) throw new AsaasError("unknown", "AsaasInvoiceUrlMissing");
    return { url: payment.invoiceUrl, orderId: order.id, orderNumber: order.orderNumber, checkoutDeadlineAt: reservationExpiresAt.toISOString() };
  } catch (error) {
    // Only a refusal before any charge exists frees the stock now. Anything else may have left a
    // payable charge behind: the reservation stays and the worker closes the charge at Asaas first.
    if (!paymentId && error instanceof AsaasError && error.outcome === "rejected") {
      await prisma.$transaction(async (tx) => {
        const freshOrder = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
        if (freshOrder) await releaseOrderReservation(tx, freshOrder.id, freshOrder.items, "failed", "Falha ao criar a cobrança no Asaas");
      });
    }
    throw error;
  }
}

export type AsaasPaymentOutcome = "paid" | "pending" | "processing" | "closed" | "refunded" | "refund_pending" | "chargeback" | "unknown";

/** Maps Asaas payment states to what the store does. Asaas states are never stored as order states. */
export function classifyAsaasPayment(payment: Pick<AsaasPayment, "status" | "deleted">): AsaasPaymentOutcome {
  if (payment.deleted) return "closed";
  switch (payment.status) {
    case "CONFIRMED": // card authorized / Pix confirmed (may still be RECEIVED or REFUNDED later)
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "PENDING":
    case "OVERDUE":
    case "DUNNING_REQUESTED":
    case "DUNNING_RECEIVED":
      return "pending";
    case "AWAITING_RISK_ANALYSIS":
    case "AUTHORIZED":
      return "processing";
    case "REFUNDED":
      return "refunded";
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
      return "refund_pending";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "chargeback";
    default:
      return "unknown";
  }
}

async function flagOrderIncident(tx: Prisma.TransactionClient, order: { id: string; orderNumber: string }, kind: string, title: string, body: string) {
  await tx.adminNotification.createMany({
    data: [{ type: `payment_${kind}`, title, body, href: `/admin/orders/${order.id}`, orderId: order.id, dedupeKey: `asaas:${kind}:${order.id}` }],
    skipDuplicates: true,
  });
}

/**
 * Applies the AUTHORITATIVE state of an Asaas charge (always read from the API, never taken from a
 * webhook body) to its order. Idempotent and order-independent: the order row lock serializes
 * concurrent deliveries, a paid order is never paid twice, and a state never moves backwards
 * (paid -> pending, refunded -> paid are impossible).
 */
export async function processAsaasPayment(payment: AsaasPayment) {
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.order.findFirst({
      where: { OR: [{ asaasPaymentId: payment.id }, ...(payment.externalReference ? [{ id: payment.externalReference }] : [])] },
      select: { id: true },
    });
    if (!candidate) return { status: "order_not_found" as const };

    const order = await lockOrder(tx, candidate.id);
    if (order.paymentProvider !== "asaas" || payment.externalReference !== order.id || (order.asaasPaymentId && order.asaasPaymentId !== payment.id)) {
      await flagOrderIncident(tx, order, "mismatch", `Cobrança Asaas não confere: ${order.orderNumber}`, "Uma cobrança Asaas apontou para este pedido mas não corresponde ao pedido. Nada foi alterado. Verifique no painel do Asaas.");
      return { status: "payment_mismatch" as const };
    }
    if (!order.asaasPaymentId) await tx.order.update({ where: { id: order.id }, data: { asaasPaymentId: payment.id } });

    const outcome = classifyAsaasPayment(payment);
    if (outcome === "paid") {
      const expectedBillingType = order.paymentMethod === "pix" ? "PIX" : "CREDIT_CARD";
      if (payment.amountInCents !== order.totalInCents || (payment.billingType && payment.billingType !== expectedBillingType && payment.status !== "RECEIVED_IN_CASH")) {
        // Never mark paid on a divergent value: record the incident and keep the order as it is.
        await flagOrderIncident(tx, order, "mismatch", `Pagamento divergente: ${order.orderNumber}`, "O Asaas confirmou um pagamento com valor ou forma diferente do pedido. O pedido NÃO foi marcado como pago.");
        return { status: "payment_mismatch" as const };
      }
      const paid = await finalizePaidOrder(tx, order, {
        amountInCents: payment.amountInCents,
        currency: "brl",
        paymentMethod: order.paymentMethod,
        movementReason: "Pagamento confirmado pelo Asaas",
        provider: "Asaas",
      });
      // Asaas: a Pix in CONFIRMED (not RECEIVED) is under a precautionary hold of up to 72h and
      // may still end REFUNDED. The stock stays committed, but nobody should ship it yet.
      if (payment.billingType === "PIX" && payment.status === "CONFIRMED") {
        await flagOrderIncident(tx, order, "pix_held", `Pix em análise: ${order.orderNumber}`, "O Asaas confirmou o Pix, mas o valor ainda está em bloqueio cautelar (até 72h). Não envie o pedido até o status mudar para recebido.");
      }
      return paid;
    }

    if (outcome === "closed") {
      const released = await releaseOrderReservation(tx, order.id, order.items, "canceled", "Cobrança Asaas encerrada sem pagamento");
      if (released) await tx.order.update({ where: { id: order.id }, data: { checkoutExpiredAt: new Date() } });
      return { status: released ? "released" as const : "ignored" as const };
    }

    if (outcome === "refunded") {
      if ((paidOrderStatuses as readonly string[]).includes(order.status)) {
        // Stock is not put back automatically: a refunded item may not have returned. The Admin
        // adjusts stock when (and if) the piece comes back.
        await tx.order.update({ where: { id: order.id }, data: { status: "refunded" } });
        await flagOrderIncident(tx, order, "refunded", `Pedido estornado: ${order.orderNumber}`, "O Asaas confirmou o estorno. Se a peça voltar ao estoque, ajuste o estoque manualmente.");
        return { status: "refunded" as const };
      }
      const released = await releaseOrderReservation(tx, order.id, order.items, "canceled", "Pagamento Asaas estornado antes da confirmação");
      return { status: released ? "released" as const : "ignored" as const };
    }

    if (outcome === "chargeback") {
      await flagOrderIncident(tx, order, "chargeback", `Chargeback aberto: ${order.orderNumber}`, "O comprador contestou o pagamento no cartão. Acompanhe a disputa no painel do Asaas antes de enviar.");
      return { status: "chargeback" as const };
    }

    if (outcome === "processing" && releasableReservationStatuses.includes(order.status)) {
      // Risk analysis / authorization in progress: keep the stock until a final state arrives.
      await tx.order.update({ where: { id: order.id }, data: { reservationExpiresAt: null } });
      return { status: "processing" as const };
    }

    return { status: "ignored" as const };
  });

  await notifyPaidOrderIfNeeded(result);
  return result;
}

/** Frees the stock of an Asaas order for which no charge exists at Asaas. */
export async function releaseAsaasOrderWithoutPayment(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.paymentProvider !== "asaas" || order.asaasPaymentId) return false;
    const released = await releaseOrderReservation(tx, order.id, order.items, "canceled", "Cobrança não chegou a ser criada no Asaas");
    if (released) await tx.order.update({ where: { id: order.id }, data: { checkoutExpiredAt: new Date() } });
    return released;
  });
}

export const refundableOrderStatuses: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

/**
 * Full refund of a paid Asaas order, requested by an Admin. Claimed once (refundRequestedAt), so a
 * double click or two Admins cannot refund twice. The order becomes "refunded" only when Asaas
 * confirms it (webhook / reconciliation), never just because it was requested.
 */
export async function requestAsaasRefund(orderId: string, actor: AdminAuditActor) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true, paymentProvider: true, asaasPaymentId: true, refundRequestedAt: true } });
  if (!order || order.paymentProvider !== "asaas" || !order.asaasPaymentId) return { status: "not_refundable" as const };
  if (!refundableOrderStatuses.includes(order.status)) return { status: "not_refundable" as const };
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, refundRequestedAt: null, status: { in: refundableOrderStatuses } },
    data: { refundRequestedAt: new Date() },
  });
  if (claimed.count !== 1) return { status: "already_requested" as const };
  try {
    await refundAsaasPayment(getAsaasConfig(), order.asaasPaymentId, `Estorno do pedido ${order.orderNumber}`);
  } catch (error) {
    if (error instanceof AsaasError && error.outcome === "rejected") {
      await prisma.order.updateMany({ where: { id: order.id }, data: { refundRequestedAt: null } });
      return { status: "rejected" as const, code: error.code };
    }
    // Unknown outcome: keep the claim (the refund may exist) and let a person check at Asaas.
    await recordAdminAudit(prisma, { actor, action: "order.refund_unconfirmed", entityType: "Order", entityId: order.id, after: { orderNumber: order.orderNumber } });
    return { status: "unknown" as const };
  }
  await recordAdminAudit(prisma, { actor, action: "order.refund_requested", entityType: "Order", entityId: order.id, after: { orderNumber: order.orderNumber, provider: "asaas" } });
  return { status: "requested" as const };
}

function requirePixCheckout(): MercadoPagoConfig {
  if (!isPixCheckoutAvailable()) throw new Error(pixUnavailableMessage);
  return getMercadoPagoConfig();
}

/**
 * Second half of a Pix checkout: the order and its stock reservation already exist, priced by
 * the server. Creates the Pix at Mercado Pago for exactly that total and stores what the
 * shopper needs to pay it.
 */
async function createPixCharge(
  config: MercadoPagoConfig,
  order: { id: string; orderNumber: string; totalInCents: number; customerEmailSnapshot: string | null; customerNameSnapshot: string | null },
  customer: { email: string; name: string; cpf: string },
  reservationExpiresAt: Date,
  appUrl: string,
) {
  try {
    const payment = await createPixPayment(config, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalInCents: order.totalInCents,
      providerExpiresAt: new Date(reservationExpiresAt.getTime() + PIX_PROVIDER_EXPIRY_GRACE_SECONDS * 1000),
      payer: { email: order.customerEmailSnapshot ?? customer.email, name: order.customerNameSnapshot ?? customer.name, cpf: customer.cpf },
      notificationUrl: `${appUrl}/api/mercadopago/webhook`,
    });
    // Never show a code that charges anything other than this order's total. The reservation
    // stays in place and the worker closes the stray payment at Mercado Pago before releasing it.
    if (payment.amountInCents !== order.totalInCents || payment.currency !== "brl" || payment.externalReference !== order.id || payment.paymentMethodId !== "pix") {
      throw new MercadoPagoError("unknown", "MercadoPagoPixMismatch");
    }
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { mercadoPagoPaymentId: payment.id } }),
      prisma.pixCharge.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, copyPaste: payment.pix.copyPaste, qrCodeBase64: payment.pix.qrCodeBase64, ticketUrl: payment.pix.ticketUrl },
        update: { copyPaste: payment.pix.copyPaste, qrCodeBase64: payment.pix.qrCodeBase64, ticketUrl: payment.pix.ticketUrl },
      }),
    ]);

    return {
      url: `/pedido/pix/${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      checkoutDeadlineAt: reservationExpiresAt.toISOString(),
    };
  } catch (error) {
    // "rejected" means Mercado Pago created nothing, so the stock goes back now. Any other
    // failure may have left a payable Pix behind: keep the reservation for the worker.
    if (error instanceof MercadoPagoError && error.outcome === "rejected") {
      await prisma.$transaction(async (tx) => {
        const freshOrder = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
        if (freshOrder) {
          await releaseOrderReservation(tx, freshOrder.id, freshOrder.items, "failed", "Falha ao criar o Pix no Mercado Pago");
        }
      });
    }
    throw error;
  }
}

/**
 * Applies the authoritative state of a Mercado Pago payment (always read from the API, never
 * taken from a notification body) to its order. Idempotent: the order row lock serializes
 * concurrent notifications and a paid order is never paid twice.
 */
export async function processMercadoPagoPayment(payment: MercadoPagoPayment) {
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.order.findFirst({
      where: {
        OR: [
          { mercadoPagoPaymentId: payment.id },
          ...(payment.externalReference ? [{ id: payment.externalReference }] : []),
        ],
      },
      select: { id: true },
    });
    if (!candidate) return { status: "order_not_found" as const };

    const order = await lockOrder(tx, candidate.id);
    if (
      order.paymentProvider !== "mercadopago" ||
      payment.externalReference !== order.id ||
      (order.mercadoPagoPaymentId && order.mercadoPagoPaymentId !== payment.id)
    ) {
      throw new Error(`Mercado Pago payment does not match order ${order.orderNumber}.`);
    }
    if (!order.mercadoPagoPaymentId) {
      await tx.order.update({ where: { id: order.id }, data: { mercadoPagoPaymentId: payment.id } });
    }

    if (payment.status === "approved") {
      if (payment.paymentMethodId !== "pix") {
        throw new Error(`Mercado Pago payment method does not match order ${order.orderNumber}.`);
      }
      return finalizePaidOrder(tx, order, {
        amountInCents: payment.amountInCents,
        currency: payment.currency,
        paymentMethod: "pix",
        movementReason: "Pagamento Pix confirmado pelo Mercado Pago",
        provider: "Mercado Pago",
      });
    }

    if (payment.status === "cancelled" || payment.status === "rejected") {
      const released = await releaseOrderReservation(
        tx, order.id, order.items, "canceled",
        payment.status === "cancelled" ? "Pix encerrado sem pagamento" : "Pix recusado pelo Mercado Pago",
      );
      if (released) await tx.order.update({ where: { id: order.id }, data: { checkoutExpiredAt: new Date() } });
      return { status: released ? "released" as const : "ignored" as const };
    }

    // pending, in_process, refunded, charged_back...: nothing to apply here.
    return { status: "ignored" as const };
  });

  await notifyPaidOrderIfNeeded(result);
  return result;
}

/** Frees the stock of a Pix order for which Mercado Pago has no payment at all. */
export async function releasePixOrderWithoutPayment(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.paymentProvider !== "mercadopago" || order.mercadoPagoPaymentId) return false;
    const released = await releaseOrderReservation(tx, order.id, order.items, "canceled", "Pix não chegou a ser criado no Mercado Pago");
    if (released) await tx.order.update({ where: { id: order.id }, data: { checkoutExpiredAt: new Date() } });
    return released;
  });
}

export async function processStripeCheckoutEvent(eventId: string, eventType: string, session: Stripe.Checkout.Session) {
  const result = await prisma.$transaction(async (tx) => {
    const alreadyProcessed = await tx.stripeEvent.findUnique({ where: { id: eventId } });
    if (alreadyProcessed) {
      return { status: "already_processed" as const };
    }

    const candidate = await tx.order.findFirst({
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

    const order = candidate ? await lockOrder(tx, candidate.id) : null;
    if (order && await tx.stripeEvent.findUnique({ where: { id: eventId } })) {
      return { status: "already_processed" as const };
    }
    if (order?.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== session.id) {
      throw new Error(`Stripe Checkout Session does not match order ${order.orderNumber}.`);
    }
    if (order && session.metadata?.orderId && session.metadata.orderId !== order.id) {
      throw new Error(`Stripe Checkout metadata does not match order ${order.orderNumber}.`);
    }

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

    if (!order.stripeCheckoutSessionId) {
      await tx.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
    }

    if (eventType === "checkout.session.expired") {
      // A delayed expiration event must not undo a completed asynchronous
      // checkout whose payment is still processing, or a confirmed payment.
      if (!order.reservationExpiresAt || session.payment_status === "paid") return { status: "ignored" as const };
      const released = await releaseOrderReservation(tx, order.id, order.items, "canceled", "Checkout Stripe expirado");
      if (released) await tx.order.update({ where: { id: order.id }, data: { checkoutExpiredAt: new Date() } });
      return { status: released ? "released" as const : "ignored" as const };
    }

    if (eventType === "checkout.session.async_payment_failed") {
      await releaseOrderReservation(tx, order.id, order.items, "failed", "Pagamento assincrono falhou");
      return { status: "failed" as const };
    }

    const shouldMarkPaid =
      (eventType === "checkout.session.async_payment_succeeded" || eventType === "checkout.session.completed") &&
      session.payment_status === "paid";

    if (!shouldMarkPaid) {
      // A completed, unpaid Checkout can still settle asynchronously. The session
      // expiry is no longer a deadline for the payment; keep its reservation until
      // the signed async success/failure event arrives.
      if (eventType === "checkout.session.completed" && releasableReservationStatuses.includes(order.status)) {
        await tx.order.update({ where: { id: order.id }, data: { reservationExpiresAt: null } });
      }
      return { status: "ignored" as const };
    }

    const sessionWithShipping = session as Stripe.Checkout.Session & {
      shipping_details?: { address?: Stripe.Address | null; name?: string | null; phone?: string | null } | null;
    };

    return finalizePaidOrder(tx, order, {
      amountInCents: session.amount_total,
      currency: session.currency,
      customerDetails: session.customer_details,
      shippingDetails: session.collected_information?.shipping_details ?? sessionWithShipping.shipping_details,
      paymentIntentId: getPaymentIntentIdFromSession(session),
      paymentMethod: session.payment_method_types?.join(",") ?? null,
      movementReason: "Pagamento confirmado pela Stripe",
    });
  });

  await notifyPaidOrderIfNeeded(result);
  return result;
}

export async function processStripePaymentIntentEvent(
  eventId: string,
  eventType: string,
  paymentIntent: Stripe.PaymentIntent,
) {
  const result = await prisma.$transaction(async (tx) => {
    const alreadyProcessed = await tx.stripeEvent.findUnique({ where: { id: eventId } });
    if (alreadyProcessed) {
      return { status: "already_processed" as const };
    }

    const candidate = await findOrderForPaymentIntent(tx, paymentIntent);
    const order = candidate ? await lockOrder(tx, candidate.id) : null;
    if (order && await tx.stripeEvent.findUnique({ where: { id: eventId } })) {
      return { status: "already_processed" as const };
    }
    if (order?.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntent.id) {
      throw new Error(`Stripe PaymentIntent does not match order ${order.orderNumber}.`);
    }
    if (order && paymentIntent.metadata?.orderId && paymentIntent.metadata.orderId !== order.id) {
      throw new Error(`Stripe PaymentIntent metadata does not match order ${order.orderNumber}.`);
    }

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
      // A declined attempt returns the same PaymentIntent to
      // requires_payment_method and the customer can retry this Checkout.
      return { status: "payment_attempt_failed" as const };
    }

    if (eventType === "payment_intent.succeeded" && paymentIntent.status === "succeeded") {
      return finalizePaidOrder(tx, order, {
        amountInCents: paymentIntent.amount_received,
        currency: paymentIntent.currency,
        paymentIntentId: paymentIntent.id,
        paymentMethod,
        movementReason: "Pagamento confirmado pela Stripe",
      });
    }

    return { status: "ignored" as const };
  });

  await notifyPaidOrderIfNeeded(result);
  return result;
}
