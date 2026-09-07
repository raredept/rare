import "dotenv/config";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function databaseUrlFor(baseUrl, databaseName) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(" ")} falhou (code=${code ?? "null"}, signal=${signal ?? "none"}).`));
    });
  });
}

function assertPortIsFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => reject(new Error(`Porta ${port} permaneceu ocupada: ${error.message}`)));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(resolve));
  });
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
  const databaseName = `rare_qa_browser_${suffix}`;
  assert(/^[a-z0-9_]+$/.test(databaseName), "Nome de banco QA invalido.");
  const databaseUrl = databaseUrlFor(baseUrl, databaseName);
  const maintenance = new Client({ connectionString: databaseUrlFor(baseUrl, "postgres") });
  const storageRoot = path.resolve(process.cwd(), "output", "qa-storage");
  const storageDirectory = path.resolve(storageRoot, databaseName);
  assert(storageDirectory.startsWith(`${storageRoot}${path.sep}`), "Diretorio de storage QA fora do escopo permitido.");

  const currentLogin = "qa-current-admin@rare.invalid";
  const currentPassword = `QaCurrent${randomBytes(8).toString("hex")}9Z`;
  const pendingLogin = "QA FIRST ACCESS";
  const pendingPassword = `QaTemp${randomBytes(8).toString("hex")}8Y`;
  const replacementPassword = `QaReplacement${randomBytes(8).toString("hex")}7X`;
  let databaseCreated = false;
  let failure;

  await maintenance.connect();
  try {
    await assertPortIsFree(3100);
    await maintenance.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;

    const qaEnvironment = {
      ...process.env,
      ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url"),
      APP_ENV: "development",
      CHECKOUT_ENABLED: "false",
      DATABASE_URL: databaseUrl,
      EMAIL_DRIVER: "disabled",
      PLAYWRIGHT_BASE_URL: "",
      QA_CURRENT_ADMIN_LOGIN: currentLogin,
      QA_CURRENT_ADMIN_PASSWORD: currentPassword,
      QA_DATABASE_URL: databaseUrl,
      QA_PENDING_ADMIN_LOGIN: pendingLogin,
      QA_PENDING_ADMIN_PASSWORD: pendingPassword,
      QA_REPLACEMENT_ADMIN_PASSWORD: replacementPassword,
      QA_STORAGE_LOCAL_DIR: path.relative(process.cwd(), storageDirectory),
      RATE_LIMIT_DRIVER: "memory",
      SHIPPING_ENABLED: "false",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: path.relative(process.cwd(), storageDirectory),
      STORAGE_PUBLIC_BASE_URL: "/uploads",
    };

    await runNode(
      [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
      qaEnvironment,
    );
    await runNode([path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts"], qaEnvironment);

    const database = new Client({ connectionString: databaseUrl });
    await database.connect();
    try {
      const [currentHash, pendingHash] = await Promise.all([
        bcrypt.hash(currentPassword, 12),
        bcrypt.hash(pendingPassword, 12),
      ]);
      await database.query(
        `INSERT INTO "User" ("id", "name", "email", "username", "passwordHash", "role", "active", "mustChangePassword", "createdAt", "updatedAt")
         VALUES
           ($1, $2, $3, NULL, $4, 'ADMIN'::"UserRole", true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
           ($5, $6, $7, $8, $9, 'ADMIN'::"UserRole", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          "qa-current-admin",
          "QA Current Admin",
          currentLogin,
          currentHash,
          "qa-first-access",
          "QA First Access",
          "qa-first-access@rare.invalid",
          pendingLogin,
          pendingHash,
        ],
      );
    } finally {
      await database.end();
    }

    const playwrightCli = path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
    const startedAt = Date.now();
    await runNode(
      [playwrightCli, "test", "tests/e2e/admin-isolated.spec.ts", "--project=chromium-desktop"],
      qaEnvironment,
    );
    await assertPortIsFree(3100);
    await runNode(
      [playwrightCli, "test", "tests/e2e/admin-isolated.spec.ts", "--project=chromium-mobile"],
      qaEnvironment,
    );
    await assertPortIsFree(3100);
    console.log(`ISOLATED_ADMIN_E2E={"status":"passed","elapsedSeconds":${Math.round((Date.now() - startedAt) / 100) / 10},"portReleased":true}`);
  } catch (error) {
    failure = error;
  } finally {
    if (databaseCreated) {
      await maintenance.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await maintenance.end();
    await rm(storageDirectory, { recursive: true, force: true });
  }

  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
