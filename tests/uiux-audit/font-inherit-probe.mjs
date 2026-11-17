// RARE-UIUX-AUDIT-01 — read-only: computed font of buttons that declare Tailwind font utilities.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.context().addCookies([{ name: "rare_cookie_consent", value: `v1.a0.${Math.floor(Date.now() / 1000)}`, domain: "raredept.com.br", path: "/" }]);
const out = {};
for (const path of ["/", "/produto/camiseta-corteiz"]) {
  await page.goto(`https://raredept.com.br${path}`, { waitUntil: "load" });
  out[path] = await page.evaluate(() => [...document.querySelectorAll("button, input")].filter((el) => el.getBoundingClientRect().width > 0).map((el) => {
    const declared = (el.className.match(/font-(black|bold|semibold|medium)|text-(xs|sm|base|lg)/g) || []).join(" ");
    const s = getComputedStyle(el);
    return { el: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 30), declared, computed: `${s.fontWeight} ${s.fontSize}` };
  }).filter((r) => r.declared));
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
