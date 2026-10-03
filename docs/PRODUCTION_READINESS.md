# RARE — production readiness

Assessment: 2026-10-03, branch `codex/admin-dashboard-reconciled-20261002`. This cycle prepares a reviewable release; it does **not** authorize merge, deployment, migrations on a real database or activation of commerce. No production environment or provider was changed.

## Evidence boundary

Local QA uses synthetic data and disabled external side effects. PASS in Code means the inspected implementation/contract passed relevant local tests, not an externally homologated integration. LOCAL VERIFIED means the observed local environment only. Staging and Production describe verification of **this candidate**, not an assertion that the existing live service is broken or absent. No staging URL, provider callback, secret value or live catalog inventory is inferred.

Statuses used: PASS, LOCAL VERIFIED, STAGING VERIFIED, EXTERNAL HOMOLOGATION REQUIRED, BLOCKED, NOT TESTED, NOT APPLICABLE. Blocker status refers to opening this release for production; unresolved evidence or authorization is BLOCKED, not necessarily a code defect.

## Matrix

| Área | Code | Local QA | Staging | External | Production | Blocker | Próxima ação |
|---|---|---|---|---|---|---|---|
| Admin | PASS | LOCAL VERIFIED | NOT TESTED | NOT APPLICABLE | NOT TESTED | BLOCKED | Review actual PR, remote gates and isolated staging Admin flows |
| Database | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify target/version, backups, capacity and schema |
| Migrations | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Authorize target/window/single executor; follow migration runbook |
| Storage | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Configure persistent R2 and prove read/write/media durability |
| Stripe | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Fully isolated Stripe Test Mode homologation; no live charge |
| Checkout | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Keep flag closed; validate provider/payment/reservation lifecycle |
| PIX | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Validate account capability, expiry, asynchronous success/failure in Test Mode |
| Parcelamento | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Define requirement/account support; no explicit installment implementation found |
| Webhooks | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify signed test delivery, duplicates, retries and mode matching |
| Shipping | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Make staging guard explicit; replace/approve legacy fixed mode |
| Melhor Envio | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Sandbox token/endpoint and dimensional quote homologation |
| Email | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Isolated allowlisted delivery, selected provider and outbox ownership |
| Uploads | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Re-run upload/editor contracts against persistent storage/CDN |
| Cron | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify live topology and approve one owner per environment |
| Produtos/dimensões | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Correct measured local catalog data; separately audit authorized live catalog |
| Security | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Accept/resolve residual dependency risk; verify deployed guards/rate-limit backend |
| Monitoring | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Prove external health/alerts, queue and provider observability |
| Rollback | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Restore drill and compatible artifact with revocation guarantees |

## Admin, security and local gates

Auth is server-side near data/effects, not layout-only: active ADMIN, signed/unexpired token, current credentialVersion and sessionVersion, forced temporary-password change. Administrative actions validate selected fields/IDs/enums; APIs enforce same-origin, content type, byte-counted payload limits and quotas. Upload multipart and push POST/DELETE include missing/false Content-Length, oversized streams, 413/415 and rate-limit regressions. FR-01..04 remain covered (payload bounds, repeated query params, deterministic pagination/ID ties and long-content overflow/clipping).

Current execution: lint/typecheck PASS; 147 unit/integration files, 1,134 tests PASS; 21 Admin/auth files, 140 tests PASS in each of three targeted runs; Prisma validate/generate PASS; all 14 migrations from zero and three SQL contract runs PASS on disposable local QA. E2E: 178 passed, 62 skipped, zero failures/flaky tests (three browser projects); QA database/storage removed and port released. Skips: 24 require isolated staging checkout, 24 require a product fixture with 2+ images, 14 are project-specific scope. Those 48 uncovered scenarios are NOT TESTED, not external homologation evidence; no skip/assertion was changed to obtain a pass. Admin accessibility and responsive scope are recorded in `cycles/ADMIN_FINAL_INTEGRATION.md`. Clean production build/standalone and 28 Server Action exports PASS.

`app:check` completed without technical blockers locally, but its warnings are commercial release gates: local storage, legacy fixed freight, five active products without shipping dimensions and checkout disabled. `db:check`/migrate status report the two pending migrations on `rare_dev`; this expected nonzero result is **not** green database release readiness.

## Payments / checkout / webhooks

- Checkout guard is closed by default without explicit enablement; local CHECKOUT_ENABLED=false and isolated QA also forces false. This PR makes no commercial activation change.
- Stripe implementation pins API version `2026-04-22.dahlia`, selects card/PIX, bounds request time/retries, uses an order-scoped checkout idempotency key, and validates payment status before reconciliation. Success/cancel routes are `/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}` and `/finalizar-compra?checkout=cancelado&pedido=...`.
- `POST /api/stripe/webhook` verifies the signature on the raw body, matches test/live event mode to the configured key, deduplicates events and locks/reconciles orders transactionally. Closing checkout does not disable webhook reconciliation for existing orders.
- Local tests use controlled mocks; no safe, complete external Test Mode setup was established or charged here. PIX, redirects, asynchronous completion, retries, cancellations and account capability require authorized Test Mode homologation. No explicit installment configuration was found; card support alone is not parcelamento approval.

## Shipping / Melhor Envio / catalog

The endpoint allowlist is production `https://www.melhorenvio.com.br` or sandbox `https://sandbox.melhorenvio.com.br`, calling `/api/v2/me/shipment/calculate` with a manually configured Bearer token. The default timeout is 8 seconds, with sanitized errors. The repository has no OAuth callback, code exchange or automatic refresh flow; do not invent one.

**Shipping is not globally closed by default:** disabled mode returns false, an explicit SHIPPING_ENABLED is respected, but when unset a non-disabled mode is enabled. The local read-only assessment found legacy fixed mode, not proof that freight is off. QA explicitly forces SHIPPING_ENABLED=false. Keep that guard explicit in isolated staging and do not activate/change real freight in this cycle. Manual/fixed modes can use the 1,000g / 10×35×35cm fallback; it is not measured data or automatic-provider readiness.

The current read-only `shipping:dimensions:audit` examined all 10 products on **local `rare_dev`**, without truncation. Five active products lack weight/length/width/height:

| Local ID | Slug | Missing fields |
|---|---|---|
| cmp31aine0005q4o75z3winrf | supreme-bag | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aio10007q4o7ml7c0wr4 | bone-chrome-hearts | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aio60009q4o7coozl8mm | jaqueta-nike-nocta | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aioa000bq4o7e1fhq37v | camiseta-bape | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aiof000eq4o7qj1ug59f | camiseta-hellstar | weightGrams, lengthCm, widthCm, heightCm |

`camiseta-bape` additionally reports VARIANT_MAY_CHANGE_PACKAGE. No measurements were invented or stored. This is **not** a production catalog list; live data requires a separately authorized read-only audit and measured packaging corrections.

## Email

Explicit selection only: `disabled` (default), `smtp`, `zeptomail`; no automatic provider fallback. Test policy/allowlist and send-not-before protect external delivery/backlog when correctly configured. The durable outbox has atomic token/lease claims, bounded retries and `uncertain` handling, not guaranteed exactly-once provider delivery. The persistent checkout worker drains it when enabled; the Vercel expiry route does not. No real email or bulk send was performed. Verify the chosen provider, test recipient allowlist, delivery and uncertain-message handling externally before enabling.

## Storage / uploads

Local mode defaults to `public/uploads` and `/uploads`. Uploaded product/banner originals and generated static WebP variants depend on durable object storage; ProductImage.url and banner imageUrl/mobileImageUrl are persisted references. Existing URLs must be inventoried before any separately authorized media migration.

Production R2 configuration uses STORAGE_DRIVER=r2, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL (or STORAGE_PUBLIC_BASE_URL). The S3-compatible endpoint is derived from the account. Partial R2 configuration fails; there is no automatic R2-to-local fallback. Uploads in production local mode are blocked, except an explicit restricted-staging local-storage exception; that exception still needs persistent storage and is not production approval.

Local filesystem media can disappear on redeploy or differ across instances. Verify persistent object write/read, public/CDN URLs, variants, editor and existing catalog references. No real credentials, R2/CDN configuration or media backfill was changed/tested externally in this cycle.

## Database / cron / monitoring / rollback

- [Pending migrations runbook](runbooks/PENDING_MIGRATIONS.md): ordinary index locks and session-column locks; backup, recovery and single executor. Railway pre-deploy automatically migrates with advisory locking disabled: authorization is needed **before deploying**, even if checkout remains closed.
- [Cron ownership runbook](runbooks/CRON_OWNERSHIP.md): Railway worker RECOMMENDED primary, Vercel daily fallback plan; actual services/targets NOT TESTED. SKIP LOCKED/leases do not elect an owner or guarantee external exactly-once effects.
- Public health is minimal/no-store; protected diagnostics include runtime/artifact information. Local health contracts do not prove external alerts, durable workers or production DB monitoring.
- Production backup/restore, known-compatible rollback artifact and post-checkpoint write reconciliation are NOT TESTED. Preserve session revocation when rolling application code back; never drop/reset the session columns as automatic rollback.

## Dependency risk and upstream path

Current lock: Next 16.3.8, Nodemailer 10.0.13, Prisma/client/adapter 7.9.1. Runtime audit: **3 high** entries in direct Prisma → transitive @prisma/config → deepmerge-ts 7.1.5. Full audit: **16 high**, comprising those 3 plus 13 dev/tooling entries (ESLint/Lighthouse chains), not 16 distinct production exploits.

[GHSA-ggr8-5vv4-36mx](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx) affects recursive object graphs and is fixed in deepmerge-ts 8; ordinary parsed JSON cannot itself contain recursive references. No application request path directly imports deepmerge. Prisma remains in the production install tree, so the advisory is not dismissed as dev-only. Mitigation is controlled repository-owned Prisma configuration and bounded/validated request inputs; this is risk reduction, not an upstream fix.

Current registry check: compatible stable Prisma 7.10.0 still pins deepmerge-ts 7.1.5; 8.0.0-rc.19 is a prerelease, not a stable compatible resolution. [Prisma upstream issue](https://github.com/prisma/orm/issues/30052) tracks the bump. **UPSTREAM_WAIT**: keep the reviewed lockfile; no audit fix --force, major downgrade, forced deepmerge override or gratuitous upgrade. Track a stable coordinated Prisma/client/adapter release, inspect its tree and rerun audits/gates. Available unrelated newer patches do not establish a fix for this chain. Dev-tooling upgrades need their own reviewed compatibility work. Explicit residual-risk disposition is required before production release.

## Release decisions

- READY FOR MERGE: **NO** until an actual PR exists and remote required checks/reviews/protection can be verified. Local branch ancestry is reconciled, but absence of CI is not green CI.
- READY FOR STAGING/HOMOLOGATION: **NO** until an authorized isolated target, non-live providers, side-effect guards, migration window/executor and persistent storage are established. The candidate and runbooks are prepared, not deployed.
- READY FOR PRODUCTION: **NO** until the staging/external gates, migrations, measured catalog, cron ownership, dependency risk disposition, monitoring/rollback and explicit promotion authorization are complete.

No main merge, live deploy, real-database migration/reset, DNS/secret change, commerce activation or live cron disable was performed.
