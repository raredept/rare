// RARE-UIUX-AUDIT-01 — builds output/uiux-audit-01/index.html (local, unversioned) from the captures
// and prints the matrix summary used in docs/uiux/UIUX_AUDIT_01.md.
//   node tests/uiux-audit/build-gallery.mjs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("output/uiux-audit-01");
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
const images = [...(existsSync(path.join(OUT, "gallery")) ? walk(path.join(OUT, "gallery")) : []), ...(existsSync(path.join(OUT, "lab")) ? walk(path.join(OUT, "lab")) : [])]
  .filter((file) => /\.(png|jpe?g)$/.test(file))
  .map((file) => path.relative(OUT, file).replaceAll("\\", "/"))
  .sort();

const groups = new Map();
for (const image of images) {
  const parts = image.split("/");
  const key = parts.slice(0, -1).join(" / ");
  groups.set(key, [...(groups.get(key) ?? []), image]);
}
const html = `<!doctype html><meta charset="utf-8"><title>RARE-UIUX-AUDIT-01 — galeria</title>
<style>body{font:14px system-ui;margin:24px;background:#f5f5f3;color:#111}h2{margin-top:32px}figure{display:inline-block;margin:8px;width:220px;vertical-align:top}
img{width:220px;height:280px;object-fit:cover;object-position:top;border:1px solid #ccc;background:#fff}figcaption{font-size:11px;word-break:break-all}</style>
<h1>RARE-UIUX-AUDIT-01 — galeria BEFORE (${images.length} capturas)</h1>
${[...groups.entries()].map(([group, files]) => `<h2>${group} (${files.length})</h2>${files.map((file) => `<figure><a href="${file}"><img loading="lazy" src="${file}"></a><figcaption>${path.basename(file)}</figcaption></figure>`).join("")}`).join("\n")}`;
writeFileSync(path.join(OUT, "index.html"), html);

const summary = { images: images.length, byGroup: Object.fromEntries([...groups.entries()].map(([k, v]) => [k, v.length])) };
if (existsSync(path.join(OUT, "report.json"))) {
  const { results } = JSON.parse(readFileSync(path.join(OUT, "report.json"), "utf8"));
  const ok = results.filter((r) => r.probe);
  summary.matrix = {
    entries: results.length,
    errors: results.filter((r) => r.error || r.launchError).map((r) => `${r.browser} ${r.width} ${r.route}: ${(r.error || r.launchError).slice(0, 120)}`),
    browsers: [...new Set(results.map((r) => r.browser))],
    widths: [...new Set(results.map((r) => r.width))].sort((a, b) => a - b),
    routes: [...new Set(results.map((r) => r.route))].length,
    horizontalOverflow: ok.filter((r) => r.probe.docOverflow > 0).map((r) => `${r.browser} ${r.width} ${r.route} +${r.probe.docOverflow}px`),
    offscreen: ok.filter((r) => r.probe.offscreen.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.probe.offscreen.slice(0, 2).join(" | ")}`),
    clipped: ok.filter((r) => r.probe.clipped.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.probe.clipped.slice(0, 2).join(" | ")}`),
    brokenImages: ok.filter((r) => r.probe.brokenImages.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.probe.brokenImages.length}`),
    lowResImages: ok.filter((r) => r.probe.lowResImages.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.probe.lowResImages[0]}`),
    small24: [...new Set(ok.flatMap((r) => r.probe.small24.map((s) => s.replace(/ \d+×\d+$/, ""))))].slice(0, 30),
    consoleErrors: ok.filter((r) => r.consoleErrors?.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.consoleErrors[0]}`),
    axe: ok.filter((r) => r.axe?.length).map((r) => `${r.browser} ${r.width} ${r.route}: ${r.axe.map((v) => `${v.id}(${v.impact})×${v.nodes}`).join(", ")}`),
    axeRuns: ok.filter((r) => r.axe).length,
    vitals: ok.filter((r) => r.vitals).reduce((acc, r) => ({ maxCls: Math.max(acc.maxCls, r.vitals.cls), maxLcp: Math.max(acc.maxLcp, r.vitals.lcpMs) }), { maxCls: 0, maxLcp: 0 }),
    headerHeights: Object.fromEntries([...new Set(ok.map((r) => r.width))].map((w) => [w, [...new Set(ok.filter((r) => r.width === w && r.probe.headerHeight).map((r) => r.probe.headerHeight))]])),
  };
}
console.log(JSON.stringify(summary, null, 1));
