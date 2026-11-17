// RARE-UIUX-AUDIT-01 — read-only probe of the home brands strip (UIUX-BRANDS-001).
//   node tests/uiux-audit/brands-marquee-probe.mjs
// Three visitors: (1) brand-new, (2) one who clicked a hero arrow / indicator, (3) reduced motion.
// Measures whether the strip's track actually moves and what the motion preference stores.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://raredept.com.br";

async function measure(page) {
  return page.evaluate(async () => {
    const strip = document.querySelector('section[aria-label="Marcas disponíveis na RARE"]');
    if (!strip) return { present: false };
    const track = strip.querySelector("ul").parentElement;
    const x = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    const x0 = x();
    await new Promise((r) => setTimeout(r, 2000));
    const x1 = x();
    let stored = null;
    try { stored = localStorage.getItem("rare:home-motion-paused"); } catch { /* blocked */ }
    return {
      present: true,
      dataPlaying: strip.getAttribute("data-playing"),
      dataStatic: strip.getAttribute("data-static"),
      movedPx: Math.round(x1 - x0),
      storedPaused: stored,
      names: [...strip.querySelectorAll("ul:not([aria-hidden]) li")].map((li) => li.textContent.trim()),
      links: strip.querySelectorAll("a").length,
      pauseControlOnPage: [...document.querySelectorAll("[data-motion-control]")].map((b) => b.textContent.trim()),
    };
  });
}

const browser = await chromium.launch();
const out = {};
for (const [label, options] of [["novo-visitante", {}], ["reduced-motion", { reducedMotion: "reduce" }]]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", ...options });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const refuse = page.getByRole("button", { name: "Recusar não essenciais" }).first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  await page.waitForTimeout(800);
  out[label] = await measure(page);
  if (label === "novo-visitante") {
    // The visitor browses the hero once (arrow), then comes back another day.
    const next = page.getByRole("button", { name: /Próximo slide/i }).first();
    if (await next.isVisible().catch(() => false)) await next.click();
    await page.waitForTimeout(500);
    out["depois-de-clicar-seta-do-hero"] = await measure(page);
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(800);
    out["mesmo-visitante-recarregando"] = await measure(page);
  }
  await context.close();
}
await browser.close();
mkdirSync("output/uiux-audit-01", { recursive: true });
writeFileSync("output/uiux-audit-01/brands-marquee.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
