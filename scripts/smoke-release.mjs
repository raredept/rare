import { spawnSync } from "node:child_process";
import path from "node:path";

function getArgumentValue(argv, name) {
  const inline = argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function normalizeBaseUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("--base-url deve usar http ou https.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function isProductionTarget(baseUrl) {
  if (!baseUrl) return false;
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === "raredept.com.br" || hostname === "www.raredept.com.br";
}

function main() {
  const argv = process.argv.slice(2);
  const baseUrl = normalizeBaseUrl(getArgumentValue(argv, "--base-url"));
  const allowProduction = argv.includes("--allow-production") || process.env.RELEASE_SMOKE_ALLOW_PRODUCTION === "true";

  if (isProductionTarget(baseUrl) && !allowProduction) {
    throw new Error("Smoke de produção bloqueado. Exige autorização explícita e --allow-production.");
  }

  const playwrightCli = path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
  const args = [
    playwrightCli,
    "test",
    "tests/e2e/release-smoke.spec.ts",
    "--project=chromium-desktop",
    "--project=chromium-mobile",
  ];
  const env = {
    ...process.env,
    RELEASE_SMOKE_TARGET: baseUrl ?? "local-managed-server",
  };
  if (baseUrl) env.PLAYWRIGHT_BASE_URL = baseUrl;

  console.log(`Release smoke target: ${baseUrl ?? "local managed server"}`);
  console.log("Mode: read-only; no account, order, payment, quote, email, Push or backfill writes.");
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Release smoke failed.");
  process.exitCode = 1;
}
