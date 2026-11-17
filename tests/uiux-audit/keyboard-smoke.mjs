// RARE-UIUX-AUDIT-01 — read-only keyboard smoke on the public storefront.
//   node tests/uiux-audit/keyboard-smoke.mjs [--base=https://raredept.com.br]
// Tab only (plus Enter/Escape on menus and drawers). Nothing is submitted, nothing is bought: the cart
// drawer is opened empty. Records, per stop: element, whether a focus indicator is visible, and
// whether the focused element sits under the sticky header.
import { chromium, webkit } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "https://raredept.com.br").replace(/\/$/, "");
const OUT = path.resolve("output/uiux-audit-01");

function describeFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: "body" };
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const header = document.querySelector("header");
  const headerBottom = header && getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().bottom : 0;
  const indicator = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
  return {
    tag: el.tagName.toLowerCase(),
    text: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 50),
    indicator,
    outline: `${s.outlineStyle} ${s.outlineWidth}`,
    underStickyHeader: Boolean(header && !header.contains(el) && r.top < headerBottom - 2 && r.bottom > 0),
    offscreen: r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth,
    size: `${Math.round(r.width)}×${Math.round(r.height)}`,
  };
}

async function tabWalk(page, count) {
  const stops = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    stops.push(await page.evaluate(describeFocus));
  }
  return stops;
}

async function decline(page) {
  const button = page.getByRole("button", { name: "Recusar não essenciais" }).first();
  if (await button.isVisible().catch(() => false)) await button.click();
}

const report = {};
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, locale: "pt-BR" });
    const page = await context.newPage();
    const key = `${name}-${width}`;
    report[key] = {};
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await decline(page);
    await page.reload({ waitUntil: "load" });
    report[key].homeFirstStops = await tabWalk(page, 22);

    // PDP: from the top, walk until the purchase controls.
    await page.goto(`${BASE}/produto/camiseta-corteiz`, { waitUntil: "load" });
    report[key].pdpStops = await tabWalk(page, 40);

    // Category page deep in the grid: does the focused card hide under the sticky header?
    await page.goto(`${BASE}/categoria/tudo`, { waitUntil: "load" });
    const deep = await tabWalk(page, 60);
    report[key].categoryUnderHeader = deep.filter((s) => s.underStickyHeader).length;
    report[key].categoryNoIndicator = deep.filter((s) => s.tag !== "body" && !s.indicator).map((s) => `${s.tag} «${s.text}»`).slice(0, 10);

    // Mobile menu or desktop accessories menu, then the cart drawer: open with Enter, close with Escape.
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    if (width < 768) {
      const menu = page.getByRole("button", { name: /menu/i }).first();
      await menu.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      report[key].mobileMenuOpenFocus = await page.evaluate(describeFocus);
      const trapped = await tabWalk(page, 25);
      report[key].mobileMenuTabEscapes = trapped.filter((s) => s.tag !== "body" && s.offscreen).length;
      await page.screenshot({ path: path.join(OUT, "gallery", "storefront", "mobile", `${name}-${width}-menu-aberto.png`) });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      report[key].mobileMenuAfterEscape = await page.evaluate(describeFocus);
    } else {
      const accessories = page.getByRole("button", { name: /Acessórios/ }).first();
      await accessories.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);
      report[key].accessoriesMenuFocus = await page.evaluate(describeFocus);
      await page.screenshot({ path: path.join(OUT, "gallery", "storefront", "desktop", `${name}-${width}-menu-acessorios.png`) });
      await page.keyboard.press("Escape");
      report[key].accessoriesAfterEscape = await page.evaluate(describeFocus);
    }
    const cart = page.getByRole("button", { name: /carrinho/i }).first();
    if (await cart.count()) {
      await cart.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      report[key].cartOpenFocus = await page.evaluate(describeFocus);
      await page.screenshot({ path: path.join(OUT, "gallery", "checkout", width < 768 ? "mobile" : "desktop", `${name}-${width}-drawer-vazio.png`) });
      const inDrawer = await tabWalk(page, 12);
      report[key].cartTabStops = inDrawer.map((s) => `${s.tag} «${s.text}»${s.indicator ? "" : " (sem indicador)"}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      report[key].cartAfterEscape = await page.evaluate(describeFocus);
    }
    await context.close();
  }
  await browser.close();
}
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "keyboard.json"), JSON.stringify(report, null, 1));
for (const [key, value] of Object.entries(report)) {
  const noIndicator = [...value.homeFirstStops, ...value.pdpStops].filter((s) => s.tag !== "body" && !s.indicator).map((s) => `${s.tag} «${s.text}»`);
  const under = [...value.homeFirstStops, ...value.pdpStops].filter((s) => s.underStickyHeader).map((s) => `${s.tag} «${s.text}»`);
  console.log(key, JSON.stringify({ firstStops: value.homeFirstStops.slice(0, 6).map((s) => `${s.tag} «${s.text}»`), noIndicator: [...new Set(noIndicator)].slice(0, 12), underHeader: under, categoryUnderHeader: value.categoryUnderHeader, categoryNoIndicator: value.categoryNoIndicator, menu: value.mobileMenuOpenFocus ?? value.accessoriesMenuFocus, menuEscapes: value.mobileMenuTabEscapes, afterEscape: value.mobileMenuAfterEscape ?? value.accessoriesAfterEscape, cartOpen: value.cartOpenFocus, cartStops: value.cartTabStops, cartAfterEscape: value.cartAfterEscape }));
}
