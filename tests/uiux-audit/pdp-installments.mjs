// RARE-UIUX-AUDIT-01 — read-only: reads every published product page (sitemap) and compares the
// installment hint shown on the PDP with what the minimum installment (R$ 10,00) actually allows.
//   node tests/uiux-audit/pdp-installments.mjs
// Assumes the production table (1x-3x 0%; 4x 9 … 12x 18 % total) and R$ 10,00 minimum per
// installment, recorded in docs/cycles/rare-card-installments. Shipping is NOT added (the PDP
// claim is made before any shipping), so "max feasible" is a lower bound for the item alone.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://raredept.com.br";
const RATES = { 4: 9, 5: 10, 6: 11, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17, 12: 18 };
const MIN = 10;

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]*\/produto\/[^<]*)<\/loc>/g)].map((m) => m[1]);
const rows = [];
for (const url of urls) {
  const html = await (await fetch(url)).text();
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, "\n").replace(/&nbsp;|&#160;/g, " ");
  const hint = text.split("\n").map((s) => s.trim()).find((s) => /sem juros|no cartão/.test(s)) ?? null;
  const price = [...html.matchAll(/"price":"?([\d.]+)"?/g)].map((m) => Number(m[1]))[0] ?? null;
  let max = 1;
  if (price) for (let n = 2; n <= 12; n += 1) if ((price * (1 + (RATES[n] ?? 0) / 100)) / n >= MIN) max = n;
  const claims12x = /12x/.test(hint ?? "");
  rows.push({ slug: url.split("/produto/")[1], price, hint, maxFeasibleItemOnly: max, claims12x, misleading: claims12x && max < 12 });
  await new Promise((r) => setTimeout(r, 120));
}
mkdirSync("output/uiux-audit-01", { recursive: true });
writeFileSync("output/uiux-audit-01/pdp-installments.json", JSON.stringify(rows, null, 1));
const misleading = rows.filter((r) => r.misleading);
console.log(JSON.stringify({
  products: rows.length,
  withHint: rows.filter((r) => r.hint).length,
  claims12x: rows.filter((r) => r.claims12x).length,
  misleadingCount: misleading.length,
  misleading: misleading.map((r) => `${r.slug} R$ ${r.price} → máx ${r.maxFeasibleItemOnly}x · "${r.hint}"`),
  hintsSeen: [...new Set(rows.map((r) => r.hint))],
}, null, 1));
