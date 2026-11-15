import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const preload = path.join(testDirectory, "no-env.cjs");
const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const expectedBuild = "next build && node scripts/prepare-standalone.mjs && node scripts/check-server-actions-artifact.mjs";
const packageJson = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
const requestedArguments = process.argv.slice(2);
const webpackFallback = requestedArguments.length === 1 && requestedArguments[0] === "--webpack";

if (requestedArguments.length && !webpackFallback) {
  console.error("[safe-build] Only the explicit --webpack fallback is supported.");
  process.exit(1);
}

if (!fs.existsSync(npmCli) || packageJson.scripts?.build !== expectedBuild || packageJson.scripts?.prebuild || packageJson.scripts?.postbuild) {
  console.error("[safe-build] Unsupported npm location or changed build lifecycle; refusing execution.");
  process.exit(1);
}

// Start from an empty environment. Never spread process.env or read env files.
const environment = {};
const osNames = ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP"];
for (const name of osNames) {
  const value = process.env[name];
  if (value !== undefined) environment[name] = value;
}
Object.assign(environment, {
  NODE_OPTIONS: `--require "${preload.replaceAll("\\", "/")}"`,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: "",
  CHECKOUT_ENABLED: "false",
  SHIPPING_ENABLED: "false",
  EMAIL_DRIVER: "disabled",
  RATE_LIMIT_DRIVER: "memory",
  AUTH_SECRET: "",
  ADMIN_SESSION_SECRET: "",
  CUSTOMER_SESSION_SECRET: "",
  APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  npm_config_offline: "true",
  npm_config_update_notifier: "false",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_ignore_scripts: "true",
  npm_config_cache: path.join(repositoryRoot, ".next", "cache", "safe-npm"),
  npm_config_userconfig: path.join(testDirectory, "blocked-user.npmrc"),
  npm_config_globalconfig: path.join(testDirectory, "blocked-global.npmrc"),
});

function run(arguments_) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: repositoryRoot,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.once("error", () => {
      console.error("[safe-build] Child failed to start; no environment was printed.");
      resolve(1);
    });
    child.once("exit", (code, signal) => {
      resolve(signal ? 1 : code ?? 1);
    });
  });
}

console.log("[safe-build] Sanitized environment; protected file reads and all Node outbound connections denied. Test artifact only: do not deploy.");
const selfTestCode = await run([path.join(testDirectory, "guard-self-test.cjs")]);
if (selfTestCode !== 0) process.exit(selfTestCode);
const startedAt = new Date().toISOString();
const mode = webpackFallback ? "equivalent webpack build" : "npm run build";
console.log(`[safe-build] ${mode} started ${startedAt}`);
let result;
if (webpackFallback) {
  // Explicit QA fallback: do not rewrite the project's default npm/Turbopack script.
  result = await run([path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next"), "build", "--webpack"]);
  if (result === 0) result = await run([path.join(repositoryRoot, "scripts", "prepare-standalone.mjs")]);
  if (result === 0) result = await run([path.join(repositoryRoot, "scripts", "check-server-actions-artifact.mjs")]);
} else {
  result = await run([npmCli, "run", "build"]);
}
console.log(`[safe-build] ${mode} finished ${new Date().toISOString()} exit=${result}`);
process.exitCode = result;
