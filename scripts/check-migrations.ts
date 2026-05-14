import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client } from "pg";

type CheckLevel = "ok" | "warn" | "error";

type CheckResult = {
  level: CheckLevel;
  label: string;
  message: string;
};

type SafeUrlSummary =
  | {
      configured: false;
    }
  | {
      configured: true;
      protocol: string;
      host: string;
      port: string;
      database: string;
      hasCredentials: boolean;
    }
  | {
      configured: true;
      parseError: true;
    };

const results: CheckResult[] = [];

function add(level: CheckLevel, label: string, message: string) {
  results.push({ level, label, message });
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeMessage(message: string) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://<redacted>")
    .replace(/sk_live_[A-Za-z0-9_]+/g, "sk_live_<redacted>")
    .replace(/sk_test_[A-Za-z0-9_]+/g, "sk_test_<redacted>")
    .replace(/whsec_[A-Za-z0-9_]+/g, "whsec_<redacted>");
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error.";
  return sanitizeMessage(message.split("\n")[0] ?? message);
}

function summarizeUrl(value: string | undefined): SafeUrlSummary {
  const raw = clean(value);
  if (!raw) return { configured: false };

  try {
    const url = new URL(raw);
    return {
      configured: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname,
      port: url.port || "(default)",
      database: url.pathname.replace(/^\//, "") || "(none)",
      hasCredentials: Boolean(url.username || url.password),
    };
  } catch {
    return { configured: true, parseError: true };
  }
}

function isPostgresUrl(value: string | undefined) {
  const summary = summarizeUrl(value);
  if (!summary.configured || "parseError" in summary) return false;
  return summary.protocol === "postgres" || summary.protocol === "postgresql";
}

function getSchemaProvider() {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const match = schema.match(/datasource\s+\w+\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
  return match?.[1] ?? "unknown";
}

function runPrismaCommand(label: string, args: string[]) {
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
      stdio: "pipe",
      env: process.env,
    });
    add("ok", label, "Comando concluido sem alterar o banco.");
  } catch (error) {
    add("error", label, safeErrorMessage(error));
  }
}

async function inspectDatabase(label: string, connectionString: string, expectClean: boolean) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const database = await client.query<{
      database_name: string;
      is_template: boolean;
    }>(`
      SELECT current_database() AS database_name,
             (SELECT datistemplate FROM pg_database WHERE datname = current_database()) AS is_template
    `);
    const objects = await client.query<{
      has_app_enums: boolean;
      has_app_tables: boolean;
      has_prisma_migrations: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_type
          WHERE typname IN ('UserRole', 'OrderStatus', 'PaymentProvider', 'InventoryMovementType')
        ) AS has_app_enums,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('User', 'Order', 'Product', 'Customer')
        ) AS has_app_tables,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = '_prisma_migrations'
        ) AS has_prisma_migrations
    `);

    const db = database.rows[0];
    const appObjects = objects.rows[0];
    const hasAppObjects = appObjects.has_app_enums || appObjects.has_app_tables || appObjects.has_prisma_migrations;

    if (db.database_name === "template0" || db.database_name === "template1" || db.is_template) {
      add(
        "warn",
        label,
        `Banco conectado se identifica como template PostgreSQL (${db.database_name}); se for Prisma dev, confirme shadow limpo; se for Postgres compartilhado, nao use como banco da app.`,
      );
    } else if (expectClean && hasAppObjects) {
      add("warn", label, "Banco shadow conectado, mas ja contem objetos da app; recrie/limpe antes de migrate dev.");
    } else {
      add("ok", label, `Banco conectado (${db.database_name}) sem expor credenciais.`);
    }
  } catch (error) {
    add("error", label, safeErrorMessage(error));
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const provider = getSchemaProvider();
  const databaseUrl = clean(process.env.DATABASE_URL);
  const shadowDatabaseUrl = clean(process.env.SHADOW_DATABASE_URL);
  const nodeEnv = clean(process.env.NODE_ENV) ?? "development";
  const databaseSummary = summarizeUrl(databaseUrl);
  const shadowSummary = summarizeUrl(shadowDatabaseUrl);

  add("ok", "schema provider", `Provider Prisma detectado: ${provider}.`);

  if (!databaseSummary.configured) {
    add("error", "DATABASE_URL", "DATABASE_URL nao configurada.");
  } else if ("parseError" in databaseSummary) {
    add("error", "DATABASE_URL", "DATABASE_URL configurada, mas invalida.");
  } else {
    add(
      "ok",
      "DATABASE_URL",
      `Configurada para ${databaseSummary.protocol} em ${databaseSummary.host}:${databaseSummary.port}/${databaseSummary.database}; credenciais ocultas.`,
    );
  }

  const postgresDev = provider === "postgresql" || isPostgresUrl(databaseUrl);
  if (postgresDev && nodeEnv === "development" && !shadowDatabaseUrl) {
    add(
      "warn",
      "SHADOW_DATABASE_URL",
      "Nao configurada. Configure um banco shadow limpo antes de criar nova migration com prisma migrate dev.",
    );
  } else if (shadowSummary.configured && "parseError" in shadowSummary) {
    add("error", "SHADOW_DATABASE_URL", "SHADOW_DATABASE_URL configurada, mas invalida.");
  } else if (shadowSummary.configured) {
    add("ok", "SHADOW_DATABASE_URL", "Configurada; valor sensivel nao foi impresso.");
  }

  if (databaseUrl && shadowDatabaseUrl && databaseUrl === shadowDatabaseUrl) {
    add("error", "shadow isolation", "SHADOW_DATABASE_URL nao pode ser igual a DATABASE_URL.");
  }

  runPrismaCommand("prisma validate", ["validate"]);
  runPrismaCommand("prisma migrate status", ["migrate", "status"]);

  if (databaseUrl && isPostgresUrl(databaseUrl)) {
    await inspectDatabase("database target", databaseUrl, false);
  }

  if (shadowDatabaseUrl && isPostgresUrl(shadowDatabaseUrl)) {
    await inspectDatabase("shadow target", shadowDatabaseUrl, true);
  }

  for (const result of results) {
    const prefix = result.level === "ok" ? "[OK]" : result.level === "warn" ? "[WARN]" : "[ERRO]";
    console.log(`${prefix} ${result.label}: ${result.message}`);
  }

  const errors = results.filter((result) => result.level === "error");
  if (errors.length) {
    console.error(`Migration check falhou com ${errors.length} erro(s).`);
    process.exit(1);
  }

  console.log("Migration check concluido sem alteracoes no banco.");
}

main().catch((error) => {
  console.error(`Migration check falhou: ${safeErrorMessage(error)}`);
  process.exit(1);
});
