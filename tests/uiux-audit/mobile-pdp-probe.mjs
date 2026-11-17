// RARE-UIUX-AUDIT-01 — read-only: where the price and the add-to-cart button land on a phone.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const out = {};
for (const width of [360, 390, 430]) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "pt-BR" });
  await context.addCookies([{ name: "rare_cookie_consent", value: `v1.a0.${Math.floor(Date.now() / 1000)}`, domain: "raredept.com.br", path: "/" }]);
  const page = await context.newPage();
  for (const slug of ["camiseta-corteiz", "jaqueta-puffer"]) {
    await page.goto(`https://raredept.com.br/produto/${slug}`, { waitUntil: "load" });
    out[`${width} ${slug}`] = await page.evaluate(() => {
      const y = (el) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
      const cta = [...document.querySelectorAll("button")].find((b) => /adicionar ao carrinho/i.test(b.textContent));
      return { viewport: innerHeight, h1: y(document.querySelector("h1")), price: y(document.querySelector("main aside [class*='text-3xl'], main aside p")), cta: y(cta), page: document.documentElement.scrollHeight };
    });
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
