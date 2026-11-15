import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

// RARE-PRE-LAUNCH-02 regression against the REAL staging (never production): synthetic
// SYSTEM_ADMIN / SELLER_ADMIN accounts, the consent/analytics and RBAC/unique-stock specs in a real
// browser, then the accounts are deleted. Secrets come from the Railway services' own variables:
//
//   railway run -s rare-staging -e staging -- railway run -s Postgres-MlyZ -e staging -- \
//     npx tsx scripts/qa-staging-prelaunch.ts --project=chromium-desktop
//
// Nothing is printed except counts, statuses and test names. Refuses any host but the staging one.

const STAGING_HOST = "rare-staging-staging.up.railway.app";
const project = process.argv.find((arg) => arg.startsWith("--project="))?.slice("--project=".length) ?? "chromium-desktop";
const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stagingDatabaseUrl() {
  const { PGUSER, PGPASSWORD, PGDATABASE, RAILWAY_TCP_PROXY_DOMAIN, RAILWAY_TCP_PROXY_PORT } = process.env;
  assert(PGUSER && PGPASSWORD && PGDATABASE && RAILWAY_TCP_PROXY_DOMAIN && RAILWAY_TCP_PROXY_PORT, "Run inside `railway run -s Postgres-MlyZ -e staging`.");
  const url = new URL("postgresql://localhost");
  url.username = PGUSER;
  url.password = PGPASSWORD;
  url.hostname = RAILWAY_TCP_PROXY_DOMAIN;
  url.port = RAILWAY_TCP_PROXY_PORT;
  url.pathname = `/${PGDATABASE}`;
  return url.toString();
}

async function main() {
  const appUrl = new URL(process.env.APP_URL ?? "");
  assert(appUrl.hostname === STAGING_HOST, "This runner only targets the staging domain.");
  assert(process.env.APP_ENV === "staging", "APP_ENV must be staging.");
  assert(process.env.STAGING_ACCESS_USERNAME && process.env.STAGING_ACCESS_PASSWORD, "The staging gate credentials come from rare-staging.");
  const databaseUrl = stagingDatabaseUrl();
  const runId = `${Date.now()}_${randomBytes(3).toString("hex")}`;
  const outputDir = path.join(root, "output", "staging-prelaunch");
  mkdirSync(outputDir, { recursive: true });
  const sensitiveFile = path.join(outputDir, `sensitive-${runId}.txt`);
  writeFileSync(sensitiveFile, "");

  const accounts = {
    E: { id: `qa_pl_system_${runId}`, login: `qa-pl-system.${runId}@homologacao.rare.invalid`, password: `QaSys${randomBytes(12).toString("base64url")}9z`, role: "SYSTEM_ADMIN" },
    F: { id: `qa_pl_seller_${runId}`, login: `qa-pl-seller.${runId}@homologacao.rare.invalid`, password: `QaSel${randomBytes(12).toString("base64url")}9z`, role: "SELLER_ADMIN" },
  };
  // Railway's staging TCP proxy presents a self-signed chain (verification fails with
  // SELF_SIGNED_CERT_IN_CHAIN) and also accepts plaintext. Encrypted-but-unverified is the lesser
  // risk for synthetic staging data, so it is allowed only on explicit request and never by default.
  assert(process.env.STAGING_DB_TLS_UNVERIFIED === "1", "Set STAGING_DB_TLS_UNVERIFIED=1 to accept the staging proxy's self-signed TLS chain (staging only).");
  const db = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();
  let exitCode = 1;
  try {
    const [{ count: migrations }] = (await db.query(`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows;
    console.log(`STAGING_DB migrationsApplied=${migrations}`);
    const product = (await db.query(
      `SELECT p.id, p.slug, p.title FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p.id
       WHERE p.active AND p."stockPolicy" = 'STANDARD' AND v.active AND v.size = 'M' AND v.stock - v."reservedStock" > 0
       ORDER BY p."sortOrder", p.id LIMIT 1`,
    )).rows[0];
    assert(product, "No active product with a free M unit on staging for the consent tour.");
    for (const account of Object.values(accounts)) {
      await db.query(
        `INSERT INTO "User" (id, name, email, "passwordHash", role, active, "mustChangePassword", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5::"UserRole", true, false, timezone('UTC', now()), timezone('UTC', now()))`,
        [account.id, `QA ${account.role}`, account.login, await bcrypt.hash(account.password, 12), account.role],
      );
    }
    writeFileSync(sensitiveFile, `${accounts.E.password}\n${accounts.F.password}\n`);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      QA_LAB_ENABLED: "1",
      QA_LAB_SENSITIVE_FILE: sensitiveFile,
      QA_DATABASE_URL: databaseUrl,
      PLAYWRIGHT_BASE_URL: appUrl.origin,
      QA_BF_PRODUCT_ID: product.id,
      QA_BF_PRODUCT_SLUG: product.slug,
      QA_BF_PRODUCT_TITLE: product.title,
      QA_MFA_E_LOGIN: accounts.E.login,
      QA_MFA_E_PASSWORD: accounts.E.password,
      QA_MFA_F_LOGIN: accounts.F.login,
      QA_MFA_F_PASSWORD: accounts.F.password,
      PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(outputDir, `prelaunch-${project}-${runId}.json`),
    };
    exitCode = await new Promise<number>((resolve) => {
      const child = spawn(process.execPath, [
        path.join("node_modules", "@playwright", "test", "cli.js"), "test",
        "tests/e2e/prelaunch-consent-analytics.spec.ts", "tests/e2e/prelaunch-rbac-inventory.spec.ts",
        `--project=${project}`, "--workers=1", "--reporter=list,json", "--trace=off", "--screenshot=off", "--video=off",
      ], { cwd: root, env, stdio: "inherit", windowsHide: true });
      child.once("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    // Synthetic accounts never outlive the run (recovery codes cascade; audit rows keep only ids).
    const removed = await db.query(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [Object.values(accounts).map((account) => account.id)]).catch(() => ({ rowCount: -1 }));
    console.log(`STAGING_QA_ACCOUNTS_REMOVED=${removed.rowCount}`);
    await db.end();
    if (existsSync(sensitiveFile)) {
      const leaked = readFileSync(sensitiveFile, "utf8").split("\n").filter(Boolean).length;
      console.log(`STAGING_QA_SENSITIVE_VALUES=${leaked} (file removed)`);
      rmSync(sensitiveFile, { force: true });
    }
  }
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exitCode = 1;
});
