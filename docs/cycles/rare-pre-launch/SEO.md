# RARE-PRE-LAUNCH-01 — SEO

Audit date: 2026-11-13. Production probes are read-only public GETs.

## Production (raredept.com.br, `main` 4ea73f5)

| Check | Result | Status |
|---|---|---|
| `robots.txt` | Cloudflare "Managed robots.txt" block first (`User-agent: *` Allow `/`, `Content-Signal: search=yes,ai-train=no`, AI-training crawlers disallowed) + app block (`Allow: /`, private routes disallowed, `Sitemap: https://raredept.com.br/sitemap.xml`). Googlebot/Bingbot are not disallowed; both `*` groups merge. | OK — no Cloudflare change |
| `sitemap.xml` | 200 `application/xml`, 95 URLs (75 products, 14 categories, home + 5 institutional), 87 with `lastmod`; sampled URLs all 200. | OK |
| Host canonicalisation | `www` → 301 apex; `http` → 301 `https`. | OK |
| Canonical | Home `https://raredept.com.br`; PDP `https://raredept.com.br/produto/<slug>`; query strings stripped. | OK |
| Robots meta / header | No `noindex` on public pages. | OK |
| Cloudflare | Googlebot, Bingbot and generic UAs get 200 with no `cf-mitigated`. No challenge on public pages. | OK — security not changed |
| Title / description | `RARE — Streetwear importado e drops selecionados`; template `%s \| RARE`. | OK (kept: approved copy) |
| Organization / WebSite JSON-LD | Present; `name: "RARE"` only. Queries for "rare dept"/"raredept" have no brand alias. | FIXED (below) |
| Product JSON-LD | Present without `offers` because checkout is paused → not eligible for product snippets ("Either offers, review or aggregateRating should be specified"). | FIXED (below) |
| BreadcrumbList | Present on PDP. | OK |
| Google verification | No `google-site-verification` meta; discovery/indexing status cannot be read without Search Console. | MANUAL |

## Staging (rare-staging-staging.up.railway.app)

| Check | Result |
|---|---|
| `/` and `/sitemap.xml` | 401 Basic Auth + `x-robots-tag: noindex, nofollow` |
| `/robots.txt` | 200, `User-Agent: * / Disallow: /`, `x-robots-tag: noindex, nofollow` |

Staging stays noindex/nofollow; production stays indexable. Guarded by `isPublicIndexingEnabled` (`NODE_ENV=production` + non-restricted `APP_ENV` + production host).

## Code changes (PR #2 only — not deployed)

- `src/lib/structured-data.tsx`: `alternateName: ["RARE Dept", "raredept"]` on Organization and WebSite ("RARE Dept" is the name in `manifest.ts`; `raredept` is the domain).
- Product `offers` always carries the price that is rendered on the PDP (`pricing.finalPriceInCents`, promotion included) with BRL and URL. `availability` is `OutOfStock` when no sellable stock; `InStock` only when online checkout is enabled; omitted while checkout is paused (no false purchasability claim). No reviews/ratings are generated.
- Tests: `structured-data.test.ts` (alias, paused/sold-out/enabled offers), `robots.test.ts` (APP_ENV=staging with the production URL still disallows `/` and omits the sitemap).

## MANUAL — Search Console (operator, existing Google account; do not create a new account)

1. Search Console → Add property → **Domain** `raredept.com.br`.
2. Copy the TXT record; Cloudflare DNS → add `TXT @ google-site-verification=…` (DNS only). Verify.
3. Sitemaps → submit `https://raredept.com.br/sitemap.xml`.
4. URL Inspection → `https://raredept.com.br/` and one PDP → "Request indexing"; confirm "Crawl allowed: Yes", "Indexing allowed: Yes", user-declared canonical = Google-selected canonical.
5. After the PR is deployed: Rich Results Test on a PDP (expect Product snippet valid; "availability" warning while checkout is paused is expected) and on `/` (Organization/WebSite).
6. Optional: Bing Webmaster Tools → import from Search Console.

Status: HUMAN_REQUIRED (account access). Nothing here was done automatically.
