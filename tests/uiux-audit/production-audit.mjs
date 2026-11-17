// RARE-UIUX-AUDIT-01 — read-only UI/UX probe of the public storefront.
//
//   node tests/uiux-audit/production-audit.mjs [--base=https://raredept.com.br] [--browsers=chromium,webkit,firefox] [--quick]
//
// Only GET navigations. Cookie banner is answered with "Recusar não essenciais" (no analytics
// identifiers, zero /api/analytics/events). No login, no form submission, no cart/checkout write.
// Output: output/uiux-audit-01/{report.json, gallery/<area>/<device>/<browser>-<width>-<route>.png}
import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const BASE = arg("base", "https://raredept.com.br").replace(/\/$/, "");
const BROWSERS = arg("browsers", "chromium,webkit,firefox").split(",");
const QUICK = process.argv.includes("--quick");
const OUT = path.resolve("output/uiux-audit-01");

export const WIDTHS = [320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920];
const SECONDARY_WIDTHS = [375, 768, 1440]; // webkit / firefox
const FULLPAGE_WIDTHS = new Set([390, 1440]);
const AXE_WIDTHS = new Set([390, 1440]);

export const ROUTES = [
  { id: "home", path: "/", area: "storefront" },
  { id: "busca-corteiz", path: "/?q=corteiz", area: "storefront" },
  { id: "busca-sem-resultado", path: "/?q=zzzxqv", area: "storefront" },
  { id: "categoria-tudo", path: "/categoria/tudo", area: "storefront" },
  { id: "categoria-destaques", path: "/categoria/destaques", area: "storefront" },
  { id: "categoria-camisetas", path: "/categoria/camisetas", area: "storefront" },
  { id: "categoria-acessorios", path: "/categoria/acessorios", area: "storefront" },
  { id: "categoria-filtro-vazio", path: "/categoria/camisetas?brand=marca-inexistente", area: "storefront" },
  { id: "pdp-camiseta-corteiz", path: "/produto/camiseta-corteiz", area: "product" },
  { id: "pdp-jaqueta-puffer", path: "/produto/jaqueta-puffer", area: "product" },
  { id: "pdp-bone-sup", path: "/produto/bone-sup", area: "product" },
  { id: "pdp-meia-fire", path: "/produto/meia-fire", area: "product" },
  { id: "pdp-conjunto-trapstar", path: "/produto/conjunto-trapstar", area: "product" },
  { id: "carrinho-vazio", path: "/finalizar-compra", area: "checkout" },
  { id: "entrar", path: "/entrar", area: "account" },
  { id: "cadastro", path: "/cadastro", area: "account" },
  { id: "minha-conta-anon", path: "/minha-conta", area: "account" },
  { id: "pedidos-anon", path: "/minha-conta/pedidos", area: "account" },
  { id: "pedidos-legado", path: "/pedidos", area: "account" },
  { id: "sobre", path: "/sobre", area: "institutional" },
  { id: "contato", path: "/contato", area: "institutional" },
  { id: "suporte", path: "/suporte", area: "institutional" },
  { id: "politica-envio", path: "/politica-de-envio", area: "institutional" },
  { id: "trocas", path: "/trocas-e-devolucoes", area: "institutional" },
  { id: "privacidade", path: "/privacidade-e-termos", area: "institutional" },
  { id: "cookies", path: "/politica-de-cookies", area: "institutional" },
  { id: "404", path: "/esta-pagina-nao-existe", area: "storefront" },
  { id: "pdp-404", path: "/produto/produto-inexistente-uiux", area: "product" },
  { id: "admin-login", path: "/admin/login", area: "admin" },
];

const device = (w) => (w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop");
const height = (w) => (w < 768 ? 800 : w < 1024 ? 1024 : 900);

/** Runs inside the page: layout, target, text and image heuristics. */
function probe() {
  const vw = window.innerWidth;
  const sel = (el) => {
    if (!el || !el.tagName) return "";
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls === "." ? "" : cls}${text ? ` «${text}»` : ""}`;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
    }
    return false;
  };
  const docOverflow = document.documentElement.scrollWidth - vw;
  const offscreen = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) offscreen.push(`${sel(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    if (offscreen.length > 12) break;
  }
  const interactive = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [tabindex='0']")].filter(visible);
  const small24 = [];
  const small44 = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    // Inline text links inside paragraphs are exempt from 2.5.8; flag them separately.
    const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li, dd");
    if (inline) continue;
    if (r.width < 24 || r.height < 24) small24.push(`${sel(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    else if (r.width < 44 || r.height < 44) small44.push(`${sel(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const clipped = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || el.children.length > 0 || el.closest(".sr-only")) continue;
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowX) || s.textOverflow === "ellipsis") continue;
    if (el.scrollWidth > el.clientWidth + 1 && (el.textContent || "").trim()) clipped.push(sel(el));
    if (clipped.length > 10) break;
  }
  const tinyText = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) tinyText.set(`${size}px`, (tinyText.get(`${size}px`) ?? 0) + 1);
  }
  const images = [...document.images].filter(visible);
  const broken = images.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src);
  const lowRes = images
    .filter((img) => img.naturalWidth > 0 && img.getBoundingClientRect().width > 120 && img.naturalWidth < img.getBoundingClientRect().width * 0.9)
    .map((img) => `${(img.currentSrc || img.src).slice(-60)} natural ${img.naturalWidth} < shown ${Math.round(img.getBoundingClientRect().width)}`);
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1]));
  const skips = headings.filter((level, i) => i > 0 && level - headings[i - 1] > 1).length;
  const header = document.querySelector("header");
  const fonts = new Map();
  for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,label,span")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const key = `${el.tagName.toLowerCase()} ${s.fontSize}/${s.fontWeight}${s.textTransform === "uppercase" ? " UP" : ""}${s.letterSpacing !== "normal" ? ` ls${s.letterSpacing}` : ""}`;
    fonts.set(key, (fonts.get(key) ?? 0) + 1);
  }
  return {
    title: document.title,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 80)),
    headingSkips: skips,
    landmarks: { main: document.querySelectorAll("main").length, nav: document.querySelectorAll("nav").length, footer: document.querySelectorAll("footer").length },
    docOverflow,
    offscreen,
    small24: small24.slice(0, 15),
    small24Count: small24.length,
    small44: small44.slice(0, 15),
    small44Count: small44.length,
    clipped,
    tinyText: Object.fromEntries(tinyText),
    brokenImages: broken.slice(0, 10),
    lowResImages: lowRes.slice(0, 10),
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
    pageHeight: document.documentElement.scrollHeight,
    fontInventory: Object.fromEntries([...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)),
  };
}

/** Route-specific measurements for the operator findings (runs inside the page). */
async function specials(routeId) {
  const out = {};
  const nav = document.querySelector('nav[aria-label="Navegação por categoria"]');
  if (nav && nav.getBoundingClientRect().height > 0) {
    const row = nav.firstElementChild;
    const items = [...row.children].filter((c) => c.getBoundingClientRect().width > 0);
    const rowRect = row.getBoundingClientRect();
    const last = items.at(-1)?.getBoundingClientRect();
    const logo = document.querySelector("header a[href='/']")?.getBoundingClientRect();
    out.headerNav = {
      items: items.length,
      rowWidth: Math.round(rowRect.width),
      usedWidth: last ? Math.round(last.right - items[0].getBoundingClientRect().left) : 0,
      emptyRightPx: last ? Math.round(rowRect.right - last.right) : 0,
      firstItemLeft: Math.round(items[0]?.getBoundingClientRect().left ?? 0),
      logoLeft: logo ? Math.round(logo.left) : null,
      labels: items.map((i) => i.textContent.trim()),
    };
  }
  const shortcuts = document.querySelector('[aria-label="Atalhos do catálogo"]');
  if (shortcuts) out.catalogShortcuts = [...shortcuts.querySelectorAll("a")].map((a) => a.textContent.trim());
  const count = [...document.querySelectorAll("p")].find((p) => /produtos?( nesta página)?/i.test(p.textContent) && p.textContent.length < 60);
  if (count) out.catalogCountLabel = count.textContent.trim();
  out.sortOrFilterControls = document.querySelectorAll("select, [aria-label*='Ordenar' i], [aria-label*='Filtr' i]").length;
  const brands = document.querySelector('section[aria-label="Marcas disponíveis na RARE"]');
  if (brands) {
    const track = brands.querySelector("ul")?.parentElement;
    const t0 = track ? getComputedStyle(track).transform : null;
    await new Promise((r) => setTimeout(r, 1500));
    const t1 = track ? getComputedStyle(track).transform : null;
    let stored = null;
    try { stored = localStorage.getItem("rare:home-motion-paused"); } catch { /* blocked */ }
    out.brands = {
      dataPlaying: brands.getAttribute("data-playing"),
      dataStatic: brands.getAttribute("data-static"),
      playState: track ? getComputedStyle(track).animationPlayState : null,
      moved: t0 !== t1,
      names: [...brands.querySelectorAll("ul:not([aria-hidden]) li")].map((li) => li.textContent.trim()),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      storedPaused: stored,
      linksInside: brands.querySelectorAll("a").length,
    };
  }
  const details = document.getElementById("product-details-title")?.closest("section");
  const aside = document.querySelector("main aside") || document.querySelector("aside");
  const gallery = aside?.parentElement?.querySelector(":scope > section");
  if (routeId.startsWith("pdp") && aside && gallery) {
    const g = gallery.getBoundingClientRect();
    const a = aside.getBoundingClientRect();
    out.pdp = {
      galleryHeight: Math.round(g.height),
      asideHeight: Math.round(a.height),
      galleryBottomMinusAsideBottom: Math.round(g.bottom - a.bottom),
      detailsTopMinusAsideBottom: details ? Math.round(details.getBoundingClientRect().top - a.bottom) : null,
      hasDetails: Boolean(details),
      installmentHint: [...aside.querySelectorAll("p")].map((p) => p.textContent.trim()).find((t) => /sem juros|no cartão/.test(t)) ?? null,
      price: aside.querySelector("[class*='price'], .tabular-nums")?.textContent?.trim() ?? null,
    };
  }
  return out;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight * 0.9);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

async function declineCookies(page) {
  const button = page.getByRole("button", { name: "Recusar não essenciais" }).first();
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function measureVitals(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let cls = 0;
    let lcp = 0;
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => { const last = list.getEntries().at(-1); if (last) lcp = last.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* not supported in this engine */ }
    setTimeout(() => resolve({ cls: Number(cls.toFixed(4)), lcpMs: Math.round(lcp) }), 600);
  }));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const engines = { chromium, webkit, firefox };
  const results = [];
  for (const name of BROWSERS) {
    const engine = engines[name];
    if (!engine) continue;
    let browser;
    try { browser = await engine.launch(); } catch (error) { results.push({ browser: name, launchError: String(error).slice(0, 200) }); continue; }
    const widths = name === "chromium" ? (QUICK ? [390, 1440] : WIDTHS) : SECONDARY_WIDTHS;
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: height(width) }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", ...(width < 768 && name !== "firefox" ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 160)); });
      let first = true;
      for (const route of ROUTES) {
        consoleErrors.length = 0;
        const entry = { browser: name, width, device: device(width), route: route.id, path: route.path, area: route.area };
        try {
          const response = await page.goto(BASE + route.path, { waitUntil: "load", timeout: 45_000 });
          entry.status = response?.status();
          entry.finalUrl = page.url().replace(BASE, "");
          if (first) {
            await page.waitForTimeout(800);
            const dir = path.join(OUT, "gallery", "storefront", device(width));
            mkdirSync(dir, { recursive: true });
            await page.screenshot({ path: path.join(dir, `${name}-${width}-_cookie-banner.png`) });
            await declineCookies(page);
            first = false;
          }
          await page.waitForTimeout(1200);
          if (name === "chromium") entry.vitals = await measureVitals(page);
          entry.specials = await page.evaluate(specials, route.id);
          await autoScroll(page);
          entry.probe = await page.evaluate(probe);
          entry.consoleErrors = [...consoleErrors];
          const dir = path.join(OUT, "gallery", route.area, device(width));
          mkdirSync(dir, { recursive: true });
          const full = FULLPAGE_WIDTHS.has(width);
          await page.screenshot({ path: path.join(dir, `${name}-${width}-${route.id}${full ? "-full" : ""}.png`), fullPage: full });
          if (AXE_WIDTHS.has(width) && (name === "chromium" || width === 375)) {
            const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
            entry.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) }));
          }
        } catch (error) {
          entry.error = String(error).slice(0, 300);
        }
        results.push(entry);
        process.stdout.write(`${name} ${width} ${route.id} ${entry.status ?? "ERR"} overflow=${entry.probe?.docOverflow ?? "?"} axe=${entry.axe?.length ?? "-"}\n`);
      }
      await context.close();
    }
    await browser.close();
  }
  writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  console.log(`DONE ${results.length} entries`);
}

main().catch((error) => { console.error(error); process.exit(1); });
