# Local storefront fixture QA

This test-only Vite preview renders the real storefront presentation components and selected real page functions, using synthetic in-memory fixtures. It is **not** a Next.js server, live catalog, authenticated session, database emulator, or release/production validation. No production source is aliased outside this config.

## Safety boundary

- Exact loopback origin `http://127.0.0.1:4173`, strict port, no `.env` loading (`envDir: false`), deterministic browser environment.
- Catalog/settings/banners/auth/shipping are explicit QA-only modules. Prisma calls throw; customer actions return a fixture-only refusal without persistence.
- Backend/provider/Node imports are refused by a Vite plugin. API requests and non-GET/HEAD server requests are refused; CSP blocks external resources and form transport. Browser fetch/XHR refuse backend endpoints and external hosts. External anchor clicks are cancelled.
- No install, seed, migration, SQL, Railway, SSH, WARP, provider credentials, email/payment/shipping calls or production changes.
- Production Tailwind/CSS and the existing local Geist font are reused. Seed SVGs are local test illustrations, not new catalog or campaign photography.

## Commands (repository root)

Start only this preview in a separate local terminal:

```powershell
node node_modules/vite/bin/vite.js --config tests/visual-storefront/vite.config.ts
```

After reviewing the preview, run fixture-only browser checks:

```powershell
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/playwright.config.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/playwright.config.ts accessibility.spec.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/playwright.config.ts keyboard.spec.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/playwright.config.ts links.spec.ts --project=chromium-desktop
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/matrix.config.ts
node node_modules/@playwright/test/cli.js test --config tests/visual-storefront/states.config.ts
npm run test:a11y -- --config tests/visual-storefront/playwright.config.ts accessibility.spec.ts
npm run test:keyboard -- --config tests/visual-storefront/playwright.config.ts keyboard.spec.ts
npm run check:links -- --config tests/visual-storefront/playwright.config.ts links.spec.ts
```

Do not invoke `qa:e2e:isolated`, the default Playwright webServer, staging checkout specs, or provider smoke scripts for this frontend cycle. This config never starts a server automatically, never inherits a remote base URL, and excludes Admin/checkout-provider/release-runtime specs. QA wrappers reuse existing specs, add a fixture-ready navigation wait and a strict loopback browser-context allowlist. The main Playwright config remains untouched; the existing keyboard spec now explicitly checks the storefront skip-link before Header focus. The critical skip-link has explicit `tabIndex={0}` in both the real layout and this preview; the test uses plain Tab in every engine, including WebKit. Remaining fixture-specific selectors must be reported as limitations, not fixed by enabling a backend.

## Routes and states

Home `/`, category `/categoria/tudo` / `/categoria/camisetas` / `/categoria/destaques`, product `/produto/qa-camiseta`, paused checkout `/finalizar-compra`, direct fixture-only cart component `/qa/cart`, `/entrar`, `/cadastro`, institutional pages, account presentation shells. Fixtures also cover `/produto/qa-esgotado`, `/produto/qa-reservado`, `/produto/qa-variante-inativa`, `/produto/qa-sem-imagem`, `/produto/qa-imagem-ausente`, `/produto/qa-video-ausente`, and excluded `/produto/qa-produto-inativo`.

Default commerce state is disabled. `?qaCommerce=enabled` is an explicit **in-memory UI-only** fixture scenario; actions/API/Prisma remain unavailable. `/?qaBanners=10` opts into ten synthetic hero slides using the same local fixture assets, for narrow-screen control/focus validation. Never infer provider readiness, stock/reservation correctness, auth security or checkout functionality from these fixtures. The main local QA checks use the disabled default.

Missing-media routes intentionally request absent local assets to exercise fallback, so do not include them in clean-console assertions. Those two records are excluded from default listing/home fixtures; opt in to list them with `?qaStates=all`. There is no playable local video fixture: video-error/fallback presentation is covered, playback is not. Vite SPA fallback may return HTTP 200 for unknown routes; no true Next 404, RSC streaming, server redirects, image optimizer, cookies or real metadata/SSR/performance equivalence is claimed. Category/account shells do not simulate real permissions or persistence. Catalog fixtures are bounded and do not validate backend pagination or sort transactions.

The matrix captures home/catalog/PDP/login/paused-cart at 360, 390, 430, 768, 1024, 1280, 1440 and 1600 px, checking overflow, Axe and the skip-link. It writes both full-page and `-viewport.png` captures, then separately checks reduced motion, enabled-commerce in-memory cart quantity state at 390/1440 px and transport refusal. The separate state config checks broken-first/healthy-second media recovery, essential control geometry, disabled product states and a localStorage-seeded paused cart without adding through a blocked purchase control. Screenshots are written only to `output/visual-storefront/screenshots`. These are local fixture results, not production or provider evidence. Run outcomes must be recorded separately; creating these files alone does not establish a passing runtime result.
