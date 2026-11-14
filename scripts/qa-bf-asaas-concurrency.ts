import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

// Real PostgreSQL, synthetic data, and an in-process Asaas double installed on globalThis.fetch
// (the real transport code runs; no request leaves the machine). Covers the cycle's critical
// invariants: Black Friday price on the last unit with 5 simultaneous buyers, server-side totals,
// duplicate / out-of-order webhooks, divergent values, charge deletion before stock release, and
// atomic MFA replay protection. Refuses any non-local database.

function cpf(seed: number) {
  const base = String(100000000 + seed).slice(0, 9).split("").map(Number);
  const digit = (numbers: number[]) => {
    const sum = numbers.reduce((total, value, index) => total + value * (numbers.length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digit(base);
  return [...base, first, digit([...base, first])].join("");
}

async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_bf_${Date.now()}_${randomBytes(3).toString("hex")}`;
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
    Object.assign(process.env, {
      DATABASE_URL: source.toString(), APP_ENV: "test", NODE_ENV: "test", APP_URL: "http://localhost:3000", CHECKOUT_ENABLED: "true", SHIPPING_ENABLED: "true",
      EMAIL_DRIVER: "disabled", PAYMENT_PROVIDER: "asaas", ASAAS_ENV: "sandbox", ASAAS_API_KEY: `$aact_hmlg_${"q".repeat(40)}`, ASAAS_WEBHOOK_TOKEN: "w".repeat(40),
      ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), RATE_LIMIT_DRIVER: "memory",
    });
    for (const name of ["STRIPE_SECRET_KEY", "PIX_ENABLED", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY"]) delete process.env[name];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume();
      child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("Isolated migration failed."))));
    });

    // ---- Asaas double -------------------------------------------------------------------------
    type FakePayment = { id: string; status: string; value: number; billingType: string; customer: string; externalReference: string; invoiceUrl: string; deleted: boolean };
    const payments = new Map<string, FakePayment>();
    const customers = new Map<string, string>();
    let payCounter = 0;
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api-sandbox.asaas.com", "Only the Sandbox host may be called");
      assert.equal((init?.headers as Record<string, string>).access_token, process.env.ASAAS_API_KEY);
      const route = url.pathname.replace("/v3", "");
      const method = init?.method ?? "GET";
      if (method === "GET") assert.equal(init?.body, undefined, "GET must have no body");
      if (route === "/customers" && method === "GET") return json(200, { data: [...customers.entries()].filter(([, ref]) => ref === url.searchParams.get("externalReference")).map(([id, ref]) => ({ id, externalReference: ref })) });
      if (route === "/customers" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(Object.keys(body).sort(), ["cpfCnpj", "email", "externalReference", "name", "notificationDisabled"]);
        const id = `cus_${randomBytes(6).toString("hex")}`;
        customers.set(id, body.externalReference);
        return json(200, { id });
      }
      if (route === "/payments" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        payCounter += 1;
        const payment: FakePayment = { id: `pay_${String(payCounter).padStart(12, "0")}`, status: "PENDING", value: body.value, billingType: body.billingType, customer: body.customer, externalReference: body.externalReference, invoiceUrl: `https://sandbox.asaas.com/i/${payCounter}`, deleted: false };
        payments.set(payment.id, payment);
        return json(200, payment);
      }
      if (route === "/payments" && method === "GET") return json(200, { data: [...payments.values()].filter((payment) => payment.externalReference === url.searchParams.get("externalReference")) });
      const qr = route.match(/^\/payments\/(pay_\w+)\/pixQrCode$/);
      if (qr) return json(200, { payload: `00020126-${qr[1]}`, encodedImage: "iVBORw0KGgo=", expirationDate: "2027-12-31 23:59:59" });
      const one = route.match(/^\/payments\/(pay_\w+)$/);
      if (one && method === "GET") return payments.has(one[1]) ? json(200, payments.get(one[1])) : json(404, { errors: [] });
      if (one && method === "DELETE") {
        const payment = payments.get(one[1]);
        if (!payment || payment.status !== "PENDING") return json(400, { errors: [{ code: "invalid_action" }] });
        payment.deleted = true;
        return json(200, { deleted: true, id: payment.id });
      }
      return json(404, { errors: [] });
    }) as typeof fetch;

    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const commerce = await import("../src/lib/checkout");
    const { runCheckoutExpiryBatch } = await import("../src/lib/checkout-expiry");
    const { storeAsaasWebhookEvent, processAsaasWebhookEvents } = await import("../src/lib/asaas-webhook");
    const proofs: string[] = [];

    await prisma.storeSettings.upsert({ where: { id: "store" }, update: { shippingMode: "fixed", fixedShippingInCents: 2000 }, create: { id: "store", shippingMode: "fixed", fixedShippingInCents: 2000 } });
    async function shopper(index: number) {
      const customer = await prisma.customer.create({ data: { name: `QA Shopper ${index}`, email: `qa${index}-${randomBytes(3).toString("hex")}@rare.invalid`, cpf: cpf(index * 7919 + 13), passwordHash: "not-a-login" } });
      const address = await prisma.customerAddress.create({ data: { customerId: customer.id, cep: "01001000", street: "QA", number: "1", neighborhood: "QA", city: "Sao Paulo", state: "SP", isDefault: true } });
      return { customer, address };
    }
    async function product(stock = 1, priceInCents = 20000) {
      return prisma.product.create({ data: { title: "Synthetic BF QA", slug: `qa-bf-${randomBytes(8).toString("hex")}`, description: "Synthetic", shortDescription: "Synthetic", priceInCents, weightGrams: 400, lengthCm: 30, widthCm: 24, heightCm: 4, variants: { create: { size: "U", stock } } }, include: { variants: true } });
    }
    async function checkout(buyer: Awaited<ReturnType<typeof shopper>>, item: Awaited<ReturnType<typeof product>>, method: "pix" | "card" = "pix", extra: Record<string, unknown> = {}) {
      return commerce.createCheckoutSession({ items: [{ productId: item.id, variantId: item.variants[0].id, quantity: 1, ...extra }], shippingOptionId: "fixed", customerAddressId: buyer.address.id, paymentMethod: method, ...extra }, { customerId: buyer.customer.id });
    }
    async function deliver(eventId: string, event: string, paymentId: string) {
      const stored = await storeAsaasWebhookEvent({ id: eventId, event, paymentId });
      await processAsaasWebhookEvents({ limit: 10 });
      return stored;
    }

    // 1. Black Friday 25% + last unit + 5 simultaneous buyers -> one winner, server-side total.
    const last = await product(1, 20000);
    await prisma.promotion.create({ data: { name: "SALE BLACK FRIDAY", slug: `bf-${randomBytes(3).toString("hex")}`, status: "ACTIVE", type: "PERCENTAGE", value: 25, scope: "SELECTED_PRODUCTS", products: { create: { productId: last.id } } } });
    const buyers = await Promise.all([1, 2, 3, 4, 5].map(shopper));
    const attempts = await Promise.allSettled(buyers.map((buyer) => checkout(buyer, last, "pix", { priceInCents: 1, totalInCents: 100, amount: 1, discount: 99 })));
    const winners = attempts.filter((attempt) => attempt.status === "fulfilled");
    assert.equal(winners.length, 1, "exactly one buyer gets the last unit");
    for (const attempt of attempts) if (attempt.status === "rejected") assert.match(String(attempt.reason?.message), /Estoque insuficiente/);
    const variantAfter = await prisma.productVariant.findUniqueOrThrow({ where: { id: last.variants[0].id } });
    assert.equal(variantAfter.stock, 1);
    assert.equal(variantAfter.reservedStock, 1);
    assert(variantAfter.stock - variantAfter.reservedStock >= 0, "no negative available stock");
    const winnerOrderId = (winners[0] as PromiseFulfilledResult<{ orderId: string }>).value.orderId;
    const winnerOrder = await prisma.order.findUniqueOrThrow({ where: { id: winnerOrderId }, include: { items: true } });
    assert.equal(winnerOrder.totalInCents, 17000, "R$ 200 - 25% + R$ 20 = R$ 170");
    assert.equal(winnerOrder.promotionDiscountInCents, 5000);
    assert.equal(winnerOrder.items[0].basePriceInCents, 20000);
    assert.equal(winnerOrder.items[0].promotionName, "SALE BLACK FRIDAY");
    assert.equal(payments.get(winnerOrder.asaasPaymentId!)!.value, 170, "Asaas received R$ 170, never the browser's R$ 1");
    assert.equal(await prisma.order.count(), 1);
    proofs.push("bf_last_unit_five_buyers_one_winner_server_total_170");

    // 2. Payment confirmed: duplicate + out-of-order deliveries -> one sale.
    const winnerPayment = payments.get(winnerOrder.asaasPaymentId!)!;
    winnerPayment.status = "RECEIVED";
    assert.equal(await deliver("evt_received_1", "PAYMENT_RECEIVED", winnerPayment.id), "stored");
    assert.equal(await deliver("evt_received_1", "PAYMENT_RECEIVED", winnerPayment.id), "duplicate");
    await deliver("evt_confirmed_late", "PAYMENT_CONFIRMED", winnerPayment.id);
    await deliver("evt_created_late", "PAYMENT_CREATED", winnerPayment.id);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: winnerOrderId } });
    assert.equal(paid.status, "paid");
    const soldVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: last.variants[0].id } });
    assert.equal(soldVariant.stock, 0);
    assert.equal(soldVariant.reservedStock, 0);
    assert.equal(await prisma.inventoryMovement.count({ where: { orderId: winnerOrderId, type: "sale" } }), 1);
    assert.equal(await prisma.asaasWebhookEvent.count({ where: { id: "evt_received_1" } }), 1);
    proofs.push("duplicate_and_out_of_order_webhooks_one_sale_no_regression");

    // 3. Divergent value is never marked paid.
    const mismatchBuyer = await shopper(20);
    const mismatchItem = await product(3, 10000);
    const mismatch = await checkout(mismatchBuyer, mismatchItem);
    const mismatchOrder = await prisma.order.findUniqueOrThrow({ where: { id: mismatch.orderId } });
    const mismatchPayment = payments.get(mismatchOrder.asaasPaymentId!)!;
    mismatchPayment.status = "RECEIVED";
    mismatchPayment.value = 1;
    await deliver("evt_mismatch", "PAYMENT_RECEIVED", mismatchPayment.id);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: mismatch.orderId } })).status, "awaiting_payment");
    assert.equal(await prisma.adminNotification.count({ where: { orderId: mismatch.orderId, type: "payment_mismatch" } }), 1);
    proofs.push("divergent_value_not_paid_incident_recorded");

    // 4. Expiry deletes the charge at Asaas before giving the stock back; a late payment cannot steal it.
    const expiryBuyer = await shopper(30);
    const expiryItem = await product(1, 10000);
    const expiring = await checkout(expiryBuyer, expiryItem, "card");
    const expiringOrder = await prisma.order.findUniqueOrThrow({ where: { id: expiring.orderId } });
    assert.equal(expiring.url, payments.get(expiringOrder.asaasPaymentId!)!.invoiceUrl, "card goes to the Asaas invoice");
    await runCheckoutExpiryBatch({ now: new Date(expiringOrder.checkoutDeadlineAt!.getTime() + 1000) });
    assert.equal(payments.get(expiringOrder.asaasPaymentId!)!.deleted, true);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: expiring.orderId } })).status, "canceled");
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: expiryItem.variants[0].id } })).reservedStock, 0);
    proofs.push("expiry_deletes_charge_first_then_releases_stock");

    // 5. Race: paid while the worker tries to delete -> paid, not released.
    const raceBuyer = await shopper(40);
    const raceItem = await product(1, 10000);
    const race = await checkout(raceBuyer, raceItem);
    const raceOrder = await prisma.order.findUniqueOrThrow({ where: { id: race.orderId } });
    payments.get(raceOrder.asaasPaymentId!)!.status = "RECEIVED";
    await runCheckoutExpiryBatch({ now: new Date(raceOrder.checkoutDeadlineAt!.getTime() + 1000) });
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: race.orderId } })).status, "paid");
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: raceItem.variants[0].id } })).stock, 0);
    proofs.push("payment_during_expiry_settles_as_paid");

    // 6. Refund webhook after paid: refunded, stock not resurrected.
    payments.get(raceOrder.asaasPaymentId!)!.status = "REFUNDED";
    await deliver("evt_refunded", "PAYMENT_REFUNDED", raceOrder.asaasPaymentId!);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: race.orderId } })).status, "refunded");
    assert.equal((await prisma.productVariant.findUniqueOrThrow({ where: { id: raceItem.variants[0].id } })).stock, 0);
    payments.get(raceOrder.asaasPaymentId!)!.status = "RECEIVED";
    await deliver("evt_received_after_refund", "PAYMENT_RECEIVED", raceOrder.asaasPaymentId!);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: race.orderId } })).status, "refunded", "refunded never goes back to paid");
    proofs.push("refund_no_restock_no_regression");

    // 7. Customer reuse: a second checkout of the same shopper creates no second Asaas customer.
    const customersBefore = customers.size;
    await checkout(raceBuyer, await product(2, 5000));
    assert.equal(customers.size, customersBefore);
    proofs.push("asaas_customer_reused");

    // 8. MFA: two concurrent submissions of the same TOTP code -> exactly one accepted (real row update).
    const { sealMfaSecret } = await import("../src/lib/admin-mfa-crypto");
    const { verifyMfaChallenge } = await import("../src/lib/admin-mfa");
    const { base32Decode, hotp, totpStep } = await import("../src/lib/totp");
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const admin = await prisma.user.create({ data: { name: "QA Admin", email: `qa-admin-${randomBytes(3).toString("hex")}@rare.invalid`, passwordHash: "x", role: "ADMIN" } });
    await prisma.user.update({ where: { id: admin.id }, data: { mfaSecretEncrypted: sealMfaSecret(secret, admin.id), mfaEnabledAt: new Date() } });
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    const now = new Date();
    const code = hotp(base32Decode(secret), totpStep(now.getTime()));
    const results = await Promise.all([verifyMfaChallenge(fresh, code, "qa", now), verifyMfaChallenge(fresh, code, "qa", now), verifyMfaChallenge(fresh, code, "qa", now)]);
    assert.equal(results.filter((result) => result.ok).length, 1, "a TOTP code is accepted once");
    const replay = await verifyMfaChallenge(await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }), code, "qa", now);
    assert.deepEqual(replay, { ok: false, reason: "replay" });
    proofs.push("mfa_totp_single_use_under_concurrency");

    console.log(JSON.stringify({ qa: "bf-asaas-concurrency", database: "isolated-local", proofs }, null, 2));
  } finally {
    await database?.$disconnect().catch(() => undefined);
    if (created) await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
    await maintenance.end();
  }
}

main().catch((error) => {
  console.error("QA FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
