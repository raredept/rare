import { spawnSync } from "node:child_process";

const results = [];

function run(label, command, args, options = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: "inherit",
    shell: options.shell ?? false,
  });
  const passed = !result.error && result.status === 0;
  results.push({ label, status: passed ? "PASS" : "FAIL" });
  if (result.error) console.error(result.error.message);
  return passed;
}

function npmArgs(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) return { command: process.execPath, args: [npmExecPath, ...args] };
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", args, shell: process.platform === "win32" };
}

function runNpm(label, args, options = {}) {
  const resolved = npmArgs(args);
  return run(label, resolved.command, resolved.args, { ...options, shell: resolved.shell });
}

runNpm("Static release safeguards", ["run", "release:guard"]);
runNpm("Lint", ["run", "lint"]);
runNpm("TypeScript", ["run", "typecheck"]);
runNpm("Unit and integration tests", ["test"]);
runNpm("Database readiness (read-only)", ["run", "db:check"]);
runNpm("Prisma validate", ["exec", "--", "prisma", "validate"]);
runNpm("Prisma migration status (read-only)", ["exec", "--", "prisma", "migrate", "status"]);
runNpm("Application readiness (read-only)", ["run", "app:check"]);
runNpm("Production build and standalone packaging", ["run", "build"]);
runNpm("Static and browser-bundle safeguards", ["run", "release:guard"]);
runNpm("Dependency audit", ["audit"]);
runNpm("Playwright E2E, Axe, console, links and release smoke", ["run", "test:e2e"]);

if (process.env.RELEASE_SKIP_LIGHTHOUSE === "true") {
  console.warn("\nWARNING Lighthouse: explicit skip requested; preview GO remains pending.");
  results.push({ label: "Lighthouse", status: "WARNING" });
} else {
  runNpm("Lighthouse quality budget", ["run", "lighthouse"]);
}

run("Git diff check (worktree)", "git", ["diff", "--check"]);
run("Git diff check (index)", "git", ["diff", "--cached", "--check"]);
run("Git diff check (origin/main..HEAD)", "git", ["diff", "--check", "origin/main..HEAD"]);

const pass = results.filter((result) => result.status === "PASS").length;
const warning = results.filter((result) => result.status === "WARNING").length;
const fail = results.filter((result) => result.status === "FAIL").length;
console.log("\n=== Release check summary ===");
for (const result of results) console.log(`${result.status} ${result.label}`);
console.log(`Summary: ${pass} PASS, ${warning} WARNING, ${fail} FAIL.`);
if (fail) process.exitCode = 1;
