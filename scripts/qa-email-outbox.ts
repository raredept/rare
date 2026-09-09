import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";
import { EmailDeliveryError, type TransactionalEmailProvider } from "../src/lib/transactional-email";

// Local disposable PostgreSQL only. All provider sends are in-process doubles.
async function main() {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const name = `rare_qa_email_${Date.now()}_${randomBytes(3).toString("hex")}`;
  assert(/^rare_qa_email_[a-z0-9_]+$/.test(name));
  const maintenanceUrl = new URL(source);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = new pg.Client({ connectionString: maintenanceUrl.toString() });
  let created = false;
  let database: Awaited<typeof import("../src/lib/prisma")>["prisma"] | undefined;
  await maintenance.connect();
  try {
    await maintenance.query(`CREATE DATABASE "${name}"`);
    created = true;
    source.pathname = `/${name}`;
    process.env.DATABASE_URL = source.toString();
    process.env.APP_ENV = "test";
    process.env.EMAIL_DRIVER = "disabled";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume(); child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Isolated migration failed.")));
    });
    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const { enqueuePaidOrderEmail } = await import("../src/lib/email-outbox");
    const { createEmailOutboxRepository, processEmailOutbox } = await import("../src/lib/email-outbox-worker");
    const repository = createEmailOutboxRepository(prisma);
    const env = {
      EMAIL_DRIVER: "smtp", APP_ENV: "test", EMAIL_DELIVERY_MODE: "test",
      EMAIL_TEST_RECIPIENTS: "controlled@example.com", EMAIL_SEND_NOT_BEFORE: "1970-01-01T00:00:00.000Z",
      SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_USER: "sender@example.com",
      SMTP_PASSWORD: "synthetic-not-a-credential", EMAIL_FROM_ORDERS: "sender@example.com",
    };
    let time = Date.now();
    const now = () => new Date(time);
    const sentIds: string[] = [];
    const accepted: TransactionalEmailProvider = { name: "smtp", async send(_message, id) { sentIds.push(id); return { id }; } };
    const run = (provider = accepted, extra: Partial<Parameters<typeof processEmailOutbox>[0]> = {}) => processEmailOutbox({ repository, provider, env, now, batchSize: 1, ...extra });
    const proofs: string[] = [];
    let sequence = 0;
    async function order(recipient = "controlled@example.com") {
      const value = await prisma.order.create({ data: { orderNumber: `EMAIL-QA-${++sequence}`, subtotalInCents: 1000, shippingInCents: 0, totalInCents: 1000, status: "paid", customerNameSnapshot: "Synthetic QA", customerEmailSnapshot: recipient } });
      await prisma.$transaction((tx) => enqueuePaidOrderEmail(tx, value));
      const queued = await prisma.emailOutbox.findUniqueOrThrow({ where: { orderId_kind: { orderId: value.id, kind: "payment_approved" } } });
      // Use the database's due timestamp, not a guess that setup takes <1s.
      // The controlled clock remains deterministic on loaded CI machines.
      time = Math.max(time, queued.nextAttemptAt.getTime());
      return value;
    }
    const first = await order();
    await Promise.all(Array.from({ length: 8 }, () => prisma.$transaction((tx) => enqueuePaidOrderEmail(tx, first))));
    assert.equal(await prisma.emailOutbox.count(), 1);
    proofs.push("nine_duplicate_enqueues_one_row");

    await assert.rejects(prisma.$transaction(async (tx) => {
      const value = await tx.order.create({ data: { orderNumber: "EMAIL-QA-ROLLBACK", subtotalInCents: 1000, shippingInCents: 0, totalInCents: 1000, status: "paid" } });
      await enqueuePaidOrderEmail(tx, value);
      throw new Error("forced transaction rollback");
    }), /forced transaction rollback/);
    assert.equal(await prisma.order.count({ where: { orderNumber: "EMAIL-QA-ROLLBACK" } }), 0);
    assert.equal(await prisma.emailOutbox.count(), 1);
    proofs.push("order_and_email_enqueue_roll_back_together");

    const disabled = await run(accepted, { env: { EMAIL_DRIVER: "disabled" } });
    assert.equal(disabled.disabled, true);
    assert.equal((await prisma.emailOutbox.findFirstOrThrow()).attempts, 0);
    const races = await Promise.all(Array.from({ length: 8 }, () => run()));
    assert.equal(races.reduce((sum, value) => sum + value.claimed, 0), 1);
    assert.equal(sentIds.length, 1);
    assert.equal((await prisma.emailOutbox.findFirstOrThrow()).status, "accepted");
    proofs.push("disabled_does_not_claim_and_eight_workers_send_once");

    const retryOrder = await order();
    const rejectedIds: string[] = [];
    const temporary: TransactionalEmailProvider = { name: "smtp", async send(_message, id) { rejectedIds.push(id); throw new EmailDeliveryError("retry", "SmtpTemporaryRejection"); } };
    assert.equal((await run(temporary)).retry, 1);
    assert.equal((await run()).claimed, 0);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: retryOrder.id } })).status, "paid");
    time += 61_000;
    assert.equal((await run()).accepted, 1);
    assert.equal(sentIds.at(-1), rejectedIds[0]);
    proofs.push("explicit_temporary_rejection_retries_after_backoff_same_message_id_payment_stays_paid");

    const ambiguous = await order();
    const unknown: TransactionalEmailProvider = { name: "smtp", async send() { throw new Error("private SMTP response"); } };
    assert.equal((await run(unknown)).uncertain, 1);
    assert.equal((await run()).claimed, 0);
    const uncertain = await prisma.emailOutbox.findFirstOrThrow({ where: { orderId: ambiguous.id } });
    assert.equal(uncertain.lastErrorCode, "UnclassifiedProviderFailure");
    assert.equal(JSON.stringify(uncertain).includes("private SMTP response"), false);
    proofs.push("ambiguous_smtp_response_is_manual_review_without_retry_or_secret_persistence");

    const lostAck = await order();
    const before = sentIds.length;
    await assert.rejects(run(accepted, { repository: { ...repository, async finish() { throw new Error("database acknowledgement lost"); } } }), /acknowledgement lost/);
    assert.equal(sentIds.length, before + 1);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: lostAck.id } })).status, "paid");
    time += 5 * 60_000 + 1;
    assert.equal((await run()).abandoned, 1);
    assert.equal((await prisma.emailOutbox.findFirstOrThrow({ where: { orderId: lostAck.id } })).status, "uncertain");
    assert.equal(sentIds.length, before + 1);
    proofs.push("lost_database_ack_after_smtp_acceptance_expires_to_uncertain_without_resend");

    await order("outside@example.com");
    const beforeAllowlist = sentIds.length;
    assert.equal((await run()).failed, 1);
    assert.equal(sentIds.length, beforeAllowlist);
    proofs.push("recipient_outside_test_allowlist_never_reaches_provider");

    const exhausted = await order();
    await prisma.emailOutbox.updateMany({ where: { orderId: exhausted.id }, data: { attempts: 4 } });
    assert.equal((await run(temporary)).failed, 1);
    assert.equal((await prisma.emailOutbox.findFirstOrThrow({ where: { orderId: exhausted.id } })).lastErrorCode, "RetryLimitReached");
    proofs.push("retry_budget_ends_in_failed_for_manual_review");

    const stale = await order();
    const claim = await repository.claim(now(), new Date(0));
    assert.equal(claim?.orderId, stale.id);
    assert(claim);
    time += 5 * 60_000 + 1;
    assert.equal(await repository.recoverAbandoned(now()), 1);
    assert.equal(await repository.finish(claim, { status: "accepted", provider: "smtp", id: claim.messageId }, now()), "uncertain");
    assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: claim.id } })).status, "uncertain");
    proofs.push("late_worker_cannot_overwrite_recovered_lease");

    await order();
    assert.equal((await run(accepted, { env: { ...env, EMAIL_SEND_NOT_BEFORE: new Date(time + 60_000).toISOString() } })).claimed, 0);
    proofs.push("explicit_activation_cutoff_does_not_flush_historical_backlog");

    // Exercise the operator CLI against this same disposable database. Reviewing
    // an ambiguous result must not send, touch a settled row twice, or ignore the
    // activation cutoff when an explicitly rejected message becomes retryable.
    async function review(args: string[]) {
      return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/review-email-outbox.ts", ...args], { env: process.env, windowsHide: true, stdio: "pipe" });
        let output = "";
        child.stdout.on("data", (chunk) => { output += String(chunk); });
        child.stderr.resume();
        child.once("error", reject);
        child.once("exit", (code) => resolve({ code, output }));
      });
    }
    const sentBeforeReview = sentIds.length;
    const acceptedReview = await review([uncertain.id, "accepted", "qa/confirmed-acceptance"]);
    assert.equal(acceptedReview.code, 0);
    assert.deepEqual(JSON.parse(acceptedReview.output), { reviewed: 1, resolution: "accepted" });
    const reviewed = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: uncertain.id } });
    assert.equal(reviewed.status, "accepted");
    assert.equal(reviewed.attempts, uncertain.attempts);
    assert(reviewed.acceptedAt && reviewed.reviewedAt);
    assert.equal(reviewed.reviewNote, "accepted:qa/confirmed-acceptance");
    assert.notEqual((await review([uncertain.id, "retry", "qa/already-settled"])).code, 0);
    assert.equal((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: uncertain.id } })).status, "accepted");

    const exhaustedRow = await prisma.emailOutbox.findFirstOrThrow({ where: { orderId: exhausted.id } });
    assert.equal((await review([exhaustedRow.id, "retry", "qa/rejection-investigated"])).code, 0);
    const retryReviewed = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: exhaustedRow.id } });
    assert.equal(retryReviewed.status, "retry");
    assert.equal(retryReviewed.attempts, 0);
    assert.equal(retryReviewed.acceptedAt, null);
    assert.equal(retryReviewed.reviewNote, "retry:qa/rejection-investigated");
    assert.equal((await run(accepted, { env: { ...env, EMAIL_SEND_NOT_BEFORE: new Date(time + 60_000).toISOString() } })).claimed, 0);
    assert.notEqual((await review([retryReviewed.id, "accepted", "invalid@example.com"])).code, 0);
    assert.equal(sentIds.length, sentBeforeReview);
    proofs.push("manual_review_cli_records_evidence_rejects_settled_rows_and_preserves_activation_cutoff_without_sending");
    console.log(`EMAIL_OUTBOX_QA=${JSON.stringify({ database: name, proofs, externalProviderCalls: 0 })}`);
  } finally {
    await database?.$disconnect();
    if (created) {
      await maintenance.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [name]);
      await maintenance.query(`DROP DATABASE "${name}"`);
      console.log("EMAIL_QA_DATABASE_REMOVED=true");
    }
    await maintenance.end();
  }
}

main().catch((error: unknown) => {
  // Keep actionable source location without printing SMTP or database messages.
  const location = error instanceof Error ? error.stack?.match(/qa-email-outbox\.ts:\d+:\d+/)?.[0] : undefined;
  console.error(JSON.stringify({ error: "EmailOutboxQaFailed", location, externalProviderCalls: 0 }));
  process.exitCode = 1;
});
