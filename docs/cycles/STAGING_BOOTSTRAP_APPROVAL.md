RARE — STAGING BOOTSTRAP APPROVAL

> Phase S execution update 2026-10-06: AUTHORIZED_PHASE_S=YES (conditional credential rotation only), AUTHORIZED_PHASE_P=NO. **PHASE_S_FAILED; ABORT — DEPLOY_BLOCKED_BY_MIGRATION_RISK; RELEASE_SECURITY_FREEZE=ACTIVE.** [Current execution record](../security/CREDENTIAL_INCIDENT_202610.md#phase-s-authorized-execution-attempt--2026-10-06) and [activation decision/conditional production plan](../security/CREDENTIAL_ROTATION_APPROVAL.md) supersede earlier approval statements. Fresh staging source remains 4ea73f5; web migration predeploy remains. No proved fresh-secret/no-DDL activation path, no rotation/configuration/restart/deploy/migration/cleanup performed. READY FOR STAGING BOOTSTRAP=NO and AUTHORIZED FOR STAGING BOOTSTRAP=NO; neither candidate promoted. Separate migration/history/checkpoint gates remain unresolved. Earlier dated sections below are historical snapshots.

> 2026-10-06: **RELEASE_SECURITY_FREEZE=ACTIVE**. First decision: [CREDENTIAL_ROTATION_APPROVAL.md](../security/CREDENTIAL_ROTATION_APPROVAL.md); evidence: [credential incident](../security/CREDENTIAL_INCIDENT_202610.md). Phase S must be executed and verified under new approval before candidate bootstrap; Phase P is separately urgent and never authorized by staging approval. Both live webs have migration predeploy, so credential refresh itself needs a reviewed migration-free activation path or independent migration authorization. No rotation/bootstrap/deploy/migration performed. All NO readiness/authorization states below remain.

Candidate: `b06ef6e437ee2d28fbeffeb5f91144c389aaa518` (immutable deployment checkpoint; see code/documentation distinction below).
Current staging SHA: `4ea73f50cafdbf67e16dc71de985052075feca42`.
Environment: Railway Rare / staging / `d8399691-dacf-41e9-a9d5-060c97672e39`.
Web: rare-staging / `3f4b79f6-2819-45a6-986d-584dc7ac803a`.
Worker: rare-checkout-worker-staging / `2bfcf6af-11f4-459f-9089-a841ae25e57f`.
Database: Postgres-MlyZ / `ed0a374e-79da-4aab-9e3a-bb684fb829d1`.
Redis: Redis-w0Fa / `6f6d7a25-00aa-44ba-9c52-92c194a0a082`.

DEPLOY WILL MODIFY DATABASE: **UNKNOWN** — web invokes migrate deploy; actual pending history is unverified, so real DDL is possible.
Production affected: **NO by the proposed staging resource changes**. Separate credential-confidentiality incident below affects production secrets; no production service/data/configuration was modified.

Date: 2026-10-04. **PREPARATION ONLY; AUTHORIZED FOR STAGING BOOTSTRAP: NO.** No environment/source/flag change, deploy/restart, migration, transaction, quote, email, storage write or cron change performed. PR creation was the only attempted external mutation and returned 403. Read-only provider GETs are not transactions or homologation.

## Immutable artifact / Git / review

- `CANDIDATE_SHA=b06ef6e437ee2d28fbeffeb5f91144c389aaa518`: published HEAD frozen before adding this documentation; future web/worker deployment must request this exact commit, not branch latest.
- `CODE_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84`: last runtime/test candidate commit. Diff from this SHA to b06ef6e contains **only docs**; local QA covers identical code/tests/dependency/configuration/migration trees.
- `DOCUMENTATION_HEAD`: the final pushed commit of this preflight, reported at closure. It adds documentation only, is not a newly homologated runtime, and must not silently replace the deployment SHA above.
- Main remains `4ea73f50cafdbf67e16dc71de985052075feca42`; start local/remote b06ef6e, 24 ahead / 0 behind. Final docs-only commit changes ahead count, not the frozen artifact. Revalidate main ancestry before execution; any code/base change requires a revised approval package.
- PR absent, GitHub CLI unavailable, one new Draft attempt returned 403: PR_CREATION_BLOCKED_BY_PERMISSION. No further automated attempt/token search. [Manual title/base/head/body](PR_STAGING_PREPARATION.md).
- Frozen-SHA checks: 0 check-runs / 0 individual statuses / 0 Actions runs. NOT CONFIGURED / none reported, not PASS. Required reviews/protection remain UNKNOWN (previous protection read 403). Approval does not imply merge authorization.

## P0 security gate — diagnostic credential exposure

A preflight comparison erroneously resolved PowerShell's Compare alias to Compare-Object and emitted secret values into the conversation's tool-output record. Affected categories: staging and production Stripe API keys, Stripe webhook signing secrets, ADMIN_SESSION_SECRET and CRON_SECRET. No values, prefixes with suffixes, recipient addresses or raw variable dumps are written to repository files or this package. The corrected comparison uses a unique function name and emits only classifications.

Treat those credentials as exposed. **Before bootstrap/homologation, obtain an owner-led rotation/revocation plan and confirmation of containment.** Production remediation is a separate explicit authorization, not bundled into staging deployment permission. Coordinate provider key/signing-secret replacement with consumers and webhook retries; coordinate session-secret changes with intended session invalidation; coordinate cron consumers and rotation windows. Do not retain exposed previous secrets merely to preserve continuity. Do not reset sessionVersion/credentialVersion. No secret was rotated automatically; no assurance of non-access/use of the conversation record is claimed. Do not attach/share the raw diagnostic record or copy values into issues/PRs.

## Current read-only service inventory

Actual URL: <https://rare-staging-staging.up.railway.app>, domain port 8080; no custom staging domain. Source/checkSuites config and deployment metadata were re-read, not inferred from files. Code config selector is **not reported** in current web/worker environment config; previous deployment fileServiceManifest is empty. This absence is not proof that future deployments ignore railway.json.

| Service | Source | SHA | Start | Predeploy | DB | Redis | Volume |
|---|---|---|---|---|---|---|---|
| rare-staging | integration/pre-go-live | 4ea73f50cafdbf67e16dc71de985052075feca42 | node .next/standalone/server.js | migrate deploy, advisory lock disabled | STAGING; matches PG; differs from production | matches dedicated staging Redis; differs from production | /data, rare-staging-volume |
| rare-checkout-worker-staging | integration/pre-go-live | same 4ea73f5 | npm run checkout:worker | NONE currently | MATCHES_WEB, STAGING | MISSING; worker DB queue does not require Redis | none |
| Postgres-MlyZ | ghcr.io/railwayapp-templates/postgres-ssl:18 | image, not Git | image default | NONE | dedicated staging service | NOT APPLICABLE | /var/lib/postgresql/data |
| Redis-w0Fa | redis:8.2 | image, not Git | image entrypoint, authenticated persistence | NONE | NOT APPLICABLE | dedicated staging service | /data |

Each service: SUCCESS deployment, one active entry, one running instance and one configured replica. Web: ON_FAILURE, health /api/health, 180 seconds; worker: ALWAYS, no HTTP healthcheck/no cron schedule. PG/Redis: ON_FAILURE. This is control-plane process inventory, not queue/DB functional verification.

Web deployment: `3e4874f3-397c-47fa-be77-73d1b0089ceb`; worker: `d254cbc1-5f91-49ba-a866-1f596ae5151a`. PG: `a20b8647-5a81-4a0b-a44f-b096a58996f3`; Redis: `2bdaeb1f-cf82-4470-84a7-539ec337fb18`.

Web volume `44b4b655-7569-4174-9ae2-b1e9c837b2bd`; PG volume `a0b78a5e-0dec-40ab-9d8c-c298be29ca5d`; Redis volume `1e2f9ce2-a7b9-4059-a259-cb9fa2f161ef`. All staging volume IDs differ from production's attached volumes. STORAGE_DRIVER=local, directory /data/uploads, public base /uploads, restricted staging exception true; all five R2 settings MISSING. Persistence is configured, not tested by a write/redeploy.

## Proposed configuration delta — NOT APPLIED

| Service | Setting | Current | Proposed | Reason / risk if unchanged |
|---|---|---|---|---|
| web + worker | APP_ENV | STAGING | staging (retain) | Maintain restricted staging identity/access |
| web | CHECKOUT_ENABLED | true | false | Block new order/reservation/session initiation |
| worker | CHECKOUT_ENABLED | false | false (retain) | Defense-in-depth; does not pause expiry loop |
| web | SHIPPING_ENABLED | true | false | Explicit closed bootstrap; no absence-based assumption |
| worker | SHIPPING_ENABLED | false | false (retain) | No quote capability required in worker |
| web + worker | EMAIL_DRIVER | smtp | disabled | Prevent delivery on all email-producing processes |
| web + worker | email mode / recipients / cutoff | test; PRESENT, matching; 2 recipients; UTC cutoff valid | retain policy, do not send; fresh cutoff/approved recipients only in H6 | Existing allowlist is not authorization or backlog clearance |
| web + worker | source branch / deployment SHA | integration/pre-go-live / 4ea73f5 | codex/admin-dashboard-reconciled-20261002 / exact b06ef6e437ee2d28fbeffeb5f91144c389aaa518 | Avoid branch-tip race/old artifact; freeze autodeploys/promotions |
| web | Railway Config File selector | NOT VERIFIED | /railway.json, explicitly reviewed | Expected sole migration executor; code-config start/restart differ from current dashboard defaults |
| worker | Railway Config File selector | NOT VERIFIED | /railway.cron.json, explicitly reviewed | Prevent default web config accidentally adding worker migration predeploy |
| web | expected effective build/start/restart | npm run build; standalone start; ON_FAILURE/10 | npm run build; PORT/HOSTNAME standalone command from railway.json; ON_FAILURE/3 | Review code-config precedence and preserve healthcheck/volume |
| worker | expected effective build/start/predeploy/restart | prisma generate; checkout:worker; NONE; ALWAYS | same; NONE; ALWAYS from railway.cron.json | Exactly one migration executor, same compatible artifact |
| web + worker | Stripe/webhook/session/cron credentials | PRESENT, TEST where applicable, distinct from production; exposed in diagnostic record | independently rotated values via private operator channel, never in docs | P0 containment prerequisite; production rotation separate approval |

Database/Redis URLs, mounts/public base/domain, TEST-only Stripe mode, sandbox provider endpoint and restricted Basic access must be retained. Worker has no Redis variable; do not manufacture one or a worker media volume. Keep VAPID keys absent: web and worker public/private MISSING on read-only inspection; revalidate before execution, no unsolicited Push enablement.

**Configuration-file trap:** [Railway config-as-code](https://docs.railway.com/config-as-code) takes precedence over dashboard settings. Current worker lacks predeploy, but a future default railway.json can introduce the web's migrate command. Set/review the worker selector and effective manifest; abort if worker build/start/predeploy is not the worker contract. No service/source/config selector changed here. No IaC migration/refactor is part of this cycle.

## Side-effect matrix — proposed runtime, not already applied

| Side effect | Bootstrap state | Proof / limitation |
|---|---|---|
| New checkout/order/reservation | blocked after runtime verification | POST /api/checkout checks checkout=false before rate limiter/customer/data/provider paths; expect 503 |
| New Stripe charge/session via checkout | blocked; LIVE forbidden | Same early guard; both configured keys TEST, identical staging key/account context, distinct from production; no transaction created |
| Existing Stripe sessions | NOT globally blocked | Expiry worker ignores checkout flag, can read/expire TEST sessions and reconcile DB state; webhook also remains active. Owner must approve backlog/reconciliation policy before restart |
| Shipping quote/order | storefront quote blocked | POST /api/shipping/quote returns disabled/options empty when checkout=false; explicit shipping=false retained; ME web SANDBOX fallback verified, token PRESENT; no label/shipment operation authorized |
| Email | blocked only after both new processes use disabled | transactional driver returns disabled; worker skips outbox send; setting variables with skip-deploys does not update running SMTP processes |
| Webhooks | existing TEST reconciliation remains | One enabled test registration, six events; signing secret distinct but exposed. No signing/delivery/dedup exercise. Pause entry during approved write freeze; preserve retries/events |
| Production DB | isolated in configured identity | stage web/worker match staging PG and differ from production; no production DB query |
| Production Redis | isolated in configured identity | stage web matches staging Redis and differs from production; worker not using Redis |
| Production storage | separate configured mounts | distinct staging web volume ID; no R2 configured; runtime media durability/reference isolation still requires H1 |
| Cron/queues | STAGING reconciliation can mutate staging state | one dedicated worker; recommended primary, not stopped by flags. Freeze/controlled resume needs explicit approval; Vercel runtime UNKNOWN |
| Admin Push | web/worker not configured | VAPID public/private MISSING on both; retain absent unless approved test-device gate; email flag does not disable Push |

No claim that three bootstrap flags prohibit **all** external activity. If zero provider calls/DB writes is required, keep reconciler/webhook entry paused under the separately approved staging window until the actual backlog policy is verified. Do not discard existing sessions/jobs to obtain a clean test.

## Database access/history / backup

Configured DB isolation was revalidated using credential-free host/port/database identity comparison. Existing staging TCP proxy transport is available, but a strict-TLS pg.Client read-only connection failed with SELF_SIGNED_CERT_IN_CHAIN **before queries**. TLS verification was not disabled. A narrowly scoped SSH read-only query returned no result; subsequent SSH probe confirmed key registration required. No key was registered/generated/imported. No broad performance script was run because it could collect SQL text/rows outside this task's allowed metadata/aggregates.

**STAGING_MIGRATION_HISTORY_NOT_VERIFIED**. Applied/failed/pending migrations, checksums/schema and backlog are UNKNOWN, not zero. Planned aggregate-only counts: pending/awaiting-payment orders, reserved units (not reservation-record count), pending/retry/sending outbox, uncertain outbox and StripeEvent count. None was obtained. No customer, order detail, payment identifier or recipient emitted.

Read-only next step: owner supplies an already-trusted CA or authorized registered SSH path; run BEGIN READ ONLY with short statement/lock timeouts and the metadata queries in [PENDING_MIGRATIONS.md](../runbooks/PENDING_MIGRATIONS.md), then ROLLBACK. Compare completed migration checksums with all 14 candidate SQL files, identify unresolved failures/extra history and verify relevant index/column definitions. Full schema drift verification remains a separate read-only gate; do not use migrate dev/reset/db push.

**BACKUP_NOT_VERIFIED**: actual backup inventory/schedule/retention/restore point/PITR status unavailable through the inspected control-plane fields; installed CLI 5.26.0 lacks postgres backup commands, API helper lacks jq. No tools were installed or backup created/restored. [Railway backups](https://docs.railway.com/volumes/backups) supports manual/scheduled volume backups, but product capability is not evidence of this PG's enabled policy. Owner must inspect PG service Backups tab, record verified checkpoint/retention/recovery evidence and approve creation if needed. A restore can redeploy/change mounts and is never automatic rollback. Do not enable PITR as a read-only diagnostic.

### Migration SQL impact — all 14 read, none executed

Candidate migration files and schema are byte-identical to current staging source SHA 4ea73f5. **No new migration was introduced by this candidate.** Nevertheless migrate deploy executes every migration missing from the actual DB history, not only the two prior rare_dev findings. If history is empty/partial, older migration SQL also matters. The table below is the complete possible manifest, not an asserted pending list.

All files lack explicit BEGIN/COMMIT; do not assume whole-file or whole-deploy atomicity. CREATE INDEX without CONCURRENTLY normally takes SHARE and scans; ALTER TABLE typically needs ACCESS EXCLUSIVE, while validating foreign keys can also lock/read referenced tables. Version/image 18 is configured; actual server version remains unqueried. Constant defaults can avoid heap rewrite on PG11+, but lock waits are still possible. No duration estimate without live table sizes/transactions.

| Migration | Operation / tables / index or columns | Probable locks, scan, rewrite/backfill | Default / NOT NULL | Rollback complexity / risk if pending |
|---|---|---|---|---|
| 20260511210000_init | public schema; role/order/payment/inventory enums; User, Category, Product, ProductImage, ProductVariant, Order, OrderItem, InventoryMovement, StoreSettings, StripeEvent; PK/unique/search indexes and FKs | New-object DDL; table/index locks; conflicts with pre-existing schema; no explicit data backfill | Required fields NOT NULL; role/status/stock/settings/time defaults | HIGH: foundational schema, never rerun/reset a populated lab |
| 20260512013000_v1_5_customers_orders | Customer/CustomerAddress; Order customerId and contact/address snapshots; customer/order indexes and FKs | ALTER existing Order, index/FK scans; nullable additions normally no rewrite | New-table required fields NOT NULL/defaults; Order additions nullable | HIGH if unexpected pending: customer/order data contract and validation locks |
| 20260512053542_v1_6_shipping_base | Order shippingCep/Method snapshots; Product height/length/weight/width; StoreSettings shipping fields | ALTER locks; nullable/constant-default additions normally no rewrite on PG11+; no measurements/backfill | settings address=true, fixed=0, mode=fixed NOT NULL; dimensions nullable | MEDIUM: keep additive fields; defaults are not measured readiness |
| 20260515120000_v1_7_7_home_banners | HomeBannerSlide; active/sort indexes | New-table/index DDL; no old data rewrite/backfill | imageUrl empty, active=true, sort=0/time; required alt | LOW: preserve rows/media references once used |
| 20260520090000_v1_7_12_featured_sort_order | Product.featuredSortOrder; Product_active_featured_featuredSortOrder_idx | ALTER lock plus ordinary index scan/write blocking; no rewrite/backfill | nullable, no default | MEDIUM: retain additive column/index |
| 20260524170000_v1_7_14_shipping_quote_snapshot | Order.shippingQuoteSnapshot JSONB | ALTER lock; nullable/no rewrite/backfill | nullable, no default | LOW lock-duration risk unmeasured; preserve quote history |
| 20260606182000_operational_evidence | OperationalEvidence; unique key/environment and status/time indexes | New-table/index DDL, no backfill | status=pending, environment=staging, required timestamps/keys | LOW: evidence rows must be preserved |
| 20260709120000_admin_sale_notifications | AdminNotification/AdminPushSubscription; dedupe/endpoint uniques, read/order/user indexes, FKs | New objects plus referenced-table FK locks; no explicit backfill | required payload/subscription fields; active=true/time | MEDIUM: notification/subscription persistence and FK locks |
| 20260710120000_first_order_coupon | Order.couponCode, discountInCents | ALTER lock; constant-default fast path PG11+, no explicit backfill | coupon nullable; discount 0 NOT NULL | MEDIUM: preserve commercial amounts |
| 20260907150000_admin_temporary_password | User.username/mustChangePassword; username unique; conditional second Admin insertion | ALTER/index scan; INSERT guarded by existing identity, not a full-table backfill; uniqueness conflict possible | username nullable; mustChangePassword=false NOT NULL; inserted account forced change | HIGH: authentication/account creation side effect if truly pending; requires specific owner approval; no credential payload copied |
| 20260907230000_payment_email_outbox | EmailOutboxStatus; EmailOutbox, order FK; message/order-kind uniques, pending/lease indexes | New-table/index/FK locks; no old-email backfill | pending, attempts=0, lease nullable; required message/order fields | MEDIUM: preserve durable outbox and uncertain state |
| 20260913120000_storefront_media_checkout_deadline | Order deadline/expiredAt; settings Instagram/default reservation=15; banner framing/placement; CheckoutExpiryJob/ProductMediaAsset + indexes/FK | ALTER/default metadata + new-object/index/FK locks; no explicit order/media backfill; later worker code may backfill jobs | order times nullable; banner cover/50/home NOT NULL; queue pending, attempts=0 | MEDIUM: deadlines/leases/media references must survive rollback |
| 20260920120000_analytics_paid_at_index | Order_status_paidAt_idx(status,paidAt); OrderItem_orderId_productId_idx(orderId,productId), IF NOT EXISTS | SHARE, ordinary scans of both tables, write blocking; no rewrite/backfill; name existence is not equivalence | no column/default/NOT NULL change | MEDIUM: verify valid/ready/definition; no automatic DROP |
| 20260921120000_session_version | User.sessionVersion; Customer.sessionVersion integer | ACCESS EXCLUSIVE/wait; constant-default fast path PG11+, no explicit backfill; partial first-column application possible | 0 NOT NULL | HIGH auth impact: retain revocation counters, inspect partial DDL before any recovery |

The two last rows are the prior **rare_dev** pending set, not staging's. Any unexpected older pending migration/failed history/checksum mismatch/schema discrepancy aborts the plan and requires a revised approved changeset. [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html), [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html).

### Executor and locking

Proposed **WEB PREDEPLOY = SINGLE EXECUTOR**, confirmed only after reviewing the candidate effective manifests/selectors. Exact web command: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`. Worker must have NONE. Freeze all other web promotions, GitHub autodeploys, manual migrate and pipeline executors; advisory locking is disabled, so concurrent runs can race migration history/DDL and contend on locks. Do not remove that setting or run a second manual deploy in this cycle. Backlog/worker/web writes need an approved quiescence window separately from promotion serialization.

## CHANGES TO APPLY AFTER APPROVAL

**Blocked prerequisite checklist:** credential containment; legitimate read-only schema/history/backlog path; exact pending manifest accepted; recoverable checkpoint; named operator/window/lock thresholds; source/config-file pin mechanism verified; PR review gates. These are not waived by signing an approval sentence.

1. Approve use of the exact staging services/DB/volumes above, freeze autodeploys/promotions, privately capture safe config/artifact references and select a compatible rollback artifact. Under explicit staging maintenance authorization, quiesce existing worker and web entry before the checkpoint/config transition; do not stop production, delete services/jobs or silently reset the lab. Preserve webhook retries and running leases; record backlog counts before/after. A worker with SMTP still running will not be disabled merely by changing stored vars with skip-deploys.
2. Owner obtains/verifies PG checkpoint and recovery; record schema/history/pending/checksum checks and approve exact migration set. For each staging web/worker, SET APP_ENV=staging, CHECKOUT_ENABLED=false, SHIPPING_ENABLED=false, EMAIL_DRIVER=disabled **without triggering deployment**. Do not copy secret values into commands. Keep DB/Redis/storage and non-live provider references unchanged except separately approved credential containment.
3. Stage source branch `codex/admin-dashboard-reconciled-20261002` and approved immutable SHA; explicitly select web `/railway.json`, worker `/railway.cron.json`. Preview configuration precedence, mounts/domain/health and sole executor before committing settings without auto-deploy. Both services remain quiesced. Do not use a global/project-wide service mutation or Deploy Latest shortcut.
4. Deploy **web only**, exact candidate b06ef6e437ee2d28fbeffeb5f91144c389aaa518, once. Its pre-deploy applies only the approved actual pending set. Watch migration outcome/locks; on failure stop, inspect history/catalog and do not retry blindly. Verify schema/index/auth columns and web health/artifact/bootstrap settings before proceeding.
5. Only after successful web/schema gates, deploy **worker** at the identical SHA with NONE predeploy, prisma-generate build, checkout:worker start, ALWAYS and one replica. Resume approved TEST reconciliation policy; verify boot SHA/queue loop and email disabled without draining old emails. Do not run an extra --once worker or HTTP cron as a diagnostic.
6. Run the read-only/closed-guard validation below. No real media/provider write is included in the initial smoke. Obtain separate H1..H7 approvals for test side effects. Every phase returns to false/false/disabled before the next, unless an explicitly reviewed dependency requires one extra flag; never enable all integrations together.

### Prepared commands — DO NOT EXECUTE IN THIS PREFLIGHT

Verified installed CLI supports --skip-deploys. These commands modify stored staging variables but **not currently running process settings**; execute only within the approved quiescence/checkpoint sequence above:

```powershell
railway variable set -p 72ed12be-9a2a-4e13-8594-30ffd8ffa565 -e d8399691-dacf-41e9-a9d5-060c97672e39 -s 3f4b79f6-2819-45a6-986d-584dc7ac803a --skip-deploys APP_ENV=staging CHECKOUT_ENABLED=false SHIPPING_ENABLED=false EMAIL_DRIVER=disabled
railway variable set -p 72ed12be-9a2a-4e13-8594-30ffd8ffa565 -e d8399691-dacf-41e9-a9d5-060c97672e39 -s 2bfcf6af-11f4-459f-9089-a841ae25e57f --skip-deploys APP_ENV=staging CHECKOUT_ENABLED=false SHIPPING_ENABLED=false EMAIL_DRIVER=disabled
```

Source/config selectors: operator reviews staging-specific Railway Settings (web/worker IDs above), Source branch and Railway Config File; stage/apply without automatic deployment. Exact GraphQL deployment request documented by [Railway service API](https://docs.railway.com/integrations/api/manage-services) is below. Future operator must verify supported schema/permissions first; installed CLI has no commit-SHA deploy flag, so do **not** substitute ordinary up/redeploy/latest. No new token search or dependency/tool installation in this preflight.

```graphql
mutation ApprovedStagingDeploy($serviceId: String!, $environmentId: String!, $commitSha: String!) {
  serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha)
}
```

Web variables (first); worker uses same environment/SHA and serviceId `2bfcf6af-11f4-459f-9089-a841ae25e57f` only after web success:

```json
{"serviceId":"3f4b79f6-2819-45a6-986d-584dc7ac803a","environmentId":"d8399691-dacf-41e9-a9d5-060c97672e39","commitSha":"b06ef6e437ee2d28fbeffeb5f91144c389aaa518"}
```

Record returned deployment ID and verify actual source commit independently; setting RAILWAY_GIT_COMMIT_SHA manually is not proof. Unsupported SHA pin / wrong manifest / automatic extra deployment is an abort, not permission to fall back to branch-tip deployment.

## EXACT VALIDATION — future approval only

| ACTION | EXPECTED RESULT | FAIL CONDITION |
|---|---|---|
| Anonymous GET /api/health | 200, ok or understood ok_with_warnings, no-store; minimal public response | non-200/degraded required dependency, secret/diagnostic leakage |
| GET /robots.txt; anonymous GET / | disallow-all/noindex; root 401 Basic challenge | publicly unrestricted staging/indexable pages |
| Control-plane plus Admin-authenticated GET /api/health | actual deployed commit b06ef6e, expected build ID/artifact, staging environment; checkout false, email disabled, shipping false in diagnostics; DB/Redis staging | unknown/mismatched artifact/env/target/flags; a manually set SHA is insufficient |
| Trusted read-only PG history/catalog/schema check | all approved migrations completed, no unresolved failed rows; matching checksums; valid/ready indexes; session columns correct | failure/drift/extra pending/unapproved migration/partial DDL |
| GET /admin/login then approved Admin login | login page, session cookie; active Admin only, forced-password boundary where applicable | layout-only auth, temporary Admin reaches protected data, stale/revoked token accepted |
| GET protected Dashboard after approved login | expected view without provider trigger; unauthenticated access denied | wrong artifact, auth bypass, page failure |
| GET storefront/product pages with commerce closed | expected read-only catalog and closed checkout | unexpected checkout CTA/action/payment initiation |
| POST /api/checkout with empty synthetic JSON, only after flag proof | 503 before order/reservation/provider logic; aggregate order counts unchanged | session/order created, success URL or Stripe request |
| POST /api/shipping/quote with empty synthetic JSON, only after flag proof | disabled=true, options=[] before provider/data paths | quote/provider request or enabled response |
| Read web/worker sanitized env/diagnostics and bounded logs | EMAIL_DRIVER=disabled, no send attempt/new accepted messages during smoke | SMTP/Zepto unexpectedly active; email/push send |
| Worker deployment/log/DB queue metadata | one running replica; boot log matching SHA; NONE predeploy; correct DB; permitted TEST reconcile only | wrong DB/SHA, migration in worker, duplicate worker/loop failure, unauthorized backlog action |

First layer is GET/control-plane/read-only SQL. Admin login creates session cookies; logout/revocation tests can increment DB version counters and belong to explicitly approved H1 auth testing, not a literal zero-write smoke. Guarded POSTs are safe **only after runtime flags are proved**, and still require Basic/approved access without printing credentials. No credential/body/address is included in evidence.

Current read-only GETs, 2026-10-04: health 200/ok_with_warnings/no-store; root 401 Basic/no-store; robots 200/disallow-all/noindex with public revalidation cache headers. No authenticated candidate smoke was executed.

## ABORT CONDITIONS

**P0 immediate stop:** exposed credentials not contained; production DB/Redis/shared production media detected; staging LIVE/UNKNOWN Stripe; production Melhor Envio endpoint on a shipping-capable process; email/push enabled unexpectedly; checkout/shipping open; unknown migration target/set; worker migrates or targets wrong DB; migration failure/partial DDL/schema drift; missing/unrecoverable checkpoint; unknown/wrong SHA/config selector; health failure; unsafe concurrent promotion/executor. Preserve evidence privately and stop further promotions; do not delete/reset data or disable production services.

**P1 hold next phase:** worker heartbeat/queue visibility or alert missing, Basic/noindex failure, media public URL/variant/editor/redeploy persistence unproven, stale cutoff/unapproved recipient/backlog, unexplained retries/uncertain rows, Vercel ownership unresolved, rollback drill not passed. A warning is not a waived gate; choose thresholds/window before execution, not invented timings.

## Rollback / forward recovery

Previous SHA 4ea73f50cafdbf67e16dc71de985052075feca42 and candidate b06ef6e have identical Prisma schema/migration files, auth/customer-auth revocation files, expiry worker/queue, email-outbox/transactional-email and storage/Admin-notification source in the scoped comparison. This supports **static schema/session/queue/media compatibility**, not a tested rollback artifact. An older Admin build can revert other hardening; do not label it rollback-safe without reviewed build and relevant auth/security/closed-commerce smoke against the actual additive schema.

- Application rollback: only to a certified compatible artifact, same safe config/mounts and one queue owner. Prefer candidate-preserving forward fix if an older artifact loses required protections. No unconditional rollback deployment command is offered while the artifact gate is unverified.
- Database rollback: no automatic down migrations, DROP COLUMN/INDEX or reset. Preserve additive fields/indexes/session counters and migration records. Failed/partial migration recovery requires inspection and a reviewed forward completion or exact Prisma resolve procedure, never hiding failure.
- Database restore: separate last-resort authorization; restore/checkpoint may change volumes/redeploy and lose later writes. Reconcile post-checkpoint orders, reservations, TEST provider events and outbox first. Do not infer recoverability from the product's backup capability.
- Sessions: keep sessionVersion/credentialVersion and temporary-password restrictions; old/revoked tokens must remain invalid. Rotation may intentionally invalidate sessions; never lower counters or re-enable exposed previous signing secrets.
- Orders/webhooks/outbox: retain IDs, reservations, StripeEvent dedup, leases/tokens and uncertain rows; preserve arriving webhook retries while entry is paused. Do not recreate charges/sessions, blindly release paid inventory or resend uncertain mail.
- Storage: retain /data/uploads volume/originals/variants and public URL references; no deletion/backfill/mount swap. Prove older artifact reads existing references before switch.

## POST-BOOTSTRAP HOMOLOGATION — separate sequential approvals

| Phase | Scope / gate | Feature state / boundary |
|---|---|---|
| H1 Core | Admin/auth, read-only storefront, actual schema, worker, then approved synthetic image write/read/public URL/variant/editor/redeploy durability | false/false/disabled; auth/media writes only after explicit approval; storage passes before payments |
| H2 Stripe Card TEST | synthetic order/reservation/session, redirects, approved/declined/error cases, duplicate requests/idempotency | TEST keys only; checkout enabled temporarily in staging only, shipping false/email disabled; existing-reconcile policy approved |
| H3 PIX TEST | confirm account/environment eligibility; creation/pending/expiry/async success/failure/late/duplicate events | not inferred from configuration; parcelamento REQUIRES PRODUCT DECISION, not implemented |
| H4 Webhooks TEST | correct rotated staging secret, signature/mode mismatch, dedup/retry/out-of-order and order reconciliation | webhook entry is not disabled by checkout flag; preserve test events; no live endpoint change |
| H5 Melhor Envio Sandbox | auth/quote, PAC/SEDEX as applicable, measured dimensions/weight, invalid CEP/timeout/sanitization | allow only SANDBOX; quote route also requires checkout=true, so owner must approve this dependency while restricting payment entry to synthetic fixtures; email disabled, no label/shipment |
| H6 Email Allowlisted | approved addresses privately, fresh send-not-before, aggregate backlog inspected, matching web/worker policy, send/delivery/claim/retry/uncertain/duplicates | smtp test only for selected messages; checkout/shipping closed; never drain old backlog/campaign |
| H7 Monitoring | provider failures/webhook errors, DB/worker health, queues/outbox/alerts and rollback evidence | one named owner/on-call; no production side effect; return staging to approved closed baseline |

H5 cannot promise shipping quote with checkout=false: current route requires checkout enabled. Treat the temporary checkout guard dependency as explicit additional approval; never enable payment/email tests concurrently or invent a quote-only flag. Do not weaken guards or add code to avoid this gate.

Keep these prior local dimension findings excluded from real-quote homologation until measured: supreme-bag, bone-chrome-hearts, jaqueta-nike-nocta, camiseta-bape, camiseta-hellstar. Staging/production catalogs are not inferred; synthetic package measures must be real and owner-authorized, not fallback values.

Stripe webhook re-read 2026-10-04: one TEST enabled endpoint for actual staging /api/stripe/webhook, six expected events, no endpoint mutation/delivery test. Melhor Envio web SANDBOX fallback, token PRESENT; no authentication/quote. SMTP test policy valid/matching, two recipients, no sends. Dependency registry unchanged from previous evidence: Prisma 7.10.0 config pins deepmerge-ts 7.1.5; latest is 8 prerelease. UPSTREAM_WAIT, no dependency change/new risk acceptance. Runtime audit counts remain dated 2026-10-03, not rerun here.

## Documentation validation — 2026-10-04

Only the four preflight documents changed; no runtime code, provider configuration or database schema was changed. Relative file links/paths, Markdown fence balance and secret-shaped content checks passed for these documents. `git diff --check` passed. Repository configuration checks confirmed 14 migration SQL files, the web migration command, and the worker-specific start/restart configuration with no predeploy in railway.cron.json; live future config-file selection remains a separate gate. `npm run release:guard` returned 6 OK, 1 unchanged legacy Vercel cron warning, 0 FAIL. Full runtime/E2E suites were not repeated for documentation-only changes; prior results remain explicitly dated.

These file checks do **not** erase or certify confidentiality of the earlier tool-output credential incident. Containment/rotation remains P0 and requires owner coordination; no exposed values are included in this package.

## Final gate / requested decisions

READY FOR MERGE: NO. READY FOR STAGING BOOTSTRAP: NO (credential containment, history/checkpoint, selector/executor and artifact gates unresolved). AUTHORIZED FOR STAGING BOOTSTRAP: NO. READY FOR EXTERNAL HOMOLOGATION: NO. READY FOR PRODUCTION: NO.

1. Owner authorizes/coordinates credential containment separately (production changes never inferred), creates/reviews Draft PR and confirms required gates.
2. Owner approves exact staging target/candidate/delta, trusted read-only DB path, actual pending manifest/checkpoint, single web executor, quiescence/window and certified rollback; approval covers staging only and is conditional on prerequisite evidence.
3. Owner approves sequential H1..H7 fixtures/recipients/device policy/operations ownership, decides parcelamento and dependency residual risk before production consideration. No production promotion included.

Package complete as a **blocked approval dossier**, not execution-ready authorization. Stop here; a new execution requires explicit approval and resolved gates. Storefront/Railway/Postgres guidance informed narrow side-effect proofs, configuration precedence, short read-only queries and locking/recovery boundaries; no Admin development reopened.
