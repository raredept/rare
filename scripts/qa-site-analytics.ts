import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

// Real PostgreSQL, synthetic data, disposable database. Proves on the real SQL that the analytics
// table has no personal-data column, that the dashboard aggregates are right, that purchase /
// checkout / payment come from the orders (never from posted events) and that retention deletes.
// Refuses any non-local database.

async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_analytics_${Date.now()}_${randomBytes(3).toString("hex")}`;
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
      DATABASE_URL: source.toString(), APP_ENV: "test", NODE_ENV: "test", APP_URL: "http://localhost:3000",
      ADMIN_SESSION_SECRET: randomBytes(36).toString("base64url"), RATE_LIMIT_DRIVER: "memory", EMAIL_DRIVER: "disabled",
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume();
      child.stderr.resume();
      child.once("error", reject);
      child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("Isolated migration failed."))));
    });

    const { prisma } = await import("../src/lib/prisma");
    database = prisma;
    const { recordClientAnalyticsEvents, purgeExpiredSiteAnalyticsEvents, SITE_ANALYTICS_RETENTION_DAYS } = await import("../src/lib/site-analytics");
    const { parseAnalyticsBatch } = await import("../src/lib/site-analytics-events");
    const { getSiteAnalyticsReport } = await import("../src/lib/site-analytics-report");
    const { resolveAnalyticsPeriod } = await import("../src/lib/analytics-period");
    const results: string[] = [];
    const pass = (name: string) => { results.push(name); console.log(`PASS ${name}`); };

    // 1. Schema: only the contract columns, nothing personal.
    const columns = (await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'SiteAnalyticsEvent' ORDER BY column_name`).map((row) => row.column_name);
    assert.deepEqual(columns, ["createdAt", "device", "id", "path", "productId", "sessionHash", "type", "visitorHash"]);
    assert(!columns.some((name) => /ip|agent|email|cpf|phone|name|customer|order/i.test(name)));
    pass("SiteAnalyticsEvent has no IP, user agent, e-mail, CPF, phone, name, customer or order column");

    // Catalog and orders.
    const product = async (title: string) => prisma.product.create({
      data: { title, slug: `qa-${randomBytes(4).toString("hex")}`, description: "QA", shortDescription: "QA", priceInCents: 10_000, variants: { create: [{ size: "M", stock: 10 }] } },
      include: { variants: true },
    });
    const [jacket, shirt] = [await product("Jaqueta QA"), await product("Camiseta QA")];
    const order = (status: "awaiting_payment" | "paid" | "canceled", extra: Record<string, unknown> = {}) => prisma.order.create({
      data: {
        orderNumber: `QA-AN-${randomBytes(3).toString("hex")}`, subtotalInCents: 10_000, totalInCents: 10_000, status, ...extra,
        items: { create: [{ productId: jacket.id, variantId: jacket.variants[0].id, productTitleSnapshot: "Jaqueta QA", sizeSnapshot: "M", quantity: 2, unitPriceInCents: 5_000, totalInCents: 10_000 }] },
      },
    });
    await order("awaiting_payment"); // checkout started, no payment yet
    await order("canceled", { asaasPaymentId: `pay_${randomBytes(6).toString("hex")}` }); // payment started, never paid
    await order("paid", { asaasPaymentId: `pay_${randomBytes(6).toString("hex")}`, paidAt: new Date() }); // purchase confirmed

    // Two consented visitors, three sessions.
    const [visitorA, visitorB, sessionA1, sessionA2, sessionB] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const post = (v: string, s: string, events: unknown[]) => {
      const batch = parseAnalyticsBatch({ v, s, events });
      assert(batch);
      return recordClientAnalyticsEvents(batch, "mobile");
    };
    await post(visitorA, sessionA1, [
      { type: "page_view", path: "/" }, { type: "product_click", path: "/", productId: jacket.id },
      { type: "product_view", path: `/produto/${jacket.slug}`, productId: jacket.id }, { type: "add_to_cart", path: `/produto/${jacket.slug}`, productId: jacket.id },
      // A forged purchase from the browser is not part of the contract and never stored.
      { type: "purchase_confirmed", path: "/pedido", productId: jacket.id },
    ]);
    await post(visitorA, sessionA2, [{ type: "page_view", path: "/categoria/tudo" }, { type: "product_view", path: `/produto/${shirt.slug}`, productId: shirt.id }]);
    const unknown = await post(visitorB, sessionB, [{ type: "page_view", path: "/" }, { type: "product_view", path: "/produto/x", productId: "cmnotarealproduct001" }]);
    assert.deepEqual(unknown, { stored: 1, dropped: 1 });

    const stored = await prisma.siteAnalyticsEvent.findMany();
    assert.equal(stored.length, 7); // 4 + 2 + 1: the forged purchase and the unknown product are dropped
    assert(stored.every((row) => /^[0-9a-f]{32}$/.test(row.visitorHash) && /^[0-9a-f]{32}$/.test(row.sessionHash)));
    assert(!JSON.stringify(stored).includes(visitorA) && !JSON.stringify(stored).includes(sessionA1));
    assert(!stored.some((row) => row.type === "purchase_confirmed"));
    pass("only allowlisted events of existing products are stored, with keyed hashes instead of the browser ids");

    const report = await getSiteAnalyticsReport(resolveAnalyticsPeriod({ preset: "today" }));
    assert.deepEqual(report.totals, { visitors: 2, sessions: 3, pageViews: 3, productViews: 2, productClicks: 1, addToCart: 1, checkoutStarted: 3, paymentStarted: 2, purchaseConfirmed: 1 });
    assert.equal(report.sessionConversion, 1 / 3);
    assert.equal(report.checkoutConversion, 1 / 3);
    assert.deepEqual(report.topViewed.map((entry) => [entry.label, entry.count]).sort(), [["Camiseta QA", 1], ["Jaqueta QA", 1]]);
    assert.deepEqual(report.topClicked.map((entry) => [entry.label, entry.count]), [["Jaqueta QA", 1]]);
    assert.deepEqual(report.topSold.map((entry) => [entry.label, entry.count]), [["Jaqueta QA", 2]]);
    assert.deepEqual(report.devices, [{ device: "mobile", sessions: 3 }]);
    assert.equal(report.daily.length, 1);
    pass("dashboard: visits, sessions, page/product views, clicks, add to cart, funnel, conversion and tops are exact");
    pass("checkout started / payment started / purchase confirmed come from the orders on the server, not from events");

    // Retention.
    await prisma.siteAnalyticsEvent.updateMany({ where: { type: "page_view" }, data: { createdAt: new Date(Date.now() - (SITE_ANALYTICS_RETENTION_DAYS + 1) * 86_400_000) } });
    const purged = await purgeExpiredSiteAnalyticsEvents(Date.now(), true);
    assert.equal(purged, 3);
    assert.equal(await prisma.siteAnalyticsEvent.count({ where: { type: "page_view" } }), 0);
    pass(`retention deletes events older than ${SITE_ANALYTICS_RETENTION_DAYS} days`);

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
