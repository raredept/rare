import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { Client } = pg;
const finalMigration = "20260907150000_admin_temporary_password";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function databaseUrlFor(baseUrl, databaseName) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runPrismaMigrate(databaseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_ENV: "development",
          DATABASE_URL: databaseUrl,
          NODE_ENV: "test",
        },
        stdio: "inherit",
        windowsHide: true,
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy falhou (code=${code ?? "null"}, signal=${signal ?? "none"}).`));
    });
  });
}

async function applyMigrationsBeforeAdminAccess(databaseUrl) {
  const migrationsDirectory = path.join(process.cwd(), "prisma", "migrations");
  const migrationNames = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name < finalMigration)
    .map((entry) => entry.name)
    .sort();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const migrationName of migrationNames) {
      const sql = await readFile(path.join(migrationsDirectory, migrationName, "migration.sql"), "utf8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  assert(baseUrl, "DATABASE_URL local nao configurada.");
  const parsedBaseUrl = new URL(baseUrl);
  assert(
    ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname),
    "QA destrutiva recusada: DATABASE_URL deve apontar para PostgreSQL local.",
  );

  const suffix = `${Date.now()}_${randomBytes(3).toString("hex")}`;
  const fullDatabaseName = `rare_qa_admin_${suffix}`;
  const legacyDatabaseName = `rare_qa_admin_legacy_${suffix}`;
  const maintenanceUrl = databaseUrlFor(baseUrl, "postgres");
  const maintenance = new Client({ connectionString: maintenanceUrl });
  const createdDatabases = [];
  const summary = {
    isolatedDatabases: 0,
    existingAdminPreserved: false,
    temporaryPasswordInitiallyValid: false,
    temporaryPasswordInvalidAfterChange: false,
    newPasswordValidAfterChange: false,
    repeatProvisioningPreservedNewPassword: false,
  };

  await maintenance.connect();
  try {
    for (const databaseName of [fullDatabaseName, legacyDatabaseName]) {
      assert(/^[a-z0-9_]+$/.test(databaseName), "Nome de banco QA invalido.");
      await maintenance.query(`CREATE DATABASE "${databaseName}"`);
      createdDatabases.push(databaseName);
    }
    summary.isolatedDatabases = createdDatabases.length;

    const fullDatabaseUrl = databaseUrlFor(baseUrl, fullDatabaseName);
    await runPrismaMigrate(fullDatabaseUrl);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: fullDatabaseUrl }) });
    try {
      const provisioned = await prisma.user.findUniqueOrThrow({ where: { username: "ADMIN 2" } });
      summary.temporaryPasswordInitiallyValid =
        provisioned.mustChangePassword && await bcrypt.compare("ADMIN", provisioned.passwordHash);
      assert(summary.temporaryPasswordInitiallyValid, "A senha temporaria nao autenticou no banco isolado.");

      const replacementPassword = `RareQa${randomBytes(12).toString("hex")}9a`;
      const replacementHash = await bcrypt.hash(replacementPassword, 12);
      const changed = await prisma.user.updateMany({
        where: { id: provisioned.id, mustChangePassword: true },
        data: { passwordHash: replacementHash, mustChangePassword: false },
      });
      assert(changed.count === 1, "A troca atomica da senha nao atualizou exatamente uma conta.");

      const afterChange = await prisma.user.findUniqueOrThrow({ where: { id: provisioned.id } });
      summary.temporaryPasswordInvalidAfterChange = !(await bcrypt.compare("ADMIN", afterChange.passwordHash));
      summary.newPasswordValidAfterChange = await bcrypt.compare(replacementPassword, afterChange.passwordHash);
      assert(summary.temporaryPasswordInvalidAfterChange, "A senha temporaria continuou valida apos a troca.");
      assert(summary.newPasswordValidAfterChange, "A nova senha nao autenticou apos a troca.");

      await runPrismaMigrate(fullDatabaseUrl);
      const afterRepeat = await prisma.user.findUniqueOrThrow({ where: { id: provisioned.id } });
      summary.repeatProvisioningPreservedNewPassword =
        !afterRepeat.mustChangePassword &&
        afterRepeat.passwordHash === replacementHash &&
        !(await bcrypt.compare("ADMIN", afterRepeat.passwordHash));
      assert(summary.repeatProvisioningPreservedNewPassword, "Reaplicar migrations restaurou a credencial temporaria.");
    } finally {
      await prisma.$disconnect();
    }

    const legacyDatabaseUrl = databaseUrlFor(baseUrl, legacyDatabaseName);
    await applyMigrationsBeforeAdminAccess(legacyDatabaseUrl);
    const legacyClient = new Client({ connectionString: legacyDatabaseUrl });
    await legacyClient.connect();
    try {
      const originalHash = await bcrypt.hash(`LegacyQa${randomBytes(12).toString("hex")}7a`, 12);
      await legacyClient.query(
        `INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "active", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'ADMIN'::"UserRole", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ["qa-existing-admin", "QA Existing Admin", "qa-existing-admin@rare.invalid", originalHash],
      );

      const finalSql = await readFile(
        path.join(process.cwd(), "prisma", "migrations", finalMigration, "migration.sql"),
        "utf8",
      );
      await legacyClient.query(finalSql);
      const existing = await legacyClient.query(
        `SELECT "passwordHash", "active", "mustChangePassword" FROM "User" WHERE "id" = $1`,
        ["qa-existing-admin"],
      );
      const secondAdmin = await legacyClient.query(
        `SELECT COUNT(*)::int AS count FROM "User" WHERE LOWER("username") = LOWER($1)`,
        ["ADMIN 2"],
      );
      summary.existingAdminPreserved =
        existing.rows.length === 1 &&
        existing.rows[0].passwordHash === originalHash &&
        existing.rows[0].active === true &&
        existing.rows[0].mustChangePassword === false &&
        secondAdmin.rows[0].count === 1;
      assert(summary.existingAdminPreserved, "A migration alterou o administrador preexistente.");
    } finally {
      await legacyClient.end();
    }

    console.log(`ADMIN_ACCESS_QA=${JSON.stringify(summary)}`);
  } finally {
    for (const databaseName of createdDatabases.reverse()) {
      await maintenance.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await maintenance.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
