// RARE-UIUX-AUDIT-01 — read-only layout measurements for UIUX-NAV-001 and UIUX-PDP-001.
//   node tests/uiux-audit/layout-probe.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://raredept.com.br";
const PDPS = ["camiseta-corteiz", "jaqueta-puffer", "bone-sup", "meia-fire", "conjunto-trapstar"];
const browser = await chromium.launch();
const out = { nav: {}, pdp: {} };
for (const width of [1024, 1280, 1440, 1920]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "pt-BR" });
  await context.addCookies([{ name: "rare_cookie_consent", value: `v1.a0.${Math.floor(Date.now() / 1000)}`, domain: "raredept.com.br", path: "/" }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/categoria/camisetas`, { waitUntil: "load" });
  out.nav[width] = await page.evaluate(() => {
    const row = document.querySelector('nav[aria-label="Navegação por categoria"]').firstElementChild;
    const items = [...row.children];
    const first = items[0].getBoundingClientRect();
    const last = items.at(-1).getBoundingClientRect();
    const logo = document.querySelector("header a[href='/']").getBoundingClientRect();
    const main = document.querySelector("main .store-shell, main > div").getBoundingClientRect();
    const shortcuts = [...document.querySelectorAll('[aria-label="Atalhos do catálogo"] a')].map((a) => a.textContent.trim());
    const header = [...items].map((i) => i.textContent.trim());
    return {
      headerItems: header,
      navUsedPx: Math.round(last.right - first.left),
      viewport: innerWidth,
      emptyRightPx: Math.round(innerWidth - last.right),
      navFirstLeft: Math.round(first.left),
      logoLeft: Math.round(logo.left),
      contentLeft: Math.round(main.left),
      catalogShortcuts: shortcuts,
      duplicated: shortcuts.filter((s) => header.some((h) => h.toLocaleLowerCase("pt-BR") === s.toLocaleLowerCase("pt-BR"))).length,
      catalogHeaderHeight: Math.round(document.querySelector("main h1").closest("div.mb-9, div").getBoundingClientRect().height),
    };
  });
  out.pdp[width] = {};
  for (const slug of PDPS) {
    await page.goto(`${BASE}/produto/${slug}`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    out.pdp[width][slug] = await page.evaluate(() => {
      const aside = document.querySelector("main aside");
      const gallery = aside.parentElement.querySelector(":scope > section");
      const details = document.getElementById("product-details-title")?.closest("section");
      const g = gallery.getBoundingClientRect();
      const a = aside.getBoundingClientRect();
      const d = details?.getBoundingClientRect();
      const sticky = getComputedStyle(aside).position;
      return {
        galleryHeight: Math.round(g.height),
        asideHeight: Math.round(a.height),
        emptyBelowAsidePx: Math.max(0, Math.round(g.height - a.height)),
        detailsStartsAtY: d ? Math.round(d.top + scrollY) : null,
        asideSticky: sticky,
        hasDetails: Boolean(details),
      };
    });
    if (slug === "camiseta-corteiz") await page.screenshot({ path: `output/uiux-audit-01/gallery/product/desktop/chromium-${width}-pdp-vazio-full.png`, fullPage: true });
  }
  await context.close();
}
await browser.close();
mkdirSync("output/uiux-audit-01", { recursive: true });
writeFileSync("output/uiux-audit-01/layout-probe.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
