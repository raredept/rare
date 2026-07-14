import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];
const checks = [];

function ok(label) {
  checks.push(label);
  console.log(`OK ${label}`);
}

function fail(label, message) {
  failures.push({ label, message });
  console.error(`FAIL ${label}: ${message}`);
}

function warn(label, message) {
  warnings.push({ label, message });
  console.warn(`WARNING ${label}: ${message}`);
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function repositoryFiles() {
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

function isTestFixture(file) {
  return /(^|\/)(tests?|__tests__)(\/|$)/i.test(file) || /\.test\.[cm]?[jt]sx?$/i.test(file);
}

function isTextCandidate(file) {
  return /\.(?:[cm]?[jt]sx?|json|md|txt|ya?ml|toml|css|html|xml|env|example)$/i.test(file) || path.basename(file).startsWith(".env");
}

const secretRules = [
  { label: "Stripe live key", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9_=-]{12,}/i },
  { label: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_=-]{12,}/i },
  { label: "Railway verification token", pattern: /\brailway-verify=[A-Za-z0-9_-]{24,}/i },
  { label: "Private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
];

function scanSecrets(label, text) {
  for (const rule of secretRules) {
    if (rule.pattern.test(text)) fail(label, `${rule.label} detectado; o valor não foi exibido.`);
  }

  const connectionUrls = text.match(/\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"'<>`]+/gi) ?? [];
  for (const value of connectionUrls) {
    try {
      const url = new URL(value.replace(/[),.;]+$/, ""));
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".local");
      if (!local && (url.username || url.password)) {
        fail(label, "URL de banco/Redis com credencial detectada; o valor não foi exibido.");
      }
    } catch {
      // Placeholders such as postgresql://... are documentation, not credentials.
    }
  }
}

function scanRepositorySource(files) {
  let scanned = 0;
  for (const file of files) {
    if (!isTextCandidate(file) || isTestFixture(file) || file === "package-lock.json") continue;
    const absolute = path.join(root, file);
    const stat = fs.statSync(absolute);
    if (stat.size > 2 * 1024 * 1024) continue;
    const text = fs.readFileSync(absolute, "utf8");
    scanSecrets(`source:${file}`, text);
    scanned += 1;
  }
  if (!failures.some((item) => item.label.startsWith("source:"))) ok(`secrets:repository (${scanned} arquivos)`);
}

function scanDiff(baseRef) {
  const diffs = [
    git(["diff", "--no-ext-diff", "--unified=0", `${baseRef}..HEAD`]),
    git(["diff", "--no-ext-diff", "--unified=0", "--cached"]),
    git(["diff", "--no-ext-diff", "--unified=0"]),
  ];
  const additions = diffs
    .flatMap((diff) => diff.split(/\r?\n/))
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
  scanSecrets("secrets:diff", additions);
  if (!failures.some((item) => item.label === "secrets:diff")) ok(`secrets:diff (${baseRef}..HEAD + índice + worktree)`);
}

function checkArtifacts(files) {
  const forbidden = files.filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    if (file === ".env.example") return false;
    return /^(?:\.next|node_modules|coverage|output|playwright-report|test-results|storage)(?:\/|$)/i.test(normalized)
      || /^public\/uploads(?:\/|$)/i.test(normalized)
      || /\.(?:log|trace|sqlite3?|db|dump|pem|key|p12|pfx)$/i.test(file)
      || /(^|\/)\.env(?:\.|$)/i.test(file);
  });
  if (forbidden.length) fail("artifacts", `Arquivos gerados/sensíveis rastreados: ${forbidden.join(", ")}`);
  else ok("artifacts:tracked");
}

function checkFeatureFlags() {
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const envSource = fs.readFileSync(path.join(root, "src", "lib", "env.ts"), "utf8");
  const shippingRoute = fs.readFileSync(path.join(root, "src", "app", "api", "shipping", "quote", "route.ts"), "utf8");
  const structuredData = fs.readFileSync(path.join(root, "src", "lib", "structured-data.tsx"), "utf8");

  if (!/^CHECKOUT_ENABLED=["']false["']$/m.test(envExample)) fail("flags", ".env.example deve manter CHECKOUT_ENABLED=false.");
  if (!/^EMAIL_DRIVER=["']disabled["']$/m.test(envExample)) fail("flags", ".env.example deve manter EMAIL_DRIVER=disabled.");
  if (!/^MEDIA_BACKFILL_ALLOW_PRODUCTION=["']false["']$/m.test(envExample)) fail("flags", "Backfill de produção deve ficar bloqueado.");
  if (!/return env\.CHECKOUT_ENABLED === CHECKOUT_ENABLED_VALUE/.test(envSource)) fail("flags", "Checkout deve exigir o literal CHECKOUT_ENABLED=true.");
  if (!/if \(!isCheckoutEnabled\(\)\)/.test(shippingRoute)) fail("flags", "A rota de frete deve falhar fechada com checkout pausado.");
  if (!/offers:\s*input\.checkoutEnabled\s*\?/.test(structuredData)) fail("flags", "Product.offers deve depender da flag de checkout.");
  if (!failures.some((item) => item.label === "flags")) ok("flags:safe-defaults");
}

function checkPublicVariables(files) {
  const allowed = new Set(["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY"]);
  const found = new Set();
  for (const file of files) {
    if (!isTextCandidate(file) || isTestFixture(file) || file === "package-lock.json") continue;
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of text.matchAll(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g)) found.add(match[0]);
  }
  const unexpected = [...found].filter((variable) => !allowed.has(variable));
  if (unexpected.length) fail("public-env", `Variáveis públicas não aprovadas: ${unexpected.join(", ")}`);
  else ok("public-env:allowlist");
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function checkBrowserBundle() {
  const staticDir = path.join(root, ".next", "static");
  if (!fs.existsSync(staticDir)) {
    warn("bundle", ".next/static ausente; execute npm run build antes do gate final.");
    return;
  }
  const bundleFiles = walkFiles(staticDir).filter((file) => /\.(?:js|css|html|json)$/i.test(file));
  for (const file of bundleFiles) {
    const text = fs.readFileSync(file, "utf8");
    scanSecrets(`bundle:${path.relative(root, file)}`, text);
    if (/https?:[\\/]{2}(?:localhost|127\.0\.0\.1)(?=[:/])/i.test(text)) {
      fail(`bundle:${path.relative(root, file)}`, "URL local absoluta detectada no bundle do browser.");
    }
    if (/https?:[\\/]{2}[^\s"']*(?:railway\.app|up\.railway)/i.test(text)) {
      fail(`bundle:${path.relative(root, file)}`, "URL Railway absoluta detectada no bundle do browser.");
    }
  }
  if (!failures.some((item) => item.label.startsWith("bundle:"))) ok(`bundle:browser (${bundleFiles.length} arquivos)`);
}

function checkHostingDrift() {
  const vercelConfig = path.join(root, "vercel.json");
  if (!fs.existsSync(vercelConfig)) return;
  const parsed = JSON.parse(fs.readFileSync(vercelConfig, "utf8"));
  if (Array.isArray(parsed.crons) && parsed.crons.length) {
    warn("hosting:vercel-cron", "vercel.json ainda descreve cron legado; confirmar que o projeto Vercel não publica este job em paralelo à Railway.");
  }
}

const files = repositoryFiles();
const baseRef = process.env.RELEASE_BASE_REF || "origin/main";
checkArtifacts(files);
scanRepositorySource(files);
scanDiff(baseRef);
checkFeatureFlags();
checkPublicVariables(files);
checkBrowserBundle();
checkHostingDrift();

console.log(`Summary: ${checks.length} OK, ${warnings.length} WARNING, ${failures.length} FAIL.`);
if (failures.length) process.exitCode = 1;
