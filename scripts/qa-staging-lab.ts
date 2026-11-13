import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

// Staging-like homologation lab for the BF/MFA/Asaas cycle, entirely on this machine:
//   - a disposable PostgreSQL database (migrations + seed + synthetic fixtures),
//   - the PRODUCTION build (.next/standalone) with APP_ENV=staging, Basic gate, MFA required,
//     PAYMENT_PROVIDER=asaas with a Sandbox-shaped fake key (no request ever reaches Asaas),
//   - the Playwright specs tests/e2e/bf-mfa-*.spec.ts in three phases: asaas, an unknown provider
//     (must fail closed) and retired stripe (must also fail closed),
//   - a scan of the server output for every secret, code and password used in the run.
// Every secret is random per run and never printed. Nothing here is a substitute for staging.
//
//   QA_LAB_DATABASE_URL=postgresql://user:pass@localhost:port/postgres npx tsx scripts/qa-staging-lab.ts [--project=chromium-desktop] [--https] [--keep]
//
// --https puts a local TLS proxy (throwaway self-signed certificate, needs `openssl`) in front of the
// server. The production build marks every cookie Secure; WebKit on Windows neither stores nor
// sends Secure cookies over plain http://localhost, so WebKit runs need it.

const root = process.cwd();
const project = process.argv.find((arg) => arg.startsWith("--project="))?.slice("--project=".length) ?? "chromium-desktop";
const keep = process.argv.includes("--keep");
const useHttps = process.argv.includes("--https");
// --only=promotions,payments narrows the specs (by file name) when iterating on one area.
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean) ?? [];
const port = 3200;
const httpsPort = 3443;
const internalUrl = `http://localhost:${port}`;
const baseUrl = useHttps ? `https://localhost:${httpsPort}` : internalUrl;

/** TLS terminator for the lab: forwards everything to the app, keeping the Host the browser used. */
function startHttpsProxy(certDir: string) {
  const key = path.join(certDir, "lab-key.pem");
  const cert = path.join(certDir, "lab-cert.pem");
  const generated = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
  assert(generated.status === 0, "openssl could not create the lab certificate.");
  const server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const upstream = http.request({ host: "127.0.0.1", port, method: request.method, path: request.url, headers: { ...request.headers, "x-forwarded-proto": "https" } }, (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    });
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  });
  server.listen(httpsPort, "127.0.0.1");
  return { server, cleanup: () => { server.close(); rmSync(key, { force: true }); rmSync(cert, { force: true }); } };
}
const outputDir = path.join(root, "output", "lab");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function secret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function syntheticCpf() {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10));
  for (const factor of [10, 11]) {
    const sum = digits.reduce((total, digit, index) => total + digit * (factor - index), 0);
    const rest = (sum * 10) % 11;
    digits.push(rest === 10 ? 0 : rest);
  }
  return digits.join("");
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, label: string) {
  return new Promise<number>((resolve) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
    child.once("exit", (code) => {
      console.log(`LAB_STEP ${label} exit=${code}`);
      resolve(code ?? 1);
    });
  });
}

async function waitForHealth(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${internalUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return (await response.json()) as Record<string, unknown>;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Lab server did not become healthy.");
}

function startServer(env: NodeJS.ProcessEnv, logFile: string) {
  const server = path.join(root, ".next", "standalone", "server.js");
  assert(existsSync(server), "Run `npm run build` first: .next/standalone/server.js is missing.");
  const log = createWriteStream(logFile, { flags: "a" });
  const child = spawn(process.execPath, [server], { cwd: path.dirname(server), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

async function stopServer(child: ChildProcess | null) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

async function main() {
  const maintenanceUrl = process.env.QA_LAB_DATABASE_URL;
  assert(maintenanceUrl, "QA_LAB_DATABASE_URL (local PostgreSQL maintenance URL) is required.");
  const parsed = new URL(maintenanceUrl);
  assert(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "The lab only runs against a local PostgreSQL.");
  mkdirSync(path.join(outputDir, "screens"), { recursive: true });

  const runId = `${Date.now()}_${randomBytes(3).toString("hex")}`;
  const databaseName = `rare_lab_${runId}`;
  const databaseUrl = new URL(maintenanceUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const storageDir = path.join("output", "lab", `storage-${runId}`);
  const sensitiveFile = path.join(outputDir, `sensitive-${runId}.txt`);
  const serverLog = path.join(outputDir, `server-${runId}.log`);
  writeFileSync(sensitiveFile, "");

  const admins = Object.fromEntries(["A", "B", "C", "D"].map((key) => [key, { login: `qa-mfa-${key.toLowerCase()}@rare.invalid`, password: `Qa${key}${secret(12)}9z` }]));
  const customer = { email: `qa.cliente.${runId}@homologacao.rare.invalid`, password: `QaCliente${secret(10)}7x`, cpf: syntheticCpf() };
  const labSecrets = {
    ADMIN_SESSION_SECRET: secret(48),
    ADMIN_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    STAGING_ACCESS_USERNAME: "qa-lab",
    STAGING_ACCESS_PASSWORD: secret(32),
    ASAAS_API_KEY: ["$aact", "hmlg", `lab${randomBytes(24).toString("hex")}`].join("_"),
    ASAAS_WEBHOOK_TOKEN: secret(36),
  };
  writeFileSync(sensitiveFile, [...Object.values(labSecrets), ...Object.values(admins).map((admin) => admin.password), customer.password, customer.cpf].join("\n") + "\n");

  const maintenance = new pg.Client({ connectionString: maintenanceUrl });
  await maintenance.connect();
  let server: ChildProcess | null = null;
  const tls = useHttps ? startHttpsProxy(outputDir) : null;
  const results: Record<string, number> = {};
  try {
    await maintenance.query(`CREATE DATABASE "${databaseName}"`);
    const baseEnv: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl.toString(), APP_ENV: "staging", NODE_ENV: "production" };
    delete baseEnv.QA_LAB_DATABASE_URL;
    assert((await run(process.execPath, [path.join("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], baseEnv, "migrate-deploy")) === 0, "migrate deploy failed");
    assert((await run(process.execPath, [path.join("node_modules", "prisma", "build", "index.js"), "migrate", "status"], baseEnv, "migrate-status")) === 0, "migrations pending");
    assert((await run(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts"], { ...baseEnv, NODE_ENV: "development" }, "seed")) === 0, "seed failed");

    const db = new pg.Client({ connectionString: databaseUrl.toString() });
    await db.connect();
    const fixture: Record<string, string> = {};
    try {
      const bf = await db.query(`SELECT p.id, p.slug, p.title FROM "Product" p JOIN "ProductImage" i ON i."productId" = p.id WHERE i.url = '/seed-products/bermuda-adidas.svg' LIMIT 1`);
      const win = await db.query(`SELECT p.id, p.slug, p.title FROM "Product" p JOIN "ProductImage" i ON i."productId" = p.id WHERE i.url = '/seed-products/calca-high-strapped.svg' LIMIT 1`);
      assert(bf.rows[0] && win.rows[0], "Seed products not found.");
      await db.query(`UPDATE "Product" SET "priceInCents" = 20000, active = true WHERE id = $1`, [bf.rows[0].id]);
      await db.query(`UPDATE "ProductVariant" SET stock = CASE WHEN size = 'M' THEN 1 ELSE 0 END, "reservedStock" = 0, active = true WHERE "productId" = $1`, [bf.rows[0].id]);
      const variant = await db.query(`SELECT id FROM "ProductVariant" WHERE "productId" = $1 AND size = 'M'`, [bf.rows[0].id]);
      Object.assign(fixture, {
        QA_BF_PRODUCT_ID: bf.rows[0].id, QA_BF_PRODUCT_SLUG: bf.rows[0].slug, QA_BF_PRODUCT_TITLE: bf.rows[0].title, QA_BF_VARIANT_ID: variant.rows[0].id,
        QA_WINDOW_PRODUCT_SLUG: win.rows[0].slug, QA_WINDOW_PRODUCT_TITLE: win.rows[0].title,
      });

      for (const [key, admin] of Object.entries(admins)) {
        await db.query(
          `INSERT INTO "User" (id, name, email, username, "passwordHash", role, active, "mustChangePassword", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, NULL, $4, 'ADMIN'::"UserRole", true, false, timezone('UTC', now()), timezone('UTC', now()))`,
          [`qa_admin_${key.toLowerCase()}`, `QA Admin ${key}`, admin.login, await bcrypt.hash(admin.password, 12)],
        );
      }
      const customerId = `qa_customer_${runId}`;
      await db.query(
        `INSERT INTO "Customer" (id, name, email, cpf, "passwordHash", "emailVerifiedAt", active, "createdAt", "updatedAt") VALUES ($1, 'Cliente QA', $2, $3, $4, timezone('UTC', now()), true, timezone('UTC', now()), timezone('UTC', now()))`,
        [customerId, customer.email, customer.cpf, await bcrypt.hash(customer.password, 12)],
      );
      await db.query(
        `INSERT INTO "CustomerAddress" (id, "customerId", label, "recipientName", cep, street, number, neighborhood, city, state, "isDefault", "createdAt", "updatedAt")
         VALUES ($1, $2, 'QA', 'Cliente QA', '01001000', 'Praça da Sé', '1', 'Sé', 'São Paulo', 'SP', true, timezone('UTC', now()), timezone('UTC', now()))`,
        [`qa_address_${runId}`, customerId],
      );

      await db.query(
        `INSERT INTO "Promotion" (id, name, slug, status, type, value, scope, priority, "homepageFeatured", "createdAt", "updatedAt")
         VALUES ('qa_promo_analytics', 'QA Analytics', 'qa-analytics', 'ENDED', 'PERCENTAGE', 25, 'SELECTED_PRODUCTS', 0, false, timezone('UTC', now()) - interval '2 days', timezone('UTC', now()))`,
      );
      for (let index = 1; index <= 25; index += 1) {
        const label = String(index).padStart(2, "0");
        await db.query(
          `INSERT INTO "Promotion" (id, name, slug, status, type, value, scope, priority, "homepageFeatured", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'DRAFT', 'PERCENTAGE', 5, 'ALL_PRODUCTS', 0, false, timezone('UTC', now()) - ($4 || ' minutes')::interval, timezone('UTC', now()))`,
          [`qa_page_${label}`, `QA paginação ${label}`, `qa-paginacao-${label}`, String(index)],
        );
      }

      // Timestamps as Prisma stores them: UTC wall clock in `timestamp without time zone`. A bare
      // now() would follow the session time zone (America/Sao_Paulo here) and shift them by 3 h.
      const order = async (input: { id: string; number: string; status: string; method: string; paymentId: string; paidAt: string | null; promotion: boolean; reservation: boolean }) => {
        await db.query(
          `INSERT INTO "Order" (id, "orderNumber", "customerId", "customerName", "customerEmail", "customerNameSnapshot", "customerEmailSnapshot", "subtotalInCents", "promotionDiscountInCents", "shippingInCents", "totalInCents",
             status, "paymentProvider", "paymentMethod", "asaasPaymentId", "paidAt", "reservationExpiresAt", "checkoutDeadlineAt", "shippingAddressSnapshot", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'Cliente QA', $4, 'Cliente QA', $4, 15000, $5, 2000, 17000, $6::"OrderStatus", 'asaas', $7, $8, $9::timestamp,
             CASE WHEN $10 THEN timezone('UTC', now()) + interval '25 minutes' END, CASE WHEN $10 THEN timezone('UTC', now()) + interval '25 minutes' END, '{"city":"São Paulo","state":"SP","cep":"01001000"}'::jsonb, timezone('UTC', now()), timezone('UTC', now()))`,
          [input.id, input.number, customerId, customer.email, input.promotion ? 5000 : 0, input.status, input.method, input.paymentId, input.paidAt, input.reservation],
        );
        await db.query(
          `INSERT INTO "OrderItem" (id, "orderId", "productId", "productTitleSnapshot", "variantId", "sizeSnapshot", quantity, "unitPriceInCents", "totalInCents", "basePriceInCents", "promotionId", "promotionName", "promotionCode", "promotionDiscountInCents", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'M', 1, 15000, 15000, 20000, $6, $7, $8, $9, timezone('UTC', now()), timezone('UTC', now()))`,
          [`${input.id}_item`, input.id, fixture.QA_BF_PRODUCT_ID, fixture.QA_BF_PRODUCT_TITLE, fixture.QA_BF_VARIANT_ID, input.promotion ? "qa_promo_analytics" : null, input.promotion ? "QA Analytics" : null, input.promotion ? "qa-analytics" : null, input.promotion ? 5000 : 0],
        );
      };
      await order({ id: `qa_order_pix_${runId}`, number: `RARE-QA-PIX-${runId.slice(-6)}`, status: "awaiting_payment", method: "pix", paymentId: "pay_qa00000000pix", paidAt: null, promotion: false, reservation: true });
      await db.query(`INSERT INTO "PixCharge" (id, "orderId", "copyPaste", "qrCodeBase64", "ticketUrl", "createdAt", "updatedAt") VALUES ($1, $2, '00020126QA-SINTETICO-NAO-PAGAR', NULL, 'https://sandbox.asaas.com/i/qa00000000pix', timezone('UTC', now()), timezone('UTC', now()))`, [`qa_pix_${runId}`, `qa_order_pix_${runId}`]);
      await order({ id: `qa_order_paid_${runId}`, number: `RARE-QA-PAID-${runId.slice(-6)}`, status: "paid", method: "card", paymentId: "pay_qa0000000paid", paidAt: new Date(Date.now() - 3_600_000).toISOString(), promotion: true, reservation: false });
      await order({ id: `qa_order_refunded_${runId}`, number: `RARE-QA-REFD-${runId.slice(-6)}`, status: "refunded", method: "card", paymentId: "pay_qa000000refund", paidAt: new Date(Date.now() - 7_200_000).toISOString(), promotion: true, reservation: false });
      Object.assign(fixture, { QA_PIX_ORDER_ID: `qa_order_pix_${runId}`, QA_PAID_ORDER_ID: `qa_order_paid_${runId}` });
    } finally {
      await db.end();
    }

    const serverEnv = (provider: string): NodeJS.ProcessEnv => ({
      ...baseEnv,
      ...labSecrets,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_URL: baseUrl,
      NEXT_PUBLIC_APP_URL: baseUrl,
      NEXT_TELEMETRY_DISABLED: "1",
      CHECKOUT_ENABLED: "true",
      SHIPPING_ENABLED: "false",
      EMAIL_DRIVER: "disabled",
      RATE_LIMIT_DRIVER: "memory",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: path.resolve(root, storageDir),
      STORAGE_PUBLIC_BASE_URL: "/uploads",
      PROMOTIONS_ENABLED: "true",
      BLACK_FRIDAY_HOME_ENABLED: "true",
      PAYMENT_PROVIDER: provider,
      ASAAS_ENV: "sandbox",
      ASAAS_PAYMENT_METHODS: "pix,card",
    });
    const testEnv = (expected: string): NodeJS.ProcessEnv => ({
      ...process.env,
      QA_LAB_ENABLED: "1",
      QA_EXPECT_PROVIDER: expected,
      QA_LAB_SENSITIVE_FILE: sensitiveFile,
      QA_DATABASE_URL: databaseUrl.toString(),
      PLAYWRIGHT_BASE_URL: baseUrl,
      STAGING_ACCESS_USERNAME: labSecrets.STAGING_ACCESS_USERNAME,
      STAGING_ACCESS_PASSWORD: labSecrets.STAGING_ACCESS_PASSWORD,
      QA_ASAAS_WEBHOOK_TOKEN: labSecrets.ASAAS_WEBHOOK_TOKEN,
      QA_ASAAS_API_KEY_SHAPE: labSecrets.ASAAS_API_KEY,
      QA_CUSTOMER_EMAIL: customer.email,
      QA_CUSTOMER_PASSWORD: customer.password,
      ...Object.fromEntries(Object.entries(admins).flatMap(([key, admin]) => [[`QA_MFA_${key}_LOGIN`, admin.login], [`QA_MFA_${key}_PASSWORD`, admin.password]])),
      ...fixture,
      DATABASE_URL: databaseUrl.toString(),
      APP_ENV: "staging",
    });
    const playwright = (specs: string[], expected: string, label: string) => run(process.execPath, [
      path.join("node_modules", "@playwright", "test", "cli.js"), "test", ...specs, `--project=${project}`, "--workers=1", "--reporter=list,json",
    ], { ...testEnv(expected), PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(outputDir, `${label}-${project}-${runId}.json`) }, label);

    const phases: Array<{ provider: string; expected: string; specs: string[] }> = [
      { provider: "asaas", expected: "asaas", specs: ["tests/e2e/bf-mfa-admin-security.spec.ts", "tests/e2e/bf-mfa-payments.spec.ts", "tests/e2e/bf-mfa-promotions.spec.ts"] },
      { provider: "qualquer-coisa", expected: "disabled", specs: ["tests/e2e/bf-mfa-payments.spec.ts"] },
      { provider: "stripe", expected: "disabled", specs: ["tests/e2e/bf-mfa-payments.spec.ts"] },
    ];
    // The synthetic Pix order is payable for 25 minutes. WebKit on Windows can spend longer than
    // that in the first phase, and the next phases would then (correctly) see an expired Pix. Each
    // phase starts with a fresh window on this disposable database only.
    const renewPixWindow = async () => {
      const db = new pg.Client({ connectionString: databaseUrl.toString() });
      await db.connect();
      try {
        await db.query(
          `UPDATE "Order" SET "reservationExpiresAt" = timezone('UTC', now()) + interval '25 minutes', "checkoutDeadlineAt" = timezone('UTC', now()) + interval '25 minutes'
           WHERE id = $1 AND status = 'awaiting_payment'`,
          [fixture.QA_PIX_ORDER_ID],
        );
      } finally {
        await db.end();
      }
    };
    for (const phase of phases) {
      if (only.length) phase.specs = phase.specs.filter((spec) => only.some((name) => spec.includes(name)));
      if (!phase.specs.length) continue;
      await renewPixWindow();
      server = startServer(serverEnv(phase.provider), serverLog);
      const health = await waitForHealth();
      const configuration = health.configuration as { ok?: boolean; errors?: Array<{ variable?: string }> } | undefined;
      // The health route reports variable names and fixed reason codes only (never values).
      console.log(`LAB_HEALTH provider=${phase.provider} status=${String(health.status)} configErrors=${JSON.stringify(configuration?.errors ?? []).slice(0, 800)}`);
      results[`playwright:${phase.provider}`] = await playwright(phase.specs, phase.expected, `phase-${phase.provider}`);
      await stopServer(server);
      server = null;
    }
  } finally {
    await stopServer(server);
    tls?.cleanup();
    // Log review: none of the run's secrets, codes or passwords, nor credential-shaped text, in the server output.
    if (existsSync(serverLog)) {
      const log = readFileSync(serverLog, "utf8");
      const sensitive = readFileSync(sensitiveFile, "utf8").split(/\r?\n/).filter((value) => value.length >= 6);
      const leaked = sensitive.filter((value) => log.includes(value)).length;
      const patterns: Record<string, RegExp> = {
        asaasKey: /\$aact_/, sessionCookie: /rare_admin_session=|rare_customer_session=|rare_admin_mfa_pending=/, authorization: /authorization:\s*basic|access_token/i,
        otpauth: /otpauth:\/\//, cpfFormatted: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, card: /\b(?:\d[ -]?){13,19}\b(?=.*cvv)/i,
      };
      const hits = Object.fromEntries(Object.entries(patterns).map(([name, pattern]) => [name, (log.match(new RegExp(pattern, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) ?? []).length]));
      console.log(`LAB_LOG_SCAN ${JSON.stringify({ lines: log.split("\n").length, sensitiveValuesChecked: sensitive.length, leaked, patterns: hits })}`);
      results.logLeaks = leaked + Object.values(hits).reduce((total, count) => total + count, 0);
    }
    rmSync(sensitiveFile, { force: true });
    rmSync(path.resolve(root, storageDir), { recursive: true, force: true });
    // Data integrity after the run (read-only; nothing is corrected). Each query counts anomalies.
    try {
      const db = new pg.Client({ connectionString: databaseUrl.toString() });
      await db.connect();
      try {
        const checks: Record<string, string> = {
          negativeStock: `SELECT COUNT(*)::int AS n FROM "ProductVariant" WHERE stock < 0 OR "reservedStock" < 0 OR "reservedStock" > stock`,
          orderItemsWithoutOrder: `SELECT COUNT(*)::int AS n FROM "OrderItem" oi LEFT JOIN "Order" o ON o.id = oi."orderId" WHERE o.id IS NULL`,
          paidWithoutPaidAt: `SELECT COUNT(*)::int AS n FROM "Order" WHERE status IN ('paid','processing','shipped','delivered') AND "paidAt" IS NULL`,
          asaasPaymentWithoutOrder: `SELECT COUNT(*)::int AS n FROM "AsaasWebhookEvent" e WHERE e."paymentId" IS NOT NULL AND e.status = 'processed' AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."asaasPaymentId" = e."paymentId")`,
          duplicateAsaasCustomer: `SELECT COUNT(*)::int AS n FROM (SELECT "asaasCustomerId" FROM "Customer" WHERE "asaasCustomerId" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1) d`,
          recoveryCodesWithoutFactor: `SELECT COUNT(*)::int AS n FROM "AdminMfaRecoveryCode" r JOIN "User" u ON u.id = r."userId" WHERE u."mfaEnabledAt" IS NULL`,
          activePromotionWithoutTargets: `SELECT COUNT(*)::int AS n FROM "Promotion" p WHERE p.status IN ('ACTIVE','SCHEDULED') AND ((p.scope = 'SELECTED_PRODUCTS' AND NOT EXISTS (SELECT 1 FROM "PromotionProduct" x WHERE x."promotionId" = p.id)) OR (p.scope = 'SELECTED_CATEGORIES' AND NOT EXISTS (SELECT 1 FROM "PromotionCategory" x WHERE x."promotionId" = p.id)))`,
          promotionEndBeforeStart: `SELECT COUNT(*)::int AS n FROM "Promotion" WHERE "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" <= "startsAt"`,
          orderItemPromotionMismatch: `SELECT COUNT(*)::int AS n FROM "OrderItem" WHERE "promotionId" IS NOT NULL AND "basePriceInCents" IS NOT NULL AND "unitPriceInCents" + "promotionDiscountInCents" <> "basePriceInCents"`,
        };
        const anomalies: Record<string, number> = {};
        for (const [name, sql] of Object.entries(checks)) anomalies[name] = (await db.query(sql)).rows[0].n;
        console.log(`LAB_DATA_INTEGRITY ${JSON.stringify(anomalies)}`);
        results.dataAnomalies = Object.values(anomalies).reduce((total, count) => total + count, 0);
      } finally {
        await db.end();
      }
    } catch (error) {
      console.log(`LAB_DATA_INTEGRITY unavailable: ${error instanceof Error ? error.name : "unknown"}`);
    }
    if (!keep) {
      await maintenance.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName]);
      await maintenance.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    await maintenance.end();
    console.log(`LAB_RESULT ${JSON.stringify({ project, results, databaseKept: keep ? databaseName : null, serverLog: path.relative(root, serverLog) })}`);
  }
  if (Object.values(results).some((code) => code !== 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
