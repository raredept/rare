# RARE — production readiness

## Current staging recovery-gate attempt — 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** [STAGING_DATABASE_GATE.md](security/STAGING_DATABASE_GATE.md) is the current execution dossier; [incident timeline](security/CREDENTIAL_INCIDENT_202610.md) and [rotation approval boundary](security/CREDENTIAL_ROTATION_APPROVAL.md) agree. One authorized backup-create request targeted the exact verified staging PG instance and returned INTERNAL_SERVER_ERROR without workflowId; three post-listings remain 0 snapshots / 0 schedules. MANUAL_BACKUP_FAILED; BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; RESTORE_DRILL_VERIFIED=NO. Backend outcome/cost UNKNOWN; no retry, deletion/schedule or restore.

The backup prerequisite prevented key generation/registration and SSH/SQL. Actual DB version/schema/applied/pending/failed/rolled-back/checksum mismatch remain UNKNOWN; history not verified, no no-op assertion, PHASE_M_REQUIRED=UNKNOWN. Latest staging deployments/mount/READY state unchanged; web predeploy still migrates with advisory lock disabled, worker NONE; exact next configuration remains NOT VERIFIED. SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN. No source/runtime/config/variables/deployment/credential rotation/commercial-provider/commerce or production action performed. Independent runtime writes were not paused or audited.

Entry Git local/remote b781aa0287a8a676792a8ef6c60671fd4e2b2489, main/deployed source 4ea73f50cafdbf67e16dc71de985052075feca42, 28 ahead / 0 behind. Final doc HEAD/count/equality are reported after push. One exact PR search returned none; PR_CREATION_BLOCKED_BY_PERMISSION retained, no create retry. Credentials still COMPROMISED; all READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. Recommended next gate: owner triages the failed request and reconciles any delayed snapshot before fresh authority for another creation; no SSH/Phase S without checkpoint. Only five requested docs change; no E2E/build/runtime-suite rerun. All older no-backup-create statements below are historical, not this attempt's result.

## Historical secret activation / migration gate update — 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Current [SECRET_ACTIVATION_GATE.md](security/SECRET_ACTIVATION_GATE.md) and [incident update](security/CREDENTIAL_INCIDENT_202610.md) supersede execution authority for this read-only cycle. Rotation, deploy/restart/migration/config/provider writes and backup/restore were not performed; credentials remain COMPROMISED and local sensitive copies preserved.

Fresh Git entry documentation HEAD 4b78a32623958dd8b0ed36b530a08df08e7c0639, main unchanged 4ea73f50cafdbf67e16dc71de985052075feca42, 27 ahead / 0 behind. Staging web/worker still deploy that main baseline. Web snapshot/stored migration predeploy confirmed, worker NONE; API selectors null. Current stored executor count 1 does not prove future count. Exact current file attribution/next config remains unresolved. Restart secret refresh and any no-DDL activation path NOT PROVEN; redeploy/caching retains predeploy risk.

DB identity boundary verified privately; existing proxy strict-TLS access failed SELF_SIGNED_CERT_IN_CHAIN before SQL, noninteractive SSH failed NO_EXISTING_SSH_KEY; no TLS bypass/access registration. STAGING_MIGRATION_HISTORY_VERIFIED=NO; all real migration counts/DDL pending UNKNOWN. Backup API now confirms 0 snapshots/0 schedules on the exact staging PG volume instance; no adequate PITR/logical dump/restore proof. BACKUP_AVAILABLE=NO verified adequate checkpoint; RESTORE_DRILL_VERIFIED=NO; STAGING_BACKUP_VERIFIED=NO. This resolves volume inventory, not recovery readiness.

Recommended Option C: keep freeze, resolve legitimate access/trust, separately authorize exact backup/recovery and verify next config. Any migration-dependent route must separate Phase M from subsequently authorized Phase S. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. One PR search still absent; permission blocker retained with no creation retry; empty statuses/PR-triggered Actions are not green CI. No full E2E/build/activation experiment rerun. Historical sections below do not grant authority.

## Phase S execution update — 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE. PHASE_S_FAILED — preflight abort before mutation. ABORT — DEPLOY_BLOCKED_BY_MIGRATION_RISK.** Staging credential rotation is now conditionally authorized by the owner, but the no-migration activation prerequisite failed. Production rotation remains unauthorized. [Execution evidence](security/CREDENTIAL_INCIDENT_202610.md#phase-s-authorized-execution-attempt--2026-10-06) and [current conditional approval/production plan](security/CREDENTIAL_ROTATION_APPROVAL.md) supersede the historical authorization statuses below.

Fresh Git entry local/remote 42d0ca92c7816f870d2e543c13b847ecc9bcdc0f; main unchanged; 26 ahead / 0 behind. Existing staging web/worker source remains 4ea73f5. TEST keys match across those consumers and differ from production; configured staging DB/Redis match dedicated services. Web still has migrate deploy predeploy. Restart did not establish fresh-variable activation; redeploy cannot be treated as migration-free. No replacements, variable/config changes, restart/deploy, migration, local sensitive-copy cleanup or provider mutation performed. Health HTTP 200 / ok_with_warnings is baseline evidence, not containment.

All four staging and production categories remain compromised pending verified closure. No old-key/signature retirement or new session/webhook/cron behavior proved. Production plan updated only conditionally with the failed activation lesson; Phase P live preparation/execution not started. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. Documentation alone does not lift freeze or deploy either frozen candidate SHA.

## Initial P0 containment update — historical snapshot, 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE.** Current decision artifact: [CREDENTIAL_ROTATION_APPROVAL.md](security/CREDENTIAL_ROTATION_APPROVAL.md), with [sanitized incident/evidence](security/CREDENTIAL_INCIDENT_202610.md). Staging and production credential containment require separate approval and actual verified completion; neither phase is authorized. Production rotation is urgent independently of the Admin release. No credential/environment/service/DB change or cleanup was executed.

Fresh Git entry local/remote 06981b8c844590b4f1c94cc3a41898cf7bd3404b, main unchanged, 25 ahead / 0 behind. CODE_CANDIDATE_SHA remains 7a820b62bb1515f7b30ccf31badf1f0881a6bd84; STAGING_DEPLOYMENT_CHECKPOINT remains b06ef6e437ee2d28fbeffeb5f91144c389aaa518; documentation does not replace either. Both environments' web/worker pairs remain on 4ea73f5 in read-only inventory. All four affected categories remain COMPROMISED pending closure evidence; current presence/difference is not revocation proof.

Current/reachable-history scan found no confirmed real affected credential in versionable files/text blobs (207 commits / 1,709 text blobs). Local ignored root env and five generated standalone env copies contain the configured TEST key; PowerShell history contains additional credentialed URLs of unknown validity, not matching current PG passwords. Local Codex transcript content was inaccessible due to file use, not a clean scan. Binary/encoded/unreachable/remote-retention gaps remain explicit. Repository cleanliness does not restore credential confidentiality.

Both staging AND production web predeploys run migrate deploy with advisory locking disabled. Secret refresh cannot silently authorize DDL, deploy the candidate or restore compromised variables via native rollback. ADMIN_SESSION_SECRET rotation logs out customers as well as Admins. CRON_SECRET_PREVIOUS support exists in current/deployed scoped source but is absent in live web config; retaining the compromised previous value requires explicit incident risk acceptance and deadline, not an automatic continuity workaround.

PR remains absent; no creation retry; main protection read 403. Entry-HEAD check-runs/statuses and all repository Actions runs 0: NOT CONFIGURED / none reported, never PASS. READY FOR MERGE=NO; READY FOR STAGING BOOTSTRAP=NO; READY FOR EXTERNAL HOMOLOGATION=NO; READY FOR PRODUCTION=NO. Credential containment and migration/checkpoint/executor approval are cumulative. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain; no DB access attempt/full E2E rerun/dependency change here. Earlier dated sections are historical evidence, not waiver of this freeze.

Assessment: 2026-10-03, branch `codex/admin-dashboard-reconciled-20261002`. This cycle prepares a reviewable release; it does **not** authorize merge, deployment, migrations on a real database or activation of commerce. No production environment or provider was changed.

## Final preflight update — 2026-10-04

Current decision dossier: [STAGING_BOOTSTRAP_APPROVAL.md](cycles/STAGING_BOOTSTRAP_APPROVAL.md). Immutable deployment checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518; last runtime/test commit 7a820b62bb1515f7b30ccf31badf1f0881a6bd84, with only docs changes afterward. New documentation HEAD is reported after push, not another homologated code version. Main unchanged, initial ahead/behind 24/0; no app suite rerun or Admin refactor.

Read-only Railway inventory/flags/domain/mounts/provider registration remain as below. Web/worker/PG/Redis each have one running instance, one active deployment and one configured replica. Configured staging DB/Redis and mounted-volume IDs differ from production; worker Redis absent (DB-backed queue, no added dependency). Candidate not deployed. The two rare_dev pending migrations cannot be inferred for staging: direct read-only PG attempt failed trusted TLS, and SSH path needs key registration. No trust bypass/access setup, query result, backlog count or migration was obtained. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain blockers.

Web-only migration execution is a proposed gate, not proven for a future source change: verify explicit /railway.json web and /railway.cron.json worker selectors/effective manifests so code-config precedence cannot make the worker migrate too. Checkout=false does not pause expiry reconciliation or webhooks; they can update existing TEST orders and expire TEST sessions. Only new checkout/quote/email initiation is closed by the proposed three flags after runtime verification. Approved quiescence/backlog handling is required; no scheduler/process was stopped here.

**P0 credential containment required:** an erroneous PowerShell comparison emitted staging/production Stripe keys and webhook/Admin-session/cron secret values into a tool-output record in this conversation. No values are copied into repository files. Corrected comparisons emit classifications only; a file secret scan does not undo record exposure. Owner-led rotation/revocation and coordinated consumer/session/webhook recovery are required; production changes need separate explicit approval. No automatic rotation was performed and no confidentiality guarantee is claimed.

PR remains absent after fresh search/one 403 creation attempt; required reviews/protection UNKNOWN, zero reported checks/statuses/Actions on frozen SHA. READY FOR STAGING BOOTSTRAP: NO; AUTHORIZED FOR STAGING BOOTSTRAP: NO; READY FOR EXTERNAL HOMOLOGATION: NO. Existing merge/production NO decisions remain. Prisma registry re-read 2026-10-04 shows unchanged 7.10.0/config deepmerge-ts 7.1.5 and latest 8 prerelease; UPSTREAM_WAIT unchanged. Audit counts below are dated previous-cycle results, not a new audit run.

## Evidence boundary

Local QA uses synthetic data and disabled external side effects. PASS in Code means the inspected implementation/contract passed relevant local tests, not an externally homologated integration. LOCAL VERIFIED means the observed local environment only. Staging and Production describe verification of **this candidate**, not an assertion that the existing live service is broken or absent. No staging URL, provider callback, secret value or live catalog inventory is inferred.

Statuses used: PASS, LOCAL VERIFIED, STAGING VERIFIED, EXTERNAL HOMOLOGATION REQUIRED, BLOCKED, NOT TESTED, NOT APPLICABLE. Blocker status refers to opening this release for production; unresolved evidence or authorization is BLOCKED, not necessarily a code defect.

## Matrix

| Área | Code | Local QA | Staging | External | Production | Blocker | Próxima ação |
|---|---|---|---|---|---|---|---|
| Admin | PASS | LOCAL VERIFIED | NOT TESTED | NOT APPLICABLE | NOT TESTED | BLOCKED | Review actual PR, remote gates and isolated staging Admin flows |
| Database | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify target/version, backups, capacity and schema |
| Migrations | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Authorize target/window/single executor; follow migration runbook |
| Storage | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify dedicated staging volume read/write/redeploy; separately approve persistent production R2 |
| Stripe | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Fully isolated Stripe Test Mode homologation; no live charge |
| Checkout | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Keep flag closed; validate provider/payment/reservation lifecycle |
| PIX | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Validate account capability, expiry, asynchronous success/failure in Test Mode |
| Parcelamento | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Define requirement/account support; no explicit installment implementation found |
| Webhooks | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify signed test delivery, duplicates, retries and mode matching |
| Shipping | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Existing staging web flag is true: authorize false bootstrap before sandbox homologation; do not change live freight |
| Melhor Envio | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Sandbox token/endpoint and dimensional quote homologation |
| Email | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Isolated allowlisted delivery, selected provider and outbox ownership |
| Uploads | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Re-run upload/editor contracts against persistent storage/CDN |
| Cron | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Railway workers/DB targets inventoried; verify runtime queues and Vercel live topology; approve owner |
| Produtos/dimensões | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Correct measured local catalog data; separately audit authorized live catalog |
| Security | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Accept/resolve residual dependency risk; verify deployed guards/rate-limit backend |
| Monitoring | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Prove external health/alerts, queue and provider observability |
| Rollback | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Restore drill and compatible artifact with revocation guarantees |

## Admin, security and local gates

Auth is server-side near data/effects, not layout-only: active ADMIN, signed/unexpired token, current credentialVersion and sessionVersion, forced temporary-password change. Administrative actions validate selected fields/IDs/enums; APIs enforce same-origin, content type, byte-counted payload limits and quotas. Upload multipart and push POST/DELETE include missing/false Content-Length, oversized streams, 413/415 and rate-limit regressions. FR-01..04 remain covered (payload bounds, repeated query params, deterministic pagination/ID ties and long-content overflow/clipping).

Local closing-cycle QA on 2026-10-03, retained for the unchanged runtime (not rerun during docs-only staging preparation): lint/typecheck PASS; 147 unit/integration files, 1,134 tests PASS; 21 Admin/auth files, 140 tests PASS in each of three targeted runs; Prisma validate/generate PASS; all 14 migrations from zero and three SQL contract runs PASS on disposable local QA. E2E: 178 passed, 62 skipped, zero failures/flaky tests (three browser projects); QA database/storage removed and port released. Skips: 24 require isolated staging checkout, 24 require a product fixture with 2+ images, 14 are project-specific scope. Those 48 uncovered scenarios are NOT TESTED, not external homologation evidence; no skip/assertion was changed to obtain a pass. Admin accessibility and responsive scope are recorded in `cycles/ADMIN_FINAL_INTEGRATION.md`. Clean production build/standalone and 28 Server Action exports PASS.

`app:check` completed without technical blockers locally, but its warnings are commercial release gates: local storage, legacy fixed freight, five active products without shipping dimensions and checkout disabled. `db:check`/migrate status report the two pending migrations on `rare_dev`; this expected nonzero result is **not** green database release readiness.

## Payments / checkout / webhooks

- Checkout guard is closed by default without explicit enablement; local CHECKOUT_ENABLED=false and isolated QA also forces false. This PR makes no commercial activation change.
- Stripe implementation pins API version `2026-04-22.dahlia`, selects card/PIX, bounds request time/retries, uses an order-scoped checkout idempotency key, and validates payment status before reconciliation. Success/cancel routes are `/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}` and `/finalizar-compra?checkout=cancelado&pedido=...`.
- `POST /api/stripe/webhook` verifies the signature on the raw body, matches test/live event mode to the configured key, deduplicates events and locks/reconciles orders transactionally. Closing checkout does not disable webhook reconciliation for existing orders.
- Local tests use controlled mocks. The later read-only staging discovery confirms TEST keys and an enabled test webhook registration, not a complete externally tested setup; no charge/session was created. PIX, redirects, asynchronous completion, retries, cancellations and account capability require authorized Test Mode homologation. Parcelamento is REQUIRES PRODUCT DECISION, account/product support NOT VERIFIED; no explicit implementation was found and card capability alone is not approval.

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
- [Cron ownership runbook](runbooks/CRON_OWNERSHIP.md): Railway web/worker deployment inventory and distinct staging/production DB targets verified read-only; processing/queue health and Vercel live inventory NOT TESTED. KEEP Railway; Vercel UNKNOWN until inventory, then DISABLE AFTER APPROVAL only if redundant. SKIP LOCKED/leases do not elect an owner or guarantee external exactly-once effects.
- Public health is minimal/no-store; protected diagnostics include runtime/artifact information. Local health contracts do not prove external alerts, durable workers or production DB monitoring.
- Production backup/restore, known-compatible rollback artifact and post-checkpoint write reconciliation are NOT TESTED. Preserve session revocation when rolling application code back; never drop/reset the session columns as automatic rollback.

## Live staging discovery — configuration, not candidate homologation

Read-only on 2026-10-03: [STAGING_SAFETY.md](runbooks/STAGING_SAFETY.md) records actual Railway environment/service/deployment identities and all bootstrap gates. Existing URL is <https://rare-staging-staging.up.railway.app>. Web and worker deploy integration/pre-go-live at main baseline `4ea73f50cafdbf67e16dc71de985052075feca42`, not this Admin candidate. Therefore the matrix's candidate Staging column remains NOT TESTED.

Dedicated staging Postgres/Redis targets match their services and differ from production. Stripe web/worker keys are TEST, matching each other and different from production; webhook/session/cron secrets are present and distinct. Storage is local `/data/uploads` on a dedicated `/data` volume with `/uploads` URL base; all five R2 settings are missing. This is configured staging persistence, not tested media durability or production R2 readiness. Melhor Envio uses the sandbox endpoint fallback; token authentication/quotes were not exercised.

Existing staging is a laboratory: **web checkout=true and shipping=true**, not the requested false bootstrap. Web/worker SMTP test mode has valid matching EMAIL_TEST_RECIPIENTS (two) and EMAIL_SEND_NOT_BEFORE; config validation reports smtp_configured_delivery_unverified. Recipients/backlog are not authorized for this cycle. Bootstrap requires explicitly false flags and email disabled on participating processes, after approval to repurpose this existing environment. No external configuration was changed.

Public GET evidence: health 200 / ok_with_warnings, root 401 Basic, robots disallow-all, no-store/noindex/nofollow. Stripe read-only account evidence is BR/card_payments active; no PIX capability confirmation. One enabled TEST webhook points to the actual staging /api/stripe/webhook with the six documented events. Registration does not prove signed delivery/idempotency/reconciliation. No test charge, quote, email, media write or DB migration was performed.

Live staging web pre-deploy is `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`. Target identity is known but real staging migration history, backup/recovery, single executor and authorization remain unverified. **STAGING_DEPLOY_BLOCKED / DEPLOY_BLOCKED_BY_MIGRATION_RISK**: do not deploy the candidate before these gates. Known two pending rare_dev migrations are prior local evidence, not an inferred staging state. Worker SUCCESS/active deployment metadata does not prove queue/backlog health; Vercel live target remains UNKNOWN.

## DEPENDENCY RESIDUAL RISK

Current lock: Next 16.3.8, Nodemailer 10.0.13, Prisma/client/adapter 7.9.1. Runtime audit refreshed during staging preparation: **3 high**, zero critical, in direct Prisma → transitive @prisma/config → deepmerge-ts 7.1.5 (`output/staging-prep-audit-runtime.json`, ignored). Prior closing-cycle full audit: **16 high**, comprising those 3 plus 13 dev/tooling entries (ESLint/Lighthouse chains), not 16 distinct production exploits; full audit was not rerun for doc-only changes.

[GHSA-ggr8-5vv4-36mx](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx) affects recursive object graphs and is fixed in deepmerge-ts 8; ordinary parsed JSON cannot itself contain recursive references. No application request path directly imports deepmerge. Prisma remains in the production install tree, so the advisory is not dismissed as dev-only. Mitigation is controlled repository-owned Prisma configuration and bounded/validated request inputs; this is risk reduction, not an upstream fix.

Registry/advisory refreshed 2026-10-03: compatible stable Prisma 7.10.0 still pins deepmerge-ts 7.1.5; latest tag 8.0.0-rc.19 is a prerelease, not a stable compatible resolution. [Prisma upstream issue](https://github.com/prisma/orm/issues/30052) remains open. **UPSTREAM_WAIT**: keep the reviewed lockfile; no audit fix --force, major downgrade, forced deepmerge override or gratuitous upgrade. Track a stable coordinated Prisma/client/adapter release, inspect its tree and rerun audits/gates. Available unrelated newer patches do not establish a fix for this chain. Dev-tooling upgrades need their own reviewed compatibility work.

**Release decision required:** the owner must document acceptance or deferral of the remaining advisory, mitigations, accountable reviewer and revisit trigger before production promotion. No commercial residual risk was accepted on the owner's behalf. Controlled configuration/bounded inputs reduce exposure but are not an upstream fix; production remains blocked pending that decision.

## Release decisions

- READY FOR MERGE: **NO** until an actual PR exists and remote required checks/reviews/protection can be verified. Local branch ancestry is reconciled, but absence of CI is not green CI.
- READY FOR STAGING/HOMOLOGATION: **NO**. Target and separate configured DB/Redis/Test secrets are identified; existing false-bootstrap requirements are not satisfied, sandbox auth/media/monitoring remain untested, and backup/executor/migration authorization are missing. The candidate and runbooks are prepared, not deployed.
- READY FOR PRODUCTION: **NO** until the staging/external gates, migrations, measured catalog, cron ownership, dependency risk disposition, monitoring/rollback and explicit promotion authorization are complete.

No main merge, live deploy, real-database migration/reset, DNS/secret change, commerce activation or live cron disable was performed.
