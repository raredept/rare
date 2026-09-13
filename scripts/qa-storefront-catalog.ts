import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// Disposable local PostgreSQL only. No existing catalog or external provider is used.
async function main() {
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "QA requires local PostgreSQL.");
  const databaseName = `rare_qa_catalog_${Date.now()}_${randomBytes(3).toString("hex")}`;
  assert(/^rare_qa_catalog_[a-z0-9_]+$/.test(databaseName));
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
      const child = spawn(process.execPath, [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, windowsHide: true, stdio: "pipe" });
      child.stdout.resume(); child.stderr.resume();
      child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Isolated migration failed.")));
    });
    const { prisma } = await import("../src/lib/prisma"); database = prisma;
    const catalog = await import("../src/lib/storefront");
    const { isVariantPurchasable } = await import("../src/lib/stock");
    const category = await prisma.category.create({ data: { id: "qa-camisetas", name: "QA Camisetas", slug: "camisetas", active: true } });
    const accessories = await prisma.category.create({ data: { id: "qa-accessories", name: "QA Acessórios", slug: "acessorios", active: true } });
    const bags = await prisma.category.create({ data: { id: "qa-bags", name: "QA Bags", slug: "bags", active: true, parentId: accessories.id } });
    for (let index = 0; index < 58; index++) {
      const id = `qa-catalog-${String(index).padStart(3, "0")}`;
      await prisma.product.create({ data: {
        id, title: `QA Catalog ${String(index).padStart(3, "0")}`, slug: id, description: "Synthetic QA", shortDescription: "Synthetic QA",
        active: index < 56, featured: index % 2 === 0, featuredSortOrder: 58 - index, sortOrder: index % 3,
        brand: index === 55 ? "Sold Only" : ["SUPREME", "BAPE", "STÜSSY", "NIKE"][index % 4],
        priceInCents: 10000 + (index % 7) * 100, categoryId: index < 52 ? category.id : accessories.id,
        subcategoryId: index < 52 ? null : bags.id, createdAt: new Date("2026-01-01T00:00:00Z"),
        variants: { create: index === 54 ? [] : index === 28 ? [
          { id: `${id}-variant`, size: "M", stock: 2, reservedStock: 2, active: true },
          { id: `${id}-partial`, size: "G", stock: 1, reservedStock: 0, active: true },
        ] : [{ id: `${id}-variant`, size: "M", stock: 2, reservedStock: index < 30 ? 0 : 2, active: index !== 55 }] },
      } });
    }
    const expected = await prisma.$queryRaw<Array<{ id: string }>>`SELECT p.id FROM "Product" p WHERE p.active ORDER BY EXISTS(SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v.active AND v.stock > v."reservedStock") DESC, p."priceInCents" ASC, p.id ASC`;
    const ids: string[] = [];
    for (let offset = 0; offset < 63; offset += 7) {
      const page = await catalog.getProducts({ offset, limit: 7, orderBy: [{ priceInCents: "asc" }] });
      ids.push(...page.map((item) => item.id));
    }
    assert.deepEqual(ids, expected.map((item) => item.id)); assert.equal(new Set(ids).size, 56);
    proofs.push("nine_offset_pages_match_independent_sql_order_without_duplicates_or_omissions");
    const all = await catalog.getProducts();
    assert.equal(all.filter((item) => item.variants.some((variant) => isVariantPurchasable(variant))).length, 30);
    assert(all.slice(0, 30).every((item) => item.variants.some((variant) => isVariantPurchasable(variant))));
    assert(all.slice(30).every((item) => !item.variants.some((variant) => isVariantPurchasable(variant))));
    assert(all.findIndex((item) => item.id === "qa-catalog-028") < 30);
    assert(all.findIndex((item) => item.id === "qa-catalog-054") >= 30);
    assert(all.findIndex((item) => item.id === "qa-catalog-055") >= 30);
    assert.equal(await catalog.getProductBySlug("qa-catalog-056"), null);
    assert.equal((await catalog.getProductBySlug("qa-catalog-030"))?.active, true);
    proofs.push("partial_available_reserved_out_no_variants_inactive_variants_and_draft_visibility");
    const paginated = [];
    for (const page of [1, 2, 3]) {
      const data = await catalog.getCategoryPageData("camisetas", { page });
      assert(data?.kind === "category");
      assert.equal(data.products.length, page < 3 ? 24 : 4); assert.equal(data.hasMore, page < 3);
      paginated.push(...data.products.map((item) => item.id));
    }
    assert.equal(new Set(paginated).size, 52);
    assert.deepEqual(paginated, (await catalog.getProducts({ categorySlug: "camisetas" })).map((item) => item.id));
    proofs.push("leaf_category_24_plus_one_three_pages_and_available_soldout_boundary");
    const featuredIds: string[] = [];
    for (const page of [1, 2]) {
      const data = await catalog.getCategoryPageData("destaques", { page }); assert(data?.kind === "featured");
      assert.equal(data.hasMore, page === 1); featuredIds.push(...data.products.map((item) => item.id));
    }
    assert.equal(featuredIds.length, 28); assert.equal(new Set(featuredIds).size, 28);
    assert.deepEqual(featuredIds, (await catalog.getFeaturedProducts()).map((item) => item.id));
    proofs.push("featured_pages_preserve_manual_order_within_availability_groups");
    const filtered = await catalog.getProducts({ query: "Catalog", categorySlug: "camisetas", brand: " stüssy ", limit: 100 });
    const filteredSql = await prisma.$queryRaw<Array<{ id: string }>>`SELECT p.id FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" WHERE p.active AND c.slug = 'camisetas' AND lower(p.brand) = lower('STÜSSY') AND p.title ILIKE '%Catalog%'`;
    assert.deepEqual(filtered.map((item) => item.id).sort(), filteredSql.map((item) => item.id).sort());
    assert(filtered.some((item) => !item.variants.some((variant) => isVariantPurchasable(variant))));
    const filteredPages = [...await catalog.getProducts({ query: "Catalog", categorySlug: "camisetas", brand: "STÜSSY", limit: 8 }),
      ...await catalog.getProducts({ query: "Catalog", categorySlug: "camisetas", brand: "STÜSSY", limit: 8, offset: 8 })];
    assert.deepEqual(filteredPages.map((item) => item.id).sort(), filteredSql.map((item) => item.id).sort());
    proofs.push("search_category_brand_case_accents_and_filtered_page_continuation_match_sql");
    assert((await catalog.getNavigationCategories()).find((item) => item.slug === "acessorios")?.children.some((item) => item.slug === "bags"));
    assert((await catalog.getProductsGroupedByCategory()).some((item) => item.slug === "bags" && item.total === 4));
    assert(!(await catalog.getAvailableBrandsForStore()).includes("Sold Only"));
    assert.equal((await catalog.getAvailableBrandsForStore()).length, 4);
    proofs.push("soldout_only_category_remains_in_navigation_grouped_catalog_and_brands_exclude_unsellable_only_brand");
    await prisma.productVariant.update({ where: { id: "qa-catalog-030-variant" }, data: { stock: 3 } });
    const replenished = await catalog.getProducts();
    assert(replenished.findIndex((item) => item.id === "qa-catalog-030") < 31);
    assert(replenished[30].variants.some((variant) => isVariantPurchasable(variant)));
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: "qa-catalog-030" } })).active, true);
    proofs.push("replenishment_returns_to_available_group_without_visibility_mutation_or_cache_delay");
    // Actual two connections prove the isolation on which the two-group query relies.
    const snapshotReader = new pg.Client({ connectionString: source.toString() });
    const writer = new pg.Client({ connectionString: source.toString() });
    await snapshotReader.connect(); await writer.connect();
    try {
      await snapshotReader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      assert.equal((await snapshotReader.query('SELECT stock > "reservedStock" AS available FROM "ProductVariant" WHERE id = $1', ["qa-catalog-000-variant"])).rows[0].available, true);
      await writer.query('UPDATE "ProductVariant" SET "reservedStock" = stock WHERE id = $1', ["qa-catalog-000-variant"]);
      assert.equal((await snapshotReader.query('SELECT stock > "reservedStock" AS available FROM "ProductVariant" WHERE id = $1', ["qa-catalog-000-variant"])).rows[0].available, true);
      assert.equal((await writer.query('SELECT stock > "reservedStock" AS available FROM "ProductVariant" WHERE id = $1', ["qa-catalog-000-variant"])).rows[0].available, false);
      await snapshotReader.query("COMMIT");
    } finally { await snapshotReader.end(); await writer.end(); }
    proofs.push("repeatable_read_actual_two_connection_snapshot_stable_during_stock_mutation");
    evidence.publishedFixtures = 56; evidence.inactiveFixtures = 2; evidence.passed = true;
  } finally {
    await database?.$disconnect();
    if (created) {
      await maintenance.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [databaseName]);
      await maintenance.query(`DROP DATABASE "${databaseName}"`);
      evidence.databaseRemoved = true;
    }
    await maintenance.end();
    await mkdir("output/nine-changes-20260913", { recursive: true });
    await writeFile("output/nine-changes-20260913/storefront-postgres-qa.json", JSON.stringify(evidence, null, 2));
  }
  console.log(JSON.stringify(evidence));
}

main().catch((error: unknown) => {
  console.error("Catalog QA failed", error instanceof Error ? error.message.replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]") : "UnknownError");
  process.exitCode = 1;
});
