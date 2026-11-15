// Read-only visual capture of real pages (GET only, no form submission).
// usage: node scripts/qa-visual-capture.mjs --base=https://raredept.com.br --label=production --out=DIR
// Staging Basic credentials are read from STAGING_ACCESS_USERNAME / STAGING_ACCESS_PASSWORD.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const base = (args.base ?? "").replace(/\/$/, "");
const label = args.label ?? "capture";
const out = path.resolve(args.out ?? "visual-capture", label);
const widths = (args.widths ?? "390,1440").split(",").map(Number);
const loopback = /^http:\/\/127\.0\.0\.1:\d+$/.test(base);
if (!/^https:\/\//.test(base) && !loopback) throw new Error("--base must be an https origin or the loopback fixture preview");
const skip = new Set((args.skip ?? "").split(",").filter(Boolean));

const pages = [
  ["home", "/"],
  ["catalogo", "/categoria/tudo"],
  ["categoria", "/categoria/camisetas"],
  ["pdp", null],
  ["carrinho", loopback ? "/qa/cart" : "/cart"],
  ["checkout", "/finalizar-compra"],
  ["login", "/entrar"],
  ["minha-conta", "/minha-conta"],
  ["admin", "/admin"],
];

const username = process.env.STAGING_ACCESS_USERNAME;
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "pt-BR",
  ...(username && !base.includes("raredept.com.br")
    ? { httpCredentials: { username, password: process.env.STAGING_ACCESS_PASSWORD ?? "", send: "always" } }
    : {}),
});
await mkdir(out, { recursive: true });
const report = [];

async function firstProductPath(page) {
  await page.goto(`${base}/categoria/tudo`, { waitUntil: "networkidle" });
  return page.locator('a[href^="/produto/"]').first().getAttribute("href");
}

const page = await context.newPage();
const pdpPath = await firstProductPath(page);

for (const [name, route] of pages) {
  if (skip.has(name)) continue;
  const target = route ?? pdpPath;
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    const response = await page.goto(`${base}${target}`, { waitUntil: "networkidle" }).catch((error) => ({ error }));
    await page.waitForTimeout(600);
    const file = path.join(out, `${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const facts = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const header = document.querySelector("header");
      const h1 = document.querySelector("h1");
      return {
        finalPath: location.pathname,
        title: document.title,
        bodyFont: body.fontFamily,
        bodyBg: body.backgroundColor,
        bodyColor: body.color,
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
        h1: h1 ? { text: h1.innerText.slice(0, 80), font: getComputedStyle(h1).fontSize, weight: getComputedStyle(h1).fontWeight } : null,
        scrollWidth: document.documentElement.scrollWidth,
        docHeight: document.documentElement.scrollHeight,
      };
    });
    report.push({ name, width, route: target, status: response?.status?.() ?? String(response?.error ?? ""), file, ...facts });
  }
}

await writeFile(path.join(out, "report.json"), JSON.stringify({ base, label, capturedAt: new Date().toISOString(), pdpPath, report }, null, 2));
await browser.close();
console.log(JSON.stringify({ label, pdpPath, shots: report.length, out }));
