import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

// Real PostgreSQL, synthetic data, disposable database. Proves: support requests survive provider
// failures, a double submit is one request, each e-mail goes out once (idempotency key per part),
// retries are safe, orders of another customer cannot be attached (no IDOR), the product comes from
// the catalog; and the RARE10 first-order rule survives refunds. The e-mail provider is a fake in
// process: no network. Refuses any non-local database.

async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_support_${Date.now()}_${randomBytes(3).toString("hex")}`;
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
    Object.assign(process.env, { DATABASE_URL: source.toString(), APP_ENV: "test", NODE_ENV: "test", APP_URL: "http://localhost:3000", RATE_LIMIT_DRIVER: "memory", EMAIL_DRIVER: "disabled" });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume();
      child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("Isolated migration failed."))));
    });

    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const { createSupportRequest, deliverSupportRequest, processSupportRequests, retrySupportRequest, supportMessageId } = await import("../src/lib/support-requests");
    const { EmailDeliveryError } = await import("../src/lib/transactional-email");
    const { firstOrderCouponConsumedWhere, getFirstOrderCouponDiscount } = await import("../src/lib/coupons");
    const results: string[] = [];
    const pass = (name: string) => { results.push(name); console.log(`PASS ${name}`); };

    // Staging-like delivery policy: test mode with an allowlist; only allowlisted mailboxes receive.
    const env = {
      ...process.env, EMAIL_DRIVER: "resend", RESEND_API_KEY: `re_${randomBytes(16).toString("hex")}`, APP_ENV: "staging", EMAIL_DELIVERY_MODE: "test",
      EMAIL_TEST_RECIPIENTS: "suporte@raredept.com.br,qa.cliente@homologacao.rare.invalid", EMAIL_FROM_ORDERS: "contato@raredept.com.br",
      EMAIL_REPLY_TO: "contato@raredept.com.br", SUPPORT_INBOX_EMAIL: "suporte@raredept.com.br", EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
    };
    type Sent = { to: string; replyTo?: string; subject: string; messageId: string };
    const sent: Sent[] = [];
    let failure: InstanceType<typeof EmailDeliveryError> | null = null;
    const provider = {
      name: "resend",
      async send(message: { to: string; replyTo?: string; subject: string }, messageId: string) {
        if (failure) throw failure;
        sent.push({ to: message.to, replyTo: message.replyTo, subject: message.subject, messageId });
        return { id: `resend:${randomUUID()}` };
      },
    };

    const customer = await prisma.customer.create({ data: { name: "QA Cliente", email: "qa.cliente@homologacao.rare.invalid", passwordHash: "x" } });
    const stranger = await prisma.customer.create({ data: { name: "QA Outro", email: "qa.outro@homologacao.rare.invalid", passwordHash: "x" } });
    const product = await prisma.product.create({ data: { title: "Jaqueta QA", slug: "jaqueta-qa", description: "QA", shortDescription: "QA", priceInCents: 10_000, stockPolicy: "UNIQUE" } });
    const order = (customerId: string, status: "awaiting_payment" | "paid" | "refunded" | "failed" | "canceled", paidAt: Date | null) => prisma.order.create({
      data: { orderNumber: `QA-${randomBytes(4).toString("hex")}`, customerId, subtotalInCents: 1000, totalInCents: 1000, status, paidAt },
    });
    const strangerOrder = await order(stranger.id, "paid", new Date());
    const ownOrder = await order(customer.id, "awaiting_payment", null);
    const submission = (overrides: Partial<Parameters<typeof createSupportRequest>[1]> = {}) => ({
      submissionKey: randomUUID(), name: "QA Cliente", email: "qa.cliente@homologacao.rare.invalid", category: "SOLD_OUT_PRODUCT" as const,
      message: "Gostei da jaqueta, vocês têm algo parecido?", productSlug: "jaqueta-qa", orderId: null, ...overrides,
    });

    // 1. Persist before delivery; the product comes from the catalog; a double submit is one request.
    const input = submission({ orderId: ownOrder.id });
    const first = await createSupportRequest(prisma, input, { id: customer.id });
    const second = await createSupportRequest(prisma, input, { id: customer.id });
    assert(!("error" in first) && !("error" in second));
    assert.equal(first.protocol, second.protocol);
    assert.equal(second.created, false);
    assert.equal(await prisma.supportRequest.count(), 1);
    const row = await prisma.supportRequest.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual([row.productId, row.productTitleSnapshot, row.orderId, row.orderNumberSnapshot, row.status], [product.id, "Jaqueta QA", ownOrder.id, ownOrder.orderNumber, "PENDING"]);
    pass("persisted before any e-mail, product/order resolved on the server, double submit = 1 request with the same protocol");

    // 2. No IDOR: another customer's order (or any order without a session) is refused, nothing stored.
    assert.deepEqual(await createSupportRequest(prisma, submission({ orderId: strangerOrder.id }), { id: customer.id }), { error: "order_not_found" });
    assert.deepEqual(await createSupportRequest(prisma, submission({ orderId: ownOrder.id }), null), { error: "order_not_found" });
    assert.equal(await prisma.supportRequest.count(), 1);
    pass("an order that is not the signed-in customer's cannot be attached; nothing is stored");

    // 3. E-mail disabled: the request stays PENDING, nothing is lost.
    assert.equal(await deliverSupportRequest(prisma, first.id, { env: { ...env, EMAIL_DRIVER: "disabled" } }), "disabled");
    assert.equal((await prisma.supportRequest.findUniqueOrThrow({ where: { id: first.id } })).status, "PENDING");
    pass("with e-mail disabled the request is kept as PENDING");

    // 4. Provider outage (retryable): stays PENDING with backoff, then a retry sends once.
    failure = new EmailDeliveryError("retry", "ResendServerError");
    await deliverSupportRequest(prisma, first.id, { env, provider });
    let current = await prisma.supportRequest.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual([current.status, current.lastErrorCode, current.attempts], ["PENDING", "ResendServerError", 1]);
    assert(current.nextAttemptAt > new Date());
    assert.equal(sent.length, 0);
    failure = null;
    await prisma.supportRequest.update({ where: { id: first.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    await processSupportRequests(prisma, { env, provider });
    current = await prisma.supportRequest.findUniqueOrThrow({ where: { id: first.id } });
    assert.deepEqual([current.status, current.confirmationStatus], ["SENT", "SENT"]);
    assert(current.emailSentAt && current.confirmationSentAt);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map((mail) => [mail.to, mail.replyTo]), [["suporte@raredept.com.br", "qa.cliente@homologacao.rare.invalid"], ["qa.cliente@homologacao.rare.invalid", "suporte@raredept.com.br"]]);
    assert.deepEqual(sent.map((mail) => mail.messageId), [supportMessageId(first.id, "team"), supportMessageId(first.id, "customer")]);
    assert.match(sent[0].subject, /^\[RARE Suporte\] SUP-[2-9A-HJKMNP-Z]{8} — Peça vendida ou esgotada$/);
    pass("provider outage keeps the request PENDING; the next attempt sends team e-mail (Reply-To = customer) then the confirmation, once each");

    // 5. Nothing is sent twice: processing again, or two workers at the same time.
    await processSupportRequests(prisma, { env, provider });
    const parallel = await createSupportRequest(prisma, submission(), { id: customer.id });
    assert(!("error" in parallel));
    await Promise.all([deliverSupportRequest(prisma, parallel.id, { env, provider }), deliverSupportRequest(prisma, parallel.id, { env, provider }), processSupportRequests(prisma, { env, provider })]);
    assert.equal(sent.filter((mail) => mail.messageId === supportMessageId(parallel.id, "team")).length, 1);
    assert.equal(sent.filter((mail) => mail.messageId === supportMessageId(parallel.id, "customer")).length, 1);
    assert.equal(sent.length, 4);
    pass("re-processing and concurrent workers send each e-mail exactly once (lease + idempotency id)");

    // 6. Permanent failure: FAILED and kept; operator retry re-sends with the same idempotency id.
    const broken = await createSupportRequest(prisma, submission(), { id: customer.id });
    assert(!("error" in broken));
    failure = new EmailDeliveryError("failed", "ResendForbidden");
    await deliverSupportRequest(prisma, broken.id, { env, provider });
    assert.deepEqual(await prisma.supportRequest.findUniqueOrThrow({ where: { id: broken.id }, select: { status: true, lastErrorCode: true } }), { status: "FAILED", lastErrorCode: "ResendForbidden" });
    await processSupportRequests(prisma, { env, provider });
    assert.equal(sent.length, 4, "a FAILED request is not retried automatically");
    failure = null;
    assert.equal(await retrySupportRequest(prisma, broken.id), true);
    await deliverSupportRequest(prisma, broken.id, { env, provider });
    assert.equal((await prisma.supportRequest.findUniqueOrThrow({ where: { id: broken.id } })).status, "SENT");
    assert.equal(sent.filter((mail) => mail.messageId === supportMessageId(broken.id, "team")).length, 1);
    pass("a permanent provider failure is FAILED and kept; the operator retry sends it once");

    // 7. Staging safety: a customer outside the test allowlist gets no confirmation (team still gets it).
    const outsider = await createSupportRequest(prisma, submission({ email: "real.person@example.com" }), null);
    assert(!("error" in outsider));
    await deliverSupportRequest(prisma, outsider.id, { env, provider });
    const outsiderRow = await prisma.supportRequest.findUniqueOrThrow({ where: { id: outsider.id } });
    assert.deepEqual([outsiderRow.status, outsiderRow.confirmationStatus, outsiderRow.confirmationErrorCode], ["SENT", "FAILED", "EmailRecipientNotAllowlisted"]);
    assert(!sent.some((mail) => mail.to === "real.person@example.com"));
    pass("in test mode a non-allowlisted customer is never e-mailed; the team copy still goes out");

    // 8. RARE10: never-paid orders keep the benefit; any confirmed payment consumes it for good.
    const eligible = async (customerId: string) => {
      const count = await prisma.order.count({ where: firstOrderCouponConsumedWhere(customerId) });
      try {
        getFirstOrderCouponDiscount({ code: "RARE10", subtotalInCents: 10_000, paidOrderCount: count });
        return true;
      } catch {
        return false;
      }
    };
    const fresh = await prisma.customer.create({ data: { name: "QA Novo", email: `qa.novo.${randomBytes(3).toString("hex")}@homologacao.rare.invalid`, passwordHash: "x" } });
    assert.equal(await eligible(fresh.id), true, "new customer");
    await order(fresh.id, "awaiting_payment", null);
    await order(fresh.id, "failed", null);
    await order(fresh.id, "canceled", null);
    assert.equal(await eligible(fresh.id), true, "pending / failed / canceled before payment");
    const paid = await order(fresh.id, "paid", new Date());
    assert.equal(await eligible(fresh.id), false, "paid");
    await prisma.order.update({ where: { id: paid.id }, data: { refundRequestedAt: new Date() } });
    assert.equal(await eligible(fresh.id), false, "paid with a refund requested (partial or pending)");
    await prisma.order.update({ where: { id: paid.id }, data: { status: "refunded" } });
    assert.equal(await eligible(fresh.id), false, "paid then refunded");
    await prisma.order.update({ where: { id: paid.id }, data: { status: "canceled" } });
    assert.equal(await eligible(fresh.id), false, "paid then canceled");
    const legacy = await prisma.customer.create({ data: { name: "QA Legado", email: `qa.legado.${randomBytes(3).toString("hex")}@homologacao.rare.invalid`, passwordHash: "x" } });
    await order(legacy.id, "paid", null);
    assert.equal(await eligible(legacy.id), false, "legacy paid order without paidAt");
    pass("RARE10: new / pending / failed / canceled-before-payment eligible; paid, refund requested, refunded, canceled after payment or legacy paid not eligible");

    console.log(`\n${results.length} proofs passed.`);
  } finally {
    await database?.$disconnect().catch(() => undefined);
    if (created) {
      await maintenance.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName]).catch(() => undefined);
      await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
    }
    await maintenance.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
