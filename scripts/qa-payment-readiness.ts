import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// Read-only CLI regression, against a local QA database only. Never prints configuration values.
const databaseUrl = process.env.QA_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("QA_DATABASE_URL must identify a local QA database.");
}
for (const provider of ["", "stripe", "unknown", "asaas"]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-readiness.ts"], {
    env: {
      ...process.env, DATABASE_URL: databaseUrl, APP_ENV: "staging", CHECKOUT_ENABLED: "true",
      PAYMENT_PROVIDER: provider, ASAAS_ENV: "sandbox",
      ASAAS_API_KEY: "$aact_hmlg_" + randomBytes(24).toString("hex"),
      ASAAS_WEBHOOK_TOKEN: randomBytes(32).toString("hex"),
      DOTENV_CONFIG_PATH: "output/nonexistent-readiness-regression.env",
    },
    encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
  const output = result.stdout ?? "";
  const expected = provider === "asaas" ? "[OK] payments:" : "[ERRO] payments:";
  if (result.error || !output.includes(expected) || /Stripe secret configurado|\[OK\] stripe/.test(output)) {
    throw new Error(`Readiness CLI regression failed for provider ${provider || "unset"}.`);
  }
  console.log(`PASS readiness CLI provider=${provider || "unset"}`);
}
