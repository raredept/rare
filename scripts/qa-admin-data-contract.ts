import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getCriticalStock, getDashboardSnapshot } from "../src/lib/admin-analytics";
import { getAdminProductRows } from "../src/lib/admin-products-data";

async function main() {
  const databaseUrl = process.env.QA_DATABASE_URL;
  assert(databaseUrl, "Requires disposable QA database.");
  const target = new URL(databaseUrl);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Local QA only.");
  assert.match(target.pathname, /^\/rare_qa_browser_\d+_[a-f0-9]+$/);
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  const prefix = `qa-reconcile-${Date.now()}`;
  const categoryId = `${prefix}-category`;
  const productIds = [`${prefix}-needle`, `${prefix}-other`];
  try {
    await prisma.category.create({ data: { id: categoryId, name: "QA isolated data", slug: categoryId } });
    for (const [index, id] of productIds.entries()) {
      await prisma.product.create({ data: {
        id, slug: id, title: index === 0 ? "QA Reconcile Needle" : "QA Reconcile Other",
        description: "Disposable data contract", shortDescription: "QA", priceInCents: 1000,
        categoryId, active: index === 0,
        variants: { create: index === 0
          ? [...Array.from({ length: 220 }, (_, i) => ({ size: `NORMAL-${i}`, stock: 10, reservedStock: 0 })), { size: "CRITICAL-RESERVED", stock: 500, reservedStock: 499 }]
          : [{ size: "M", stock: 10 }] },
      } });
    }
    // Persisted only for the following browser run in the same disposable DB.
    const customer = await prisma.customer.create({ data: {
      id: "cqa-reconciliation-customer", name: `ClienteQA${"x".repeat(80)}`, email: `${"q".repeat(64)}@rare.invalid`,
      passwordHash: "disabled-qa-fixture", active: false,
    } });
    for (const status of ["paid", "canceled"] as const) {
      await prisma.order.create({ data: {
        id: `cqa-reconciliation-${status}`, orderNumber: `QA-RECONCILE-${status}`, customerId: customer.id,
        customerNameSnapshot: customer.name, customerEmailSnapshot: customer.email,
        status, subtotalInCents: 1000, totalInCents: 1000,
        createdAt: new Date(Date.now() - 60 * 86_400_000), paidAt: new Date(),
        items: { create: { productTitleSnapshot: "Item QA", sizeSnapshot: "M", quantity: 1, unitPriceInCents: 1000, totalInCents: 1000 } },
      } });
    }
    for (let run = 1; run <= 3; run++) {
      const critical = await getCriticalStock();
      assert(critical.some(v => v.productId === productIds[0] && v.size === "CRITICAL-RESERVED" && v.sellable === 1), `stock run ${run}`);
      assert(critical.length <= 12);
      const filtered = await getAdminProductRows({ page: 1, query: "Reconcile Needle", category: categoryId });
      assert.deepEqual(filtered.products.map(p => p.id), [productIds[0]], `combined filters run ${run}`);
      const stocked = await getAdminProductRows({ page: 1, query: "Reconcile Other", category: categoryId, stock: "out" });
      assert.deepEqual(stocked.products, []);
      const dashboard = await getDashboardSnapshot();
      assert.equal(dashboard.window.revenueInCents, 1000, "PaidAt window, excluding canceled revenue.");
      assert.equal(dashboard.window.paidOrders, 1);
      assert.equal(dashboard.window.itemsSold, 1);
      assert.equal(dashboard.ordersTotal, 2);
      console.log(`ADMIN_DATABASE_CONTRACT_RUN_${run}=PASS`);
    }
    // Long valid content must not disappear behind overflow-hidden list panels.
    await prisma.product.create({ data: {
      id: "cqa-long-admin-product", slug: "qa-long-admin-product", title: `ProdutoQA${"x".repeat(90)}`,
      brand: `MarcaQA${"x".repeat(80)}`, description: "Disposable responsive fixture", shortDescription: "QA",
      priceInCents: 1000, active: false, sortOrder: 9999,
    } });
  } finally {
    // Exact IDs, only in the verified disposable database.
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Avoid serializing connection URLs or SQL parameters on failure.
  console.error("Admin disposable database contract failed.");
  process.exitCode = 1;
});
