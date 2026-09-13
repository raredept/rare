import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";
import type Stripe from "stripe";

// Real PostgreSQL transactions, synthetic data, and an in-process Stripe double.
// No payment, shipping provider, email, or push network calls are made by this QA.
async function main() {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_commerce_${Date.now()}_${randomBytes(3).toString("hex")}`;
  assert(/^rare_qa_commerce_[a-z0-9_]+$/.test(databaseName));
  const maintenanceUrl = new URL(source);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = new pg.Client({ connectionString: maintenanceUrl.toString() });
  let created = false;
  let database: Awaited<typeof import("../src/lib/prisma")>["prisma"] | undefined;
  await maintenance.connect();
  try {
    await maintenance.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    source.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = source.toString();
    process.env.APP_ENV = "test";
    process.env.APP_URL = "http://localhost:3000";
    process.env.CHECKOUT_ENABLED = "true";
    process.env.SHIPPING_ENABLED = "true";
    process.env.EMAIL_DRIVER = "disabled";
    process.env.STRIPE_SECRET_KEY = "sk_test_qa_no_network";
    delete process.env.STRIPE_PAYMENT_METHOD_TYPES;
    delete process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
        env: process.env, windowsHide: true, stdio: "pipe",
      });
      // Do not echo environment/database credentials on failures.
      child.stdout.resume();
      child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Isolated migration failed.")));
    });
    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const commerce = await import("../src/lib/checkout");
    const { getStripe } = await import("../src/lib/stripe");
    const { runCheckoutExpiryBatch } = await import("../src/lib/checkout-expiry");
    const sessions = new Map<string, Stripe.Checkout.Session>();
    const stripe = getStripe();
    stripe.checkout.sessions.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
      const value = { id: `cs_test_${params.client_reference_id}`, url: "https://checkout.stripe.test/qa",
        metadata: params.metadata, client_reference_id: params.client_reference_id,
        status: "open", payment_status: "unpaid", payment_intent: null, amount_total: 11000, currency: "brl" } as Stripe.Checkout.Session;
      assert(params.expires_at! >= Math.floor(Date.now() / 1000) + 1800, "Stripe creation must not receive 15 minutes");
      sessions.set(value.id, value); return value;
    }) as typeof stripe.checkout.sessions.create;
    const transportFault = { remaining: 0, sessionId: "" };
    let expireResponseLost = false;
    stripe.checkout.sessions.retrieve = (async (id: string) => {
      if (transportFault.remaining > 0 && id === transportFault.sessionId) { transportFault.remaining -= 1; throw new Error("Synthetic transport interruption"); }
      return { ...sessions.get(id)! };
    }) as typeof stripe.checkout.sessions.retrieve;
    stripe.checkout.sessions.expire = (async (id: string) => {
      const session = sessions.get(id)!;
      if (session.status !== "open") throw new Error("Session not open");
      session.status = "expired";
      if (expireResponseLost) { expireResponseLost = false; throw new Error("Synthetic lost response after acceptance"); }
      return { ...session };
    }) as typeof stripe.checkout.sessions.expire;
    stripe.checkout.sessions.list = (async () => ({ data: [...sessions.values()], has_more: false })) as typeof stripe.checkout.sessions.list;
    await prisma.storeSettings.upsert({ where: { id: "store" }, update: { shippingMode: "fixed", fixedShippingInCents: 1000 }, create: { id: "store", shippingMode: "fixed", fixedShippingInCents: 1000 } });
    const customer = await prisma.customer.create({ data: { name: "QA Synthetic", email: "commerce@rare.invalid", cpf: "12345678909", passwordHash: "not-a-login" } });
    const address = await prisma.customerAddress.create({ data: { customerId: customer.id, cep: "01001000", street: "QA", number: "1", neighborhood: "QA", city: "Sao Paulo", state: "SP" } });

    async function product(stock = 1) {
      return prisma.product.create({ data: { title: "Synthetic commerce QA", slug: `qa-${randomBytes(8).toString("hex")}`, description: "Synthetic", shortDescription: "Synthetic", priceInCents: 10000, weightGrams: 400, lengthCm: 30, widthCm: 24, heightCm: 4, variants: { create: { size: "QA", stock } } }, include: { variants: true } });
    }
    async function checkout(item: Awaited<ReturnType<typeof product>>) {
      return commerce.createCheckoutSession({ items: [{ productId: item.id, variantId: item.variants[0].id, quantity: 1 }], shippingOptionId: "fixed", customerAddressId: address.id }, { customerId: customer.id });
    }
    function session(orderId: string, paymentStatus = "paid") {
      return { id: `cs_test_${orderId}`, metadata: { orderId }, payment_status: paymentStatus, payment_intent: `pi_${orderId}`, amount_total: 11000, currency: "brl", payment_method_types: ["card"] } as unknown as Stripe.Checkout.Session;
    }
    function intent(orderId: string) {
      return { id: `pi_${orderId}`, metadata: { orderId }, status: "succeeded", amount_received: 11000, currency: "brl", payment_method_types: ["card"] } as unknown as Stripe.PaymentIntent;
    }
    async function verifyPaid(orderId: string, variantId: string, expectedStock = 0) {
      assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, "paid");
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
      assert.equal(variant.stock, expectedStock);
      assert.equal(variant.reservedStock, 0);
      assert.equal(await prisma.inventoryMovement.count({ where: { orderId, type: "sale" } }), 1);
      assert.equal(await prisma.emailOutbox.count({ where: { orderId, kind: "payment_approved" } }), 1);
    }
    const proofs: string[] = [];
    const last = await product();
    const attempts = await Promise.allSettled([checkout(last), checkout(last)]);
    assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((item) => item.status === "rejected").length, 1);
    assert.equal(await prisma.order.count(), 1);
    proofs.push("last_unit_two_checkouts_one_reservation");

    const reserved = attempts.find((item) => item.status === "fulfilled")!;
    assert.equal(reserved.status, "fulfilled");
    if (reserved.status !== "fulfilled") throw new Error("Missing successful checkout");
    const orderId = reserved.value.orderId;
    await Promise.all(Array.from({ length: 8 }, (_, index) => index % 2
      ? commerce.processStripeCheckoutEvent(`evt_concurrent_${index}`, "checkout.session.completed", session(orderId))
      : commerce.processStripePaymentIntentEvent(`evt_concurrent_${index}`, "payment_intent.succeeded", intent(orderId))));
    await verifyPaid(orderId, last.variants[0].id);
    assert.equal(await prisma.adminNotification.count({ where: { orderId } }), 1);
    proofs.push("eight_session_and_payment_intent_events_one_sale");

    const duplicateProduct = await product();
    const duplicateOrder = await checkout(duplicateProduct);
    const duplicates = await Promise.all([0, 1, 2].map(() => commerce.processStripeCheckoutEvent("evt_duplicate_concurrent", "checkout.session.completed", session(duplicateOrder.orderId))));
    assert.equal(duplicates.filter((result) => result.status === "paid").length, 1);
    await verifyPaid(duplicateOrder.orderId, duplicateProduct.variants[0].id);
    proofs.push("three_simultaneous_duplicate_deliveries_one_sale");

    for (let i = 0; i < 5; i += 1) {
      const item = await product();
      const order = await checkout(item);
      await prisma.order.update({ where: { id: order.orderId }, data: { reservationExpiresAt: new Date(0) } });
      await prisma.checkoutExpiryJob.update({ where: { orderId: order.orderId }, data: { nextAttemptAt: new Date(0) } });
      await Promise.all([commerce.releaseExpiredReservations(), commerce.processStripePaymentIntentEvent(`evt_race_${i}`, "payment_intent.succeeded", intent(order.orderId))]);
      await verifyPaid(order.orderId, item.variants[0].id);
    }
    proofs.push("five_payment_expiry_races_one_sale_each");

    const held = await product();
    const older = await checkout(held);
    await prisma.order.update({ where: { id: older.orderId }, data: { reservationExpiresAt: new Date(0) } });
    await prisma.checkoutExpiryJob.update({ where: { orderId: older.orderId }, data: { nextAttemptAt: new Date(0) } });
    await commerce.releaseExpiredReservations();
    await checkout(held);
    await assert.rejects(commerce.processStripePaymentIntentEvent("evt_late_no_stock", "payment_intent.succeeded", intent(older.orderId)), /Reserved stock/);
    const unchanged = await prisma.productVariant.findUniqueOrThrow({ where: { id: held.variants[0].id } });
    assert.equal(unchanged.stock, 1);
    assert.equal(unchanged.reservedStock, 1);
    assert.equal(await prisma.stripeEvent.count({ where: { id: "evt_late_no_stock" } }), 0);
    proofs.push("late_payment_cannot_consume_another_orders_reservation_retry_preserved");

    const retryProduct = await product();
    const retryOrder = await checkout(retryProduct);
    await commerce.processStripePaymentIntentEvent("evt_attempt_failed", "payment_intent.payment_failed", { ...intent(retryOrder.orderId), status: "requires_payment_method" });
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: retryProduct.variants[0].id } })).reservedStock, 1);
    await commerce.processStripePaymentIntentEvent("evt_retry_succeeded", "payment_intent.succeeded", intent(retryOrder.orderId));
    await verifyPaid(retryOrder.orderId, retryProduct.variants[0].id);
    proofs.push("declined_attempt_then_success_uses_original_reservation");

    const asyncProduct = await product();
    const asyncOrder = await checkout(asyncProduct);
    await commerce.processStripeCheckoutEvent("evt_async_processing", "checkout.session.completed", session(asyncOrder.orderId, "unpaid"));
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: asyncOrder.orderId } })).reservationExpiresAt, null);
    assert.equal(await commerce.releaseExpiredReservations(), 0);
    await commerce.processStripeCheckoutEvent("evt_async_failed", "checkout.session.async_payment_failed", session(asyncOrder.orderId, "unpaid"));
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: asyncProduct.variants[0].id } })).reservedStock, 0);
    proofs.push("async_pending_reservation_survives_session_expiry_until_final_event");

    async function timedCheckout() {
      const item = await product();
      const started = Date.now();
      const operation = await checkout(item);
      const record = await prisma.order.findUniqueOrThrow({ where: { id: operation.orderId } });
      assert(record.checkoutDeadlineAt);
      assert(record.checkoutDeadlineAt.getTime() - started >= 900_000 && record.checkoutDeadlineAt.getTime() - started < 905_000);
      const job = await prisma.checkoutExpiryJob.findUniqueOrThrow({ where: { orderId: record.id } });
      assert.equal(job.deadlineAt.toISOString(), record.checkoutDeadlineAt.toISOString());
      return { item, record, due: new Date(job.deadlineAt.getTime() + 1000) };
    }
    const fault = await timedCheckout();
    transportFault.remaining = 1;
    transportFault.sessionId = fault.record.stripeCheckoutSessionId!;
    await runCheckoutExpiryBatch({ now: fault.due });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: fault.record.id } })).status, "awaiting_payment");
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: fault.item.variants[0].id } })).reservedStock, 1);
    const failedJob = await prisma.checkoutExpiryJob.findUniqueOrThrow({ where: { orderId: fault.record.id } });
    assert.equal(failedJob.status, "retry");
    assert.equal(failedJob.lastErrorCode, "PROVIDER_RECONCILIATION_FAILED");
    // Simulate a worker that claimed its durable row and then died.
    const abandonedLeaseEnd = new Date(fault.due.getTime() + 120_000);
    await prisma.checkoutExpiryJob.update({ where: { id: failedJob.id }, data: { status: "processing", leaseToken: "dead-worker", leaseExpiresAt: abandonedLeaseEnd } });
    await runCheckoutExpiryBatch({ now: new Date(abandonedLeaseEnd.getTime() - 1) });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: fault.record.id } })).status, "awaiting_payment");
    await runCheckoutExpiryBatch({ now: new Date(abandonedLeaseEnd.getTime() + 1) });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: fault.record.id } })).status, "canceled");
    assert.equal(sessions.get(fault.record.stripeCheckoutSessionId!)?.status, "expired");
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: fault.item.variants[0].id } })).reservedStock, 0);
    proofs.push("durable_15_minute_deadline_provider_failure_holds_stock_abandoned_worker_lease_recovers");

    const lost = await timedCheckout();
    expireResponseLost = true;
    await runCheckoutExpiryBatch({ now: lost.due });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: lost.record.id } })).status, "canceled");
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: lost.record.id, type: "release" } }), 1);
    await runCheckoutExpiryBatch({ now: lost.due });
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: lost.record.id, type: "release" } }), 1);
    proofs.push("lost_expire_response_retrieved_before_release_and_duplicate_worker_idempotent");

    const ambiguous = await timedCheckout();
    await prisma.order.update({ where: { id: ambiguous.record.id }, data: { stripeCheckoutSessionId: null } });
    await runCheckoutExpiryBatch({ now: ambiguous.due });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: ambiguous.record.id } })).status, "canceled");
    proofs.push("lost_creation_response_recovers_provider_session_by_order_metadata");

    const processing = await timedCheckout();
    sessions.set(processing.record.stripeCheckoutSessionId!, { ...sessions.get(processing.record.stripeCheckoutSessionId!)!, status: "complete", payment_status: "unpaid", payment_intent: { ...intent(processing.record.id), status: "processing" } as Stripe.PaymentIntent });
    await runCheckoutExpiryBatch({ now: processing.due });
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: processing.item.variants[0].id } })).reservedStock, 1);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: processing.record.id } })).reservationExpiresAt, null);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: processing.record.id } })).checkoutDeadlineAt!.toISOString(), processing.record.checkoutDeadlineAt!.toISOString());
    sessions.get(processing.record.stripeCheckoutSessionId!)!.payment_status = "paid";
    await runCheckoutExpiryBatch({ now: new Date(processing.due.getTime() + 60_000) });
    await verifyPaid(processing.record.id, processing.item.variants[0].id);
    proofs.push("async_processing_at_deadline_preserves_stock_then_reconciles_payment");

    const legacy = await timedCheckout();
    const originalDeadline = new Date(legacy.due.getTime() + 1_800_000);
    await prisma.checkoutExpiryJob.delete({ where: { orderId: legacy.record.id } });
    await prisma.order.update({ where: { id: legacy.record.id }, data: { checkoutDeadlineAt: null, reservationExpiresAt: originalDeadline } });
    await runCheckoutExpiryBatch({ now: legacy.due });
    assert.equal(await prisma.checkoutExpiryJob.count({ where: { orderId: legacy.record.id } }), 0);
    await runCheckoutExpiryBatch({ now: new Date(originalDeadline.getTime() + 1) });
    assert.equal((await prisma.checkoutExpiryJob.findUniqueOrThrow({ where: { orderId: legacy.record.id } })).deadlineAt.toISOString(), originalDeadline.toISOString());
    proofs.push("legacy_deadline_preserved_and_backfilled_without_shortening");
    console.log(`COMMERCE_CONCURRENCY_QA=${JSON.stringify({ database: databaseName, proofs, providerCalls: 0 })}`);
  } finally {
    await database?.$disconnect();
    if (created) {
      await maintenance.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
      await maintenance.query(`DROP DATABASE "${databaseName}"`);
      console.log("COMMERCE_QA_DATABASE_REMOVED=true");
    }
    await maintenance.end();
  }
}

main().catch((error: unknown) => {
  console.error("Commerce concurrency QA failed", error instanceof Error ? error.message.replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]") : "UnknownError");
  process.exitCode = 1;
});
