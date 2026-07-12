import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.LIGHTHOUSE_PORT ?? 3200);
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.join(root, "output", "lighthouse");
const lighthouseCli = path.join(root, "node_modules", "lighthouse", "cli", "index.js");
const productSlug = process.env.LIGHTHOUSE_PRODUCT_SLUG ?? "camiseta-hellstar";
const routes = [
  { name: "home", path: "/", indexable: true },
  { name: "catalog", path: "/categoria/tudo", indexable: true },
  { name: "product", path: `/produto/${productSlug}`, indexable: true },
  { name: "login", path: "/entrar", indexable: false },
];
const profiles = [
  { name: "mobile", preset: null, minimumPerformance: 80, maximumLcpMs: 4_500 },
  { name: "desktop", preset: "desktop", minimumPerformance: 90, maximumLcpMs: 2_500 },
];
const safeEnv = {
  ...process.env,
  CHECKOUT_ENABLED: "false",
  EMAIL_DRIVER: "disabled",
  APP_URL: "https://raredept.com.br",
  NEXT_PUBLIC_APP_URL: "https://raredept.com.br",
  PORT: String(port),
  HOSTNAME: "127.0.0.1",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: safeEnv,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The standalone server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the local Lighthouse server.");
}

function score(report, category) {
  return Math.round((report.categories[category]?.score ?? 0) * 100);
}

function metric(report, audit) {
  return Math.round(report.audits[audit]?.numericValue ?? 0);
}

function sumTransferBytes(requests, resourceType) {
  return requests
    .filter((request) => !resourceType || request.resourceType === resourceType)
    .reduce((total, request) => total + (request.transferSize ?? 0), 0);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

if (process.env.LIGHTHOUSE_SKIP_BUILD !== "true") {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is unavailable; run this audit through npm run lighthouse.");
  await run(process.execPath, [npmCli, "run", "build"]);
}

const server = spawn(process.execPath, [path.join(root, ".next", "standalone", "server.js")], {
  cwd: root,
  env: safeEnv,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

const summaries = [];
const failures = [];

try {
  await waitForServer();

  for (const profile of profiles) {
    for (const route of routes) {
      const reportPath = path.join(outputDir, `${route.name}-${profile.name}.json`);
      const args = [
        lighthouseCli,
        `${origin}${route.path}`,
        "--output=json",
        `--output-path=${reportPath}`,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--blocked-url-patterns=https://*",
        "--quiet",
        "--chrome-flags=--headless --no-sandbox --disable-gpu",
      ];
      if (profile.preset) args.push(`--preset=${profile.preset}`);

      process.stdout.write(`Lighthouse ${route.name} ${profile.name}\n`);
      await run(process.execPath, args);
      const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
      const requests = report.audits["network-requests"]?.details?.items ?? [];
      const summary = {
        route: route.name,
        path: route.path,
        profile: profile.name,
        performance: score(report, "performance"),
        accessibility: score(report, "accessibility"),
        bestPractices: score(report, "best-practices"),
        seo: score(report, "seo"),
        fcpMs: metric(report, "first-contentful-paint"),
        lcpMs: metric(report, "largest-contentful-paint"),
        cls: report.audits["cumulative-layout-shift"]?.numericValue ?? 0,
        tbtMs: metric(report, "total-blocking-time"),
        speedIndexMs: metric(report, "speed-index"),
        requests: requests.length,
        transferBytes: sumTransferBytes(requests),
        javascriptBytes: sumTransferBytes(requests, "Script"),
        cssBytes: sumTransferBytes(requests, "Stylesheet"),
        imageBytes: sumTransferBytes(requests, "Image"),
        fontBytes: sumTransferBytes(requests, "Font"),
      };
      summaries.push(summary);

      if (summary.performance < profile.minimumPerformance) failures.push(`${route.name}/${profile.name}: performance ${summary.performance} < ${profile.minimumPerformance}`);
      if (summary.accessibility < 95) failures.push(`${route.name}/${profile.name}: accessibility ${summary.accessibility} < 95`);
      if (summary.bestPractices < 95) failures.push(`${route.name}/${profile.name}: best practices ${summary.bestPractices} < 95`);
      if (route.indexable && summary.seo < 95) failures.push(`${route.name}/${profile.name}: SEO ${summary.seo} < 95`);
      if (summary.lcpMs > profile.maximumLcpMs) failures.push(`${route.name}/${profile.name}: LCP ${summary.lcpMs}ms > ${profile.maximumLcpMs}ms`);
      if (summary.cls > 0.1) failures.push(`${route.name}/${profile.name}: CLS ${summary.cls} > 0.1`);
      if (summary.tbtMs > 150) failures.push(`${route.name}/${profile.name}: TBT ${summary.tbtMs}ms > 150ms`);
      if (summary.requests > 65) failures.push(`${route.name}/${profile.name}: requests ${summary.requests} > 65`);
      if (summary.transferBytes > 600_000) failures.push(`${route.name}/${profile.name}: transfer ${summary.transferBytes}B > 600000B`);
      if (summary.javascriptBytes > 220_000) failures.push(`${route.name}/${profile.name}: JavaScript ${summary.javascriptBytes}B > 220000B`);
      if (summary.cssBytes > 20_000) failures.push(`${route.name}/${profile.name}: CSS ${summary.cssBytes}B > 20000B`);
      if (summary.imageBytes > 100_000) failures.push(`${route.name}/${profile.name}: images ${summary.imageBytes}B > 100000B`);
      if (summary.fontBytes > 36_000) failures.push(`${route.name}/${profile.name}: fonts ${summary.fontBytes}B > 36000B`);
    }
  }
} finally {
  server.kill();
}

await fs.writeFile(path.join(outputDir, "summary.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), summaries, failures }, null, 2)}\n`);

for (const summary of summaries) {
  process.stdout.write(
    `${summary.route}/${summary.profile}: perf=${summary.performance} a11y=${summary.accessibility} bp=${summary.bestPractices} seo=${summary.seo} LCP=${summary.lcpMs}ms CLS=${summary.cls.toFixed(3)} TBT=${summary.tbtMs}ms transfer=${summary.transferBytes}B\n`,
  );
}

if (failures.length) {
  process.stderr.write(`Lighthouse budgets failed:\n- ${failures.join("\n- ")}\n`);
  process.exitCode = 1;
}
