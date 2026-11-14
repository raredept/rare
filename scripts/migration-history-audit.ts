import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { auditMigrationHistory, type MigrationHistoryRow } from "../src/lib/migration-history";
import { classifyEnvironmentName } from "./release-freeze.mjs";

// READ-ONLY migration history audit (M-21). Compares prisma/migrations with _prisma_migrations without
// changing anything: one READ ONLY transaction with short timeouts, then ROLLBACK. It never loads a
// .env file, never prints the connection string, and refuses anything that looks like production.
//
//   DATABASE_URL=<staging URL, from the secret store> npm run db:history-audit -- --expect=staging \
//     [--expect-database=<name>] [--expect-host=<host>]
//
// Exit 0: history clean (pending migrations allowed). 1: failed/rolled-back/mismatched/extra history.
// 2: refused or misconfigured; nothing was read.

function argument(name: string) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || undefined;
}

function refuse(message: string): never {
  console.error(`REFUSED ${message}`);
  process.exit(2);
}

const expected = classifyEnvironmentName(argument("expect"));
if (!expected || expected === "unknown") refuse("--expect=staging (or development) is required.");
if (expected === "production") refuse("this audit never runs against production.");
for (const [label, value] of [["APP_ENV", process.env.APP_ENV], ["RAILWAY_ENVIRONMENT_NAME", process.env.RAILWAY_ENVIRONMENT_NAME]] as const) {
  const signal = classifyEnvironmentName(value);
  if (signal === "production" || signal === "unknown") refuse(`${label} does not identify a non-production environment.`);
  if (signal && signal !== expected) refuse(`${label} says ${signal}, but --expect says ${expected}.`);
}

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) refuse("DATABASE_URL is not set (this script does not read .env files).");
let target: { host: string; port: string; database: string };
try {
  const url = new URL(rawUrl);
  if (!/^postgres(ql)?:$/.test(url.protocol)) refuse("DATABASE_URL is not a PostgreSQL URL.");
  target = { host: url.hostname, port: url.port || "5432", database: decodeURIComponent(url.pathname.replace(/^\//, "")) };
} catch {
  refuse("DATABASE_URL could not be parsed.");
}
const expectedDatabase = argument("expect-database");
const expectedHost = argument("expect-host");
if (expectedDatabase && expectedDatabase !== target.database) refuse("database name differs from --expect-database.");
if (expectedHost && expectedHost.toLowerCase() !== target.host.toLowerCase()) refuse("host differs from --expect-host.");

const migrationsRoot = path.resolve(__dirname, "..", "prisma", "migrations");
const repository = readdirSync(migrationsRoot)
  .filter((name) => statSync(path.join(migrationsRoot, name)).isDirectory())
  .map((name) => ({ name, sql: readFileSync(path.join(migrationsRoot, name, "migration.sql")) }));

async function main() {
  const client = new Client({ connectionString: rawUrl, statement_timeout: 10_000, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 5000");
    await client.query("SET LOCAL lock_timeout = 2000");
    const readOnly = (await client.query<{ transaction_read_only: string }>("SHOW transaction_read_only")).rows[0]?.transaction_read_only;
    if (readOnly !== "on") throw new Error("transaction is not read-only");
    const identity = (await client.query<{ database: string; version: string }>("SELECT current_database() AS database, current_setting('server_version') AS version")).rows[0];
    const hasHistory = (await client.query<{ present: boolean }>("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present")).rows[0]?.present;
    const rows = hasHistory
      ? (await client.query<MigrationHistoryRow>('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at, migration_name')).rows
      : [];
    await client.query("ROLLBACK");
    const audit = auditMigrationHistory(repository, rows);
    console.log(JSON.stringify({
      identity: {
        expected,
        database: identity?.database,
        host: target.host,
        port: target.port,
        serverVersion: identity?.version,
        railwayEnvironment: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
        railwayService: process.env.RAILWAY_SERVICE_NAME ?? null,
        readOnlyTransaction: true,
      },
      historyTable: hasHistory ? "PRESENT" : "ABSENT",
      repositoryMigrations: repository.length,
      historyRows: rows.length,
      counts: audit.counts,
      clean: audit.clean,
      migrations: audit.migrations,
      extra: audit.extra,
      anomalies: audit.anomalies,
    }, null, 2));
    process.exitCode = audit.clean ? 0 : 1;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    // pg messages can name users or hosts; report only the class of failure.
    const code = (error as { code?: string }).code;
    console.error(`FAILED read-only audit (${code ?? (error instanceof Error ? error.message.replace(/postgres(ql)?:\/\/\S+/g, "<url>").slice(0, 120) : "unknown")}).`);
    process.exitCode = 2;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch(() => {
  console.error("FAILED could not connect to the database (details withheld).");
  process.exitCode = 2;
});
