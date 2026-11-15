# RARE-PRE-LAUNCH-01 — Visual diff (production vs staging)

Status: restoration applied on `cycle/rare-bf-mfa-asaas-01` (PR #2, DRAFT). Production was not touched.

## What changed / when / which commits / why / intended?

| Question | Answer |
|---|---|
| WHAT CHANGED | Storefront typography (weight 900 → 500/600), radius (rounded-md/lg → square), canvas (`bg-neutral-50` → `--store-paper #f5f5f3`), masthead/footer layout, home composition, product card, PDP gallery chrome, cart/account/auth/policy surfaces. |
| WHEN | 2026-10-07 (Codex "editorial" redesign on `codex/backend-evolution-20261007`), carried into PR #2 by merge `21729fb`; follow-ups 2026-11-07 aligned promotions to it. |
| WHICH COMMITS | Redesign: `aaa9863`, `9f9a652`, `9e4b585`, `778c891`, `683e396`, `8d9f207`, `26d3dea`. Follow-ups that styled new features in the redesign language: `dc79acd`, `46a7e1f`, `cecfc79`. |
| WHY | The backend-evolution branch bundled an unrequested visual redesign with functional work; the merge into the BF/MFA/Asaas cycle pulled both. |
| INTENDED | Functional parts: promotions, BF campaign, Asaas Pix, MFA, Stripe retirement, stock protection, skip link, reduced motion, responsive `sizes`, a11y fixes. |
| UNINTENDED | The visual redesign itself. The approved look is production (`main` `4ea73f5`, raredept.com.br). |

Method: inverse diff of the redesign commits only, applied over the PR head; functional commits kept. `83c7243` (responsive media perf) is KEEP. No mockup or new design was introduced.

## Evidence (outside the repo)

`E:/rare-evidence/rare-pre-launch/screenshots/{before/production,before/staging,after/fixture-restored}/*.png` + `report.json`.

| Page @ width | Production | Staging (before) | Restored (fixture) |
|---|---|---|---|
| home 390 / 1440 | header 136 / 158px | 137 / 153px | 136 / 158px |
| catálogo 390 / 1440 | h1 30px/900, 48px/900 | 36px/600, 60px/600 | 30px/900, 48px/900 |
| categoria 390 / 1440 | h1 30px/900, 48px/900 | 404 (staging has no `camisetas` category — data, not visual) | 30px/900, 48px/900 |
| PDP 390 / 1440 | h1 30px/900, 36px/900 | 30px/600, 36px/600 | 30px/900, 36px/900 |
| checkout 390 / 1440 | h1 30px/900, 36px/900 | 30px/600, 30px/600 | 30px/900, 36px/900 |
| login 390 / 1440 | h1 30px/900, 36px/900 | 30px/500, 36px/500 | 30px/900, 36px/900 |
| admin login | 24px/900 | 24px/900 (no drift) | — |

No horizontal overflow at any captured width in any environment. Fixture `carrinho` is `/qa/cart` (direct cart component) while production `/carrinho` redirects to `/finalizar-compra`, so its h1 is compared to checkout, not 1:1.

## Component matrix

| PAGE | COMPONENT | PRODUCTION | STAGING | COMMIT | INTENDED? | ACTION |
|---|---|---|---|---|---|---|
| all | `globals.css` tokens / buttons / inputs / kicker | rounded-md, font-black, tracking 0.16–0.24em | square, font-medium/semibold, `--store-paper` | `aaa9863` | No | RESTORE |
| all | `globals.css` skip link + reduced-motion (`scroll-behavior:auto`, no ornamental scale) | absent | present | `aaa9863`, `26d3dea` | Yes (a11y) | KEEP |
| all | `.store-field` `min-h-11` | absent | present | `8d0ee68` (admin pagination) | Yes (44px target) | KEEP |
| all | `.admin-light-scope` remaps | absent | present | `e5446e5` | Yes (admin promotion preview) | KEEP |
| all | `(store)/layout.tsx` | `bg-neutral-50`, no `#store-main` | paper token, skip link, `main#store-main` | `aaa9863` | Partly | ADAPT — production canvas + skip link + `main#store-main tabIndex=-1` |
| all | `header.tsx`, `header-actions.tsx`, `category-nav.tsx`, `mobile-navigation.tsx`, `footer.tsx` | black masthead 136/158px, weight 900 | editorial masthead 137/153px | `9f9a652` | No | RESTORE |
| home | `page.tsx` | production sections | editorial composition | `9e4b585` | No | RESTORE (keeps `HomeCampaign` + `pricing.finalPriceInCents` from promotions) |
| home | `home-hero-carousel.tsx` | gradients, arrows `hidden lg:flex`, rounded | editorial overlay `bg-black/60`, global motion control | `9e4b585`, `26d3dea` | Partly | ADAPT — production look; kept admin crop/fit (`imageFit`, desktop/mobile position vars), indicators in a scroll-bounded `role=group` "Selecionar slide", 44px-tall targets, inactive dot `bg-white/60` (≥3:1 over the gradient) |
| home | `home-featured-carousel.tsx`, `home-brands-strip.tsx`, `home-motion.tsx`, `home-motion.module.css` | production | editorial + motion control | `9e4b585`, `26d3dea` | No | RESTORE (reduced-motion handled globally) |
| home | `home-campaign.tsx` | n/a (new feature) | full-width editorial | `dc79acd` | Feature yes, styling no | ADAPT — version before `dc79acd` (production language) |
| home/PLP | `product-card.tsx`, `product-card.module.css` | font-black price, rounded | editorial card | `778c891` | No | RESTORE + keep `PriceTag`/`PromotionBadge` and `mediaSizes` (`83c7243`) |
| PLP | `categoria/[slug]/page.tsx`, `loading.tsx` | h1 48px/900 | 60px/600 | `778c891`, `8d9f207` | No | RESTORE |
| PDP | `product-detail-client.tsx`, `produto/[slug]/page.tsx` | rounded gallery, black zoom pill | editorial gallery | `683e396` | No | ADAPT — production look; kept `key={image.url}` on media (broken-image recovery on remount), zoom button 44px |
| PDP/cart | `price-tag.tsx`, `payment-method-picker.tsx`, `campaign-countdown.tsx` | n/a (new) | redesign styling | `46a7e1f`, `cecfc79` | Feature yes, styling no | ADAPT — production typography (font-black, rounded) |
| cart | `cart-drawer.tsx` | price `text-success` (contrast fails, also in prod), qty 40px | editorial | `8d9f207` | No | ADAPT — production look; price `text-emerald-400` (axe contrast), qty buttons/wrapper 44px |
| cart/checkout | `cart-page-client.tsx`, `checkout-page.tsx` | production | editorial | `8d9f207` | No | RESTORE (keeps Asaas/Pix/promotion functional diffs) |
| account | `account-shell.tsx` | production | editorial | `8d9f207` | No | RESTORE + fix: `aria-current` only on exact match or sub-route (`/minha-conta` no longer stays current on `/minha-conta/pedidos`) |
| account | `minha-conta/**`, `customer-addresses.tsx`, `customer-profile-form.tsx`, `pedidos/page.tsx` | production | editorial | `8d9f207` | No | RESTORE |
| auth | `customer-auth-forms.tsx`, `customer-auth-shell.tsx`, `login-banner-panel.tsx` | h1 900, rounded banner | 500, `variant` prop | `8d9f207` | No | RESTORE |
| policy | `contato`, `sobre`, `politica-de-envio`, `privacidade-e-termos`, `trocas-e-devolucoes`, `not-found-page.tsx` | production | editorial | `8d9f207` | No | RESTORE |
| media | `product-media.tsx`, `product-card-hover-image.tsx` (`sizes`) | renderPlan sizes | responsive `sizes` | `83c7243` | Yes (perf) | KEEP |
| admin | all admin surfaces | — | — | — | No drift | KEEP |

## Tests changed and why (no test was changed to hide a behavior regression)

| Test | Change | Reason |
|---|---|---|
| `login-banner-panel.test.ts` | Rewritten without `variant` | Asserted the redesign-only prop; now asserts the production classes, media framing and optimized local fallback. |
| `home-hero-carousel.test.ts` | Contrast test now targets the production gradient (`rgba(0,0,0,0.86)`/`0.68`) and `bg-white/60` dots; many-indicator test asserts the bounded group | The old test encoded the rejected `bg-black/60` overlay. The 3:1 non-text contrast requirement is still enforced numerically. |
| `(store)/page.test.ts`, `home-discovery.test.ts` | Restored from `main` | Encoded the editorial home. |
| `home-motion.test.ts` | Dropped `data-motion-control` / global control assertions | That control was redesign UI; the never-autoplay-when-empty assertion is kept. |
| `tests/visual-storefront/matrix.spec.ts` | Redesign metrics (10/11/12px motion/nav/button) replaced by production baseline (neutral-50 canvas, black header, 8px hero radius, weight 900, 16px login input) | Regression now guards the approved look. Axe, overflow and skip-link checks unchanged. |
| `tests/visual-storefront/states.spec.ts` | 360px ten-banner test: arrows hidden on mobile (production), group bounded to viewport, first indicator ≥44px, last indicator focus unclipped | Production shows arrows only on desktop; touch-target and focus requirements kept. |
| fixture harness (`main.tsx`, `vite.config.ts`, `mocks/backend.ts`) | `#store-main`, promotions module mocked, base `pricing` on products | Needed for the restored layout and promotions-aware components to render offline. |

## Validation (local, fixture-only, 2026-11-13)

- `npx vitest run`: 177 files, 1631/1631.
- `npm run typecheck`, `npm run lint`: clean.
- Visual fixture `matrix.config.ts`: 44/44 (8 widths × 5 routes with Axe/overflow/skip-link + motion/commerce/network-guard).
- `states.config.ts`: 8/8. `playwright.config.ts` (chromium/webkit gallery & storefront): 111 passed, 6 skipped.
- `scripts/qa-visual-capture.mjs` re-capture against the fixture: header and h1 metrics equal production (table above).

Not yet verified: a staging deploy of this restoration (requires operator push/deploy approval) and real-browser review against production data. Reviewer must reproduce with the commands above.
