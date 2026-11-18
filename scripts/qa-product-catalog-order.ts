import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// RARE-PRODUCT-CATALOG-ORDER-01. Disposable local PostgreSQL only: proves that the position typed in
// the Admin is the place the piece takes in the storefront, that concurrent moves never leave
// duplicate/skipped positions, and that renumbering does not touch updatedAt.
//   QA_DATABASE_URL=postgresql://user:pass@localhost:port/postgres npx tsx scripts/qa-product-catalog-order.ts
async function main() {
  const source = new URL(process.env.QA_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_order_${Date.now()}_${randomBytes(3).toString("hex")}`;
  assert(/^rare_qa_order_[a-z0-9_]+$/.test(databaseName));
  const maintenanceUrl = new URL(source); maintenanceUrl.pathname = "/postgres";
  const maintenance = new pg.Client({ connectionString: maintenanceUrl.toString() });
  let created = false;
  let database: Awaited<typeof import("../src/lib/prisma")>["prisma"] | undefined;
  const proofs: string[] = [];
  const evidence: Record<string, unknown> = { observedAt: new Date().toISOString(), databaseName, source: "synthetic local disposable PostgreSQL", proofs };
  await maintenance.connect();
  try {
    await maintenance.query(`CREATE DATABASE "${databaseName}"`); created = true;
    source.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = source.toString();
    process.env.APP_ENV = "test";
    process.env.CHECKOUT_ENABLED = "false";
    process.env.SHIPPING_ENABLED = "false";
    process.env.EMAIL_DRIVER = "disabled";
    await new Promise<void>((resolve, reject) => {
      // Resolved like any import, so a worktree that borrows the parent node_modules also works.
      const prismaCli = createRequire(path.join(process.cwd(), "package.json")).resolve("prisma/build/index.js");
      const child = spawn(process.execPath, [prismaCli, "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume(); child.stderr.resume();
      child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Isolated migration failed.")));
    });
    const { prisma } = await import("../src/lib/prisma"); database = prisma;
    const catalog = await import("../src/lib/storefront");
    const order = await import("../src/lib/product-catalog-order");
    const adminData = await import("../src/lib/admin-products-data");

    const category = await prisma.category.create({ data: { id: "qa-camisetas", name: "QA Camisetas", slug: "camisetas", active: true } });
    // 12 products, all with the old default weight 0 (as in production today). p00 is the newest.
    // Even ones are featured; p10 is sold out; p11 is hidden.
    const base = Date.parse("2026-11-01T00:00:00Z");
    const fixedUpdatedAt = new Date("2026-11-10T12:00:00Z");
    for (let index = 0; index < 12; index++) {
      const id = `p${String(index).padStart(2, "0")}`;
      await prisma.product.create({ data: {
        id, title: `QA ${id}`, slug: `qa-${id}`, description: "Synthetic QA", shortDescription: "Synthetic QA",
        active: index !== 11, featured: index % 2 === 0, featuredSortOrder: index % 2 === 0 ? 12 - index : null, sortOrder: 0,
        priceInCents: 10000, categoryId: category.id, createdAt: new Date(base - index * 60_000),
        variants: { create: [{ id: `${id}-m`, size: "M", stock: index === 10 ? 0 : 3, reservedStock: 0, active: true }] },
      } });
    }
    await prisma.$executeRaw`UPDATE "Product" SET "updatedAt" = ${fixedUpdatedAt}`;
    const storeIds = async () => (await catalog.getProducts()).map((product) => product.id);
    const featuredBefore = (await catalog.getFeaturedProducts()).map((product) => product.id);

    // 1. Before any move: newest first, and featured pieces no longer jump ahead.
    assert.deepEqual(await storeIds(), ["p00", "p01", "p02", "p03", "p04", "p05", "p06", "p07", "p08", "p09", "p10"]);
    proofs.push("initial_order_is_newest_first_and_featured_does_not_jump_ahead");

    // 2. The seller's case: put p07 (non featured) in position 2.
    const moveTo = async (id: string, position: number) =>
      prisma.$transaction((tx) => order.moveInCatalogOrder(tx, id, (ids) => order.placeAtPosition(ids, id, position)));
    const move = await moveTo("p07", 2);
    assert.deepEqual(move, { before: 8, after: 2, total: 12, changed: true });
    assert.equal((await storeIds())[1], "p07");
    const sortOrders = await prisma.product.findMany({ select: { id: true, sortOrder: true }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(sortOrders.map((row) => row.sortOrder), Array.from({ length: 12 }, (_, i) => i + 1));
    proofs.push("typed_position_2_lands_in_second_place_and_list_is_renumbered_1_to_n");

    // 3. Renumbering is raw SQL: updatedAt (featured tie-breaker, sitemap, Merchant feed) is untouched.
    const updatedAts = await prisma.product.findMany({ select: { updatedAt: true } });
    assert(updatedAts.every((row) => row.updatedAt.getTime() === fixedUpdatedAt.getTime()));
    proofs.push("renumbering_does_not_touch_updatedAt");

    // 4. Featured order (home and /categoria/destaques) is independent of the catalog position.
    assert.deepEqual((await catalog.getFeaturedProducts()).map((product) => product.id), featuredBefore);
    proofs.push("featured_order_unchanged_by_catalog_moves");

    // 5. Sold out stays after available; hidden never shows; both keep their place in the Admin list.
    await moveTo("p10", 1);
    await moveTo("p11", 1);
    const afterSoldOut = await storeIds();
    assert.equal(afterSoldOut.at(-1), "p10");
    assert(!afterSoldOut.includes("p11"));
    const adminPage = await adminData.getAdminProductRows({ page: 1 });
    assert.deepEqual(adminPage.products.slice(0, 2).map((product) => product.id), ["p11", "p10"]);
    proofs.push("sold_out_after_available_hidden_not_in_store_admin_list_follows_manual_order");

    // 6. Arrows: up/down next to a neighbour, and the Admin list matches positions 1..N.
    await prisma.$transaction((tx) => order.moveInCatalogOrder(tx, "p05", (ids) => order.placeNextTo(ids, "p05", "p11", "up")));
    const positions = await adminData.getCatalogPositions();
    assert.equal(positions.get("p05"), 1);
    const adminIds = (await adminData.getAdminProductRows({ page: 1 })).products.map((product) => product.id);
    assert.deepEqual(adminIds, [...positions.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id));
    proofs.push("arrow_move_and_admin_list_matches_catalog_positions");

    // 7. Twenty concurrent moves (separate transactions): the advisory lock keeps 1..N without gaps or duplicates.
    const ids = Array.from({ length: 12 }, (_, i) => `p${String(i).padStart(2, "0")}`);
    await Promise.all(Array.from({ length: 20 }, (_, i) => moveTo(ids[(i * 5) % 12], (i * 7) % 12 + 1)));
    const finalOrders = (await prisma.product.findMany({ select: { sortOrder: true } })).map((row) => row.sortOrder).sort((a, b) => a - b);
    assert.deepEqual(finalOrders, Array.from({ length: 12 }, (_, i) => i + 1));
    proofs.push("twenty_concurrent_moves_keep_unique_contiguous_positions");

    // 8. Paginated storefront follows the same order without duplicates.
    const paged: string[] = [];
    for (let offset = 0; offset < 11; offset += 4) paged.push(...(await catalog.getProducts({ offset, limit: 4 })).map((product) => product.id));
    assert.deepEqual(paged, await storeIds());
    proofs.push("paginated_storefront_matches_full_order");

    evidence.status = "PASS";
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await database?.$disconnect().catch(() => undefined);
    if (created) await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
    await maintenance.end();
    const outputDir = path.join(process.cwd(), "output", "qa");
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, "product-catalog-order.json"), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  }
}

main().catch(() => { process.exitCode = 1; });
