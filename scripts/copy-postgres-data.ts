import { Client } from "pg";

const tableOrder = [
  "User",
  "Customer",
  "Category",
  "Product",
  "ProductImage",
  "ProductVariant",
  "CustomerAddress",
  "StoreSettings",
  "Order",
  "OrderItem",
  "InventoryMovement",
  "HomeBannerSlide",
  "StripeEvent",
  "OperationalEvidence",
  "AdminNotification",
  "AdminPushSubscription",
] as const;

function requiredUrl(name: "SOURCE_DATABASE_URL" | "TARGET_DATABASE_URL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function tableCount(client: Client, table: string) {
  const result = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)}`);
  return Number(result.rows[0]?.count ?? 0);
}

function orderCategoryRows(rows: Record<string, unknown>[]) {
  const pending = [...rows];
  const ordered: Record<string, unknown>[] = [];
  const inserted = new Set<string>();

  while (pending.length) {
    const index = pending.findIndex((row) => !row.parentId || inserted.has(String(row.parentId)));
    if (index < 0) throw new Error("Category hierarchy contains an unresolved parent reference.");
    const [row] = pending.splice(index, 1);
    ordered.push(row);
    inserted.add(String(row.id));
  }

  return ordered;
}

async function copyTable(source: Client, target: Client, table: string) {
  const sourceResult = await source.query<Record<string, unknown>>(`SELECT * FROM ${quoteIdentifier(table)}`);
  const rows = table === "Category" ? orderCategoryRows(sourceResult.rows) : sourceResult.rows;

  for (const row of rows) {
    const columns = Object.keys(row);
    const columnSql = columns.map(quoteIdentifier).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await target.query(
      `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${placeholders})`,
      columns.map((column) => row[column]),
    );
  }

  const targetCount = await tableCount(target, table);
  if (targetCount !== rows.length) {
    throw new Error(`${table} verification failed: source=${rows.length}, target=${targetCount}.`);
  }

  console.log(`${table}: ${rows.length}`);
}

async function main() {
  const sourceUrl = requiredUrl("SOURCE_DATABASE_URL");
  const targetUrl = requiredUrl("TARGET_DATABASE_URL");
  if (sourceUrl === targetUrl) throw new Error("Source and target databases must be different.");

  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({ connectionString: targetUrl });
  await Promise.all([source.connect(), target.connect()]);

  try {
    const targetCounts: number[] = [];
    for (const table of tableOrder) {
      targetCounts.push(await tableCount(target, table));
    }
    const populated = tableOrder.filter((_, index) => targetCounts[index] !== 0);
    if (populated.length) {
      throw new Error(`Target database is not empty: ${populated.join(", ")}.`);
    }

    await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.query("BEGIN");

    try {
      for (const table of tableOrder) {
        await copyTable(source, target, table);
      }
      await target.query("COMMIT");
      await source.query("COMMIT");
    } catch (error) {
      await Promise.allSettled([target.query("ROLLBACK"), source.query("ROLLBACK")]);
      throw error;
    }
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.split("\n")[0] : "Database copy failed.");
  process.exit(1);
});
