import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import pg from "pg";

// Real PostgreSQL, synthetic catalog, disposable database. Proves on the real SQL (not on mocks)
// that a one-of-a-kind piece is never critical by quantity, that the only critical state of a
// UNIQUE piece is an inconsistency, and that replenishable items keep their quantity levels.
// Refuses any non-local database.

async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_inventory_${Date.now()}_${randomBytes(3).toString("hex")}`;
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
    const { getInventoryIntegrityReport } = await import("../src/lib/inventory-integrity");
    const { getCriticalStock, getInventorySummary } = await import("../src/lib/admin-analytics");
    const { getAdminProductRows, getAdminProductSummary } = await import("../src/lib/admin-products-data");
    const { buildCatalogIssues } = await import("../src/lib/admin-catalog-issues");
    const { buildAdminReadiness } = await import("../src/lib/admin-readiness");
    const results: string[] = [];
    const pass = (name: string) => { results.push(name); console.log(`PASS ${name}`); };

    let counter = 0;
    type Policy = "UNIQUE" | "STANDARD";
    const product = async (policy: Policy, variants: Array<{ stock: number; reservedStock?: number; active?: boolean }>, active = true) => {
      counter += 1;
      const created = await prisma.product.create({
        data: {
          title: `QA ${policy} ${counter}`, slug: `qa-${policy.toLowerCase()}-${counter}-${randomBytes(3).toString("hex")}`,
          description: "Produto sintético de QA.", shortDescription: "QA", priceInCents: 10_000, active, stockPolicy: policy,
          weightGrams: 300, lengthCm: 20, widthCm: 20, heightCm: 5,
          images: { create: [{ url: "/seed-products/qa.svg", alt: "QA" }] },
          variants: { create: variants.map((variant, index) => ({ size: `T${index + 1}`, stock: variant.stock, reservedStock: variant.reservedStock ?? 0, active: variant.active ?? true })) },
        },
        include: { variants: { orderBy: { size: "asc" } } },
      });
      return created;
    };
    type OrderStatus = "awaiting_payment" | "paid" | "refunded" | "canceled" | "delivered";
    const order = async (item: { productId: string; variantId: string }, status: OrderStatus, quantity = 1) => {
      counter += 1;
      await prisma.order.create({
        data: {
          orderNumber: `QA-INV-${counter}-${randomBytes(2).toString("hex")}`, subtotalInCents: 10_000 * quantity, totalInCents: 10_000 * quantity, status,
          paidAt: status === "paid" || status === "delivered" ? new Date() : null,
          items: { create: [{ productId: item.productId, variantId: item.variantId, productTitleSnapshot: "QA", sizeSnapshot: "T1", quantity, unitPriceInCents: 10_000, totalInCents: 10_000 * quantity }] },
        },
      });
    };
    const ref = (created: Awaited<ReturnType<typeof product>>) => ({ productId: created.id, variantId: created.variants[0].id });
    const stateOf = async (productId: string) => {
      const report = await getInventoryIntegrityReport([productId]);
      assert.equal(report.products.length, 1);
      return report.products[0];
    };
    const isCriticalByQuantity = async (productId: string) => (await getCriticalStock()).some((entry) => entry.productId === productId);
    const reset = async () => {
      await prisma.order.deleteMany({});
      await prisma.product.deleteMany({});
    };

    // 1. Additive migration.
    const values = await prisma.$queryRaw<Array<{ value: string }>>`SELECT unnest(enum_range(NULL::"StockPolicy"))::text AS value`;
    assert.deepEqual(values.map((row) => row.value).sort(), ["STANDARD", "UNIQUE"]);
    const [column] = await prisma.$queryRaw<Array<{ column_default: string; is_nullable: string }>>`
      SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'stockPolicy'`;
    assert.match(column.column_default, /STANDARD/);
    assert.equal(column.is_nullable, "NO");
    pass("migration adds Product.stockPolicy (NOT NULL, default STANDARD): existing products keep their behaviour");

    // 2. UNIQUE with its single unit: available, never critical or low.
    const available = await product("UNIQUE", [{ stock: 1 }]);
    assert.equal((await stateOf(available.id)).state, "available");
    assert.equal(await isCriticalByQuantity(available.id), false);
    let summary = await getInventorySummary();
    assert.deepEqual([summary.lowStockVariants, summary.soldOutVariants, summary.soldOutActiveProducts, summary.uniqueAvailableProducts, summary.uniqueUnavailableProducts], [0, 0, 0, 1, 0]);
    assert.equal((await getAdminProductSummary()).lowStock, 0);
    pass("UNIQUE with 1 unit: available, absent from the critical list, not counted as low stock");

    // 3. UNIQUE reserved by an open checkout.
    await prisma.productVariant.update({ where: { id: available.variants[0].id }, data: { reservedStock: 1 } });
    await order(ref(available), "awaiting_payment");
    assert.equal((await stateOf(available.id)).state, "reserved");
    assert.equal(await isCriticalByQuantity(available.id), false);
    pass("UNIQUE with its unit held by an open checkout: reserved, not critical");

    // 4. UNIQUE sold: zero units after the sale.
    await prisma.order.updateMany({ data: { status: "paid", paidAt: new Date() } });
    await prisma.productVariant.update({ where: { id: available.variants[0].id }, data: { stock: 0, reservedStock: 0 } });
    const sold = await stateOf(available.id);
    assert.equal(sold.state, "sold");
    assert.deepEqual(sold.inconsistencies, []);
    assert.equal(await isCriticalByQuantity(available.id), false);
    summary = await getInventorySummary();
    assert.deepEqual([summary.soldOutVariants, summary.soldOutActiveProducts, summary.uniqueAvailableProducts, summary.uniqueUnavailableProducts], [0, 0, 0, 1]);
    const catalogProducts = async () => prisma.product.findMany({
      select: { id: true, title: true, active: true, stockPolicy: true, weightGrams: true, lengthCm: true, widthCm: true, heightCm: true, images: { select: { url: true } }, variants: { select: { active: true, stock: true, reservedStock: true } } },
    });
    assert.deepEqual(buildCatalogIssues({ products: await catalogProducts(), categories: [] }).filter((issue) => issue.id.endsWith(`:${available.id}`)), []);
    let readiness = buildAdminReadiness({ env: {}, settings: null, products: await catalogProducts(), categories: [], inventoryIntegrity: await getInventoryIntegrityReport() });
    assert.equal(readiness.items.some((item) => item.id.includes(available.id)), false);
    assert.equal(readiness.items.find((item) => item.id === "inventory-integrity")?.severity, "ok");
    pass("UNIQUE with 0 after the sale: sold, not critical, no catalog issue, readiness inventory ok");

    // 5. A refunded sale returns the unit without an inconsistency.
    await prisma.order.updateMany({ data: { status: "refunded" } });
    await prisma.productVariant.update({ where: { id: available.variants[0].id }, data: { stock: 1 } });
    assert.equal((await stateOf(available.id)).state, "available");
    pass("UNIQUE refunded and restocked: available again, no inconsistency");

    // 6. Every inconsistency is critical, and blocks readiness.
    await reset();
    const cases: Array<{ name: string; expected: string; build: () => Promise<string> }> = [
      { name: "double sale", expected: "unique_double_sale", build: async () => { const item = await product("UNIQUE", [{ stock: 0 }]); await order(ref(item), "paid"); await order(ref(item), "delivered"); return item.id; } },
      { name: "double reservation", expected: "unique_double_reservation", build: async () => { const item = await product("UNIQUE", [{ stock: 1, reservedStock: 1 }]); await order(ref(item), "awaiting_payment"); await order(ref(item), "awaiting_payment"); return item.id; } },
      { name: "sold but purchasable", expected: "unique_sold_but_purchasable", build: async () => { const item = await product("UNIQUE", [{ stock: 1 }]); await order(ref(item), "paid"); return item.id; } },
      { name: "negative stock", expected: "negative_stock", build: async () => (await product("UNIQUE", [{ stock: -1 }])).id },
      { name: "negative reservation", expected: "negative_reserved", build: async () => (await product("UNIQUE", [{ stock: 1, reservedStock: -1 }])).id },
      { name: "reservation above the physical unit", expected: "reserved_exceeds_stock", build: async () => { const item = await product("UNIQUE", [{ stock: 0, reservedStock: 1 }]); await order(ref(item), "awaiting_payment"); return item.id; } },
      { name: "reservation without an open order", expected: "reservation_mismatch", build: async () => (await product("UNIQUE", [{ stock: 1, reservedStock: 1 }])).id },
      { name: "open order without its reservation", expected: "reservation_mismatch", build: async () => { const item = await product("UNIQUE", [{ stock: 1 }]); await order(ref(item), "awaiting_payment"); return item.id; } },
      { name: "more than one unit", expected: "unique_multiple_units", build: async () => (await product("UNIQUE", [{ stock: 2 }])).id },
    ];
    for (const scenario of cases) {
      const productId = await scenario.build();
      const entry = await stateOf(productId);
      assert.equal(entry.state, "inconsistent", scenario.name);
      assert((entry.inconsistencies as string[]).includes(scenario.expected), `${scenario.name}: ${entry.inconsistencies.join(",")}`);
      readiness = buildAdminReadiness({ env: {}, settings: null, products: await catalogProducts(), categories: [], inventoryIntegrity: await getInventoryIntegrityReport([productId]) });
      const item = readiness.items.find((current) => current.id === `inventory:${productId}`);
      assert.equal(item?.severity, "blocked", scenario.name);
      assert.equal(item?.blocksOpenSales, true, scenario.name);
    }
    pass(`UNIQUE inconsistencies are critical and block readiness: ${cases.map((scenario) => scenario.name).join(", ")}`);

    // 7. STANDARD keeps its quantity levels.
    await reset();
    const levels: Array<[number, string]> = [[10, "available"], [3, "low"], [2, "low"], [1, "critical"], [0, "sold_out"]];
    const standardIds: Record<string, string> = {};
    for (const [stock, expected] of levels) {
      const item = await product("STANDARD", [{ stock }]);
      standardIds[`${stock}`] = item.id;
      assert.equal((await stateOf(item.id)).state, expected, `STANDARD ${stock}`);
    }
    const critical = await getCriticalStock();
    assert.deepEqual(critical.map((entry) => [entry.sellable, entry.level]), [[0, "sold_out"], [1, "critical"], [2, "low"], [3, "low"]]);
    summary = await getInventorySummary();
    assert.deepEqual([summary.lowStockVariants, summary.soldOutVariants, summary.soldOutActiveProducts], [3, 1, 1]);
    const heavy = await product("STANDARD", [{ stock: 12, reservedStock: 3 }]);
    for (let index = 0; index < 3; index += 1) await order(ref(heavy), "awaiting_payment");
    for (let index = 0; index < 4; index += 1) await order(ref(heavy), "paid", 5);
    assert.deepEqual((await stateOf(heavy.id)).inconsistencies, []);
    pass("STANDARD keeps normal / low / critical / sold out; many sales and reservations are not an inconsistency");

    // 8. Admin list filters separate the two policies.
    const uniqueOne = await product("UNIQUE", [{ stock: 1 }]);
    const uniqueSold = await product("UNIQUE", [{ stock: 0 }]);
    await order(ref(uniqueSold), "paid");
    const ids = async (stock: "low" | "out" | "unique" | "unique-unavailable") => (await getAdminProductRows({ page: 1, stock })).products.map((row) => row.id).sort();
    assert.deepEqual(await ids("low"), [standardIds["3"], standardIds["2"], standardIds["1"]].sort());
    assert.deepEqual(await ids("out"), [standardIds["0"]]);
    assert.deepEqual(await ids("unique"), [uniqueOne.id, uniqueSold.id].sort());
    assert.deepEqual(await ids("unique-unavailable"), [uniqueSold.id]);
    assert.equal((await getAdminProductSummary()).lowStock, 3);
    pass("Admin filters: low / out list only replenishable items; unique pieces have their own filters");

    // 9. The real reservation guard: two checkouts race for the single unit, one wins.
    const raced = await product("UNIQUE", [{ stock: 1 }]);
    const reserve = () => prisma.$executeRaw`
      UPDATE "ProductVariant" SET "reservedStock" = "reservedStock" + 1, "updatedAt" = NOW()
      WHERE "id" = ${raced.variants[0].id} AND "active" = true AND ("stock" - "reservedStock") >= 1`;
    for (let round = 0; round < 15; round += 1) {
      await prisma.productVariant.update({ where: { id: raced.variants[0].id }, data: { reservedStock: 0 } });
      const outcomes = await Promise.all([reserve(), reserve(), reserve()]);
      assert.equal(outcomes.reduce((total, count) => total + count, 0), 1, `round ${round}`);
      const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: raced.variants[0].id } });
      assert.deepEqual([variant.stock, variant.reservedStock], [1, 1]);
    }
    pass("15x three checkouts racing for a UNIQUE piece: exactly one reservation, never a double one");

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
