# Staging safety / external homologation gate

> P0 update 2026-10-06: **RELEASE_SECURITY_FREEZE=ACTIVE**. [Separate staging/production rotation approval](../security/CREDENTIAL_ROTATION_APPROVAL.md) and [sanitized incident assessment](../security/CREDENTIAL_INCIDENT_202610.md) precede bootstrap. Planning alone does not contain credentials; no rotation/configuration/deploy/migration authorized. Existing reconciliation remains active despite checkout flags; safe process activation and migration approval remain cumulative gates.

> Final preflight 2026-10-04: [STAGING_BOOTSTRAP_APPROVAL.md](../cycles/STAGING_BOOTSTRAP_APPROVAL.md)
> is the current blocked approval dossier, including immutable candidate, config-file/executor trap,
> failed read-only DB access, credential containment, proposed delta and abort/rollback sequence.
> This older discovery snapshot does not authorize changing staging.

Read-only discovery: 2026-10-03. **STAGING_DEPLOY_BLOCKED** and **DEPLOY_BLOCKED_BY_MIGRATION_RISK**. No external configuration, deployment, database, scheduler or provider was modified. This is an existing test laboratory, not the requested closed bootstrap and not the Admin candidate.

## Actual target and evidence boundary

- Railway project Rare: `72ed12be-9a2a-4e13-8594-30ffd8ffa565`.
- Staging environment: `d8399691-dacf-41e9-a9d5-060c97672e39`; production environment, excluded from execution: `6c9bbc98-9eb7-4a40-a352-e1aad3e8b6cd`.
- Web `rare-staging`: `3f4b79f6-2819-45a6-986d-584dc7ac803a`.
- Worker `rare-checkout-worker-staging`: `2bfcf6af-11f4-459f-9089-a841ae25e57f`.
- Postgres-MlyZ: `ed0a374e-79da-4aab-9e3a-bb684fb829d1`; Redis-w0Fa: `6f6d7a25-00aa-44ba-9c52-92c194a0a082`.
- Actual URL: <https://rare-staging-staging.up.railway.app>; APP_URL and NEXT_PUBLIC_APP_URL match it. No staging custom domain observed.
- Web and worker source: `integration/pre-go-live`, deployed commit `4ea73f50cafdbf67e16dc71de985052075feca42`, not the candidate `codex/admin-dashboard-reconciled-20261002`.
- Web deployment `3e4874f3-397c-47fa-be77-73d1b0089ceb`; worker deployment `d254cbc1-5f91-49ba-a866-1f596ae5151a`: SUCCESS, one active deployment entry each, created 2026-09-25. This is control-plane evidence, not queue/provider functional verification.

Evidence: authenticated Railway service/environment/config/variable inventory; credential-free URL identity comparisons; bounded log reads; safe public HTTP GETs; Stripe TEST-key authenticated account/webhook **GET** requests. No variable dump, credential value, recipient address, order/customer record or real database query was emitted/stored. Configuration observations do not prove deployed application behavior. Candidate flows remain NOT TESTED on staging.

## Safety matrix

SAFE? is a scoped safety assessment, not homologation. PARTIAL / NOT VERIFIED never authorize a deployment. BLOCKER? indicates the outstanding bootstrap/deploy/homologation gate.

| Item | EXPECTED | OBSERVED | SAFE? | BLOCKER? |
|---|---|---|---|---|
| Target | Named non-production environment | Dedicated Railway staging project environment and services identified above | YES, target identity | NO for discovery; authorization still required |
| Branch | Approved candidate commit pinned for web/worker | Both use integration/pre-go-live / main baseline 4ea73f5; candidate not deployed; checkSuites=false | NO, candidate unverified | YES: approved source/commit and release gate |
| Database | Dedicated DB, known schema, checkpoint, one migration executor | Web and worker DATABASE_URL identities match dedicated staging PG, differ from production; schema/history/backup not queried | PARTIAL: isolation configured | YES: schema, checkpoint, executor, authorization |
| Storage | Dedicated durable media, no production objects | local; /data/uploads under dedicated web volume /data; /uploads public base; restricted local-staging exception enabled; all five R2 variables missing | PARTIAL: mounted isolated volume | YES: write/read/variants/editor/redeploy verification |
| Stripe | TEST key only, no live fallback | Web/worker key classified TEST by prefix, identical within staging and different from production; authenticated read succeeds | YES, configured Test key | NO for key gate; payments still NOT TESTED |
| Melhor Envio | Sandbox endpoint and sandbox-authorized token | provider melhor_envio; ENV=sandbox; BASE_URL missing falls back to https://sandbox.melhorenvio.com.br; token present, auth not tested | PARTIAL: endpoint confirmed in config/code | YES before quote: sandbox authentication |
| Email | Disabled bootstrap; later approved test recipients only | Web/worker smtp, deliveryMode=test; EMAIL_TEST_RECIPIENTS valid (2), matching; EMAIL_SEND_NOT_BEFORE valid/matching; provider config valid; no recipient approval or backlog inspection | NO for disabled bootstrap | YES: disabled bootstrap, then approved recipients/fresh cutoff/backlog policy |
| Checkout | Explicit false during bootstrap | Web CHECKOUT_ENABLED=true; worker false | NO | YES: web flag must be false before preparation |
| Shipping | Explicit false during bootstrap | Web SHIPPING_ENABLED=true; worker false | NO | YES: web flag must be false before preparation |
| Cron | One owner per DB; no production queue contention | Dedicated staging persistent worker, one configured replica, staging DB; Railway production worker targets production DB; Vercel live target unknown | PARTIAL: Railway DB separation | YES: named owner and runtime/queue proof; Vercel inventory |
| Webhook | Staging test endpoint, distinct signing secret, verified reconciliation | One enabled TEST endpoint for /api/stripe/webhook, six configured events; secret present and different from production | PARTIAL: registration/config only | YES: signed delivery, retry, deduplication, reconciliation |
| Domain | Restricted, non-indexed, staging-specific | / returns 401 Basic; /robots.txt disallows all; /api/health returns 200; no-store and noindex/nofollow | YES, public GET evidence | NO for discovery; authenticated candidate flows NOT TESTED |
| Secrets | Present, independent, no values in evidence | Stage ADMIN_SESSION_SECRET (>=32), CRON_SECRET, webhook secret and Stripe key present/different from production; staging Basic credentials present | YES for compared secrets only | NO for compared values; provider validity/rotation remains separate |
| Monitoring | Health, worker/DB/provider/webhook/outbox failures visible | Health ok_with_warnings; bounded staging worker log read returned no rows; no alert delivery/queue/backlog proof | PARTIAL | YES: diagnostics, queue visibility and alert exercise |
| Rollback | Known compatible artifact/checkpoint; no destructive session/order/media rollback | Prior staging SHA identified; compatibility/restore drill NOT TESTED | NOT VERIFIED | YES: approved compatible artifact and recovery evidence |

Redis web target also matches the dedicated staging Redis and differs from production. Database comparison excludes credentials and compares host/port/database identity; this proves configured targets, not migration history or restore readiness. R2 missing is **not** proof of an isolated R2 bucket; the existing dedicated local volume is the observed staging persistence option, not production R2 approval.

## Approval boundary / safe bootstrap

The owner must decide whether to repurpose the existing laboratory or provision a separately authorized isolated target. Preserve any pending test orders, webhook retries, stored media and outbox state. No automatic disabling of an existing worker, draining backlog, resetting data or editing provider endpoints is authorized here.

For the approved target, prepare these explicit non-secret bootstrap settings (proposal only, **not applied**):

```dotenv
APP_ENV=staging
CHECKOUT_ENABLED=false
SHIPPING_ENABLED=false
EMAIL_DRIVER=disabled
```

Apply the email-disabled policy to every process able to send, including the worker. Retain non-production DB/Redis/storage and TEST/sandbox providers. Keep restricted access and noindex. Do not invent STAGING_ACCESS_ENABLED or EMAIL_TEST_ALLOWLIST: implemented controls are APP_ENV with STAGING_ACCESS_USERNAME/PASSWORD, and EMAIL_TEST_RECIPIENTS / EMAIL_SEND_NOT_BEFORE.

Opening these flags later is a separate **controlled staging-only homologation** step after the gates below, never a production setting change. Re-read effective configuration and prove the intended artifact/flags at runtime before any side effect.

## Database / automatic pre-deploy migration

The live staging web config has one pre-deploy command:

```text
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy
```

Start: `node .next/standalone/server.js`; healthcheck `/api/health`; one replica. The staging worker starts `npm run checkout:worker`, restart ALWAYS, no cron schedule and no pre-deploy migration command. A web deployment can therefore migrate the real staging database even with checkout closed. Advisory locking is disabled: do not rely on Prisma to serialize concurrent deploys.

Follow [PENDING_MIGRATIONS.md](PENDING_MIGRATIONS.md). Known **prior local rare_dev** pending migrations are `20260920120000_analytics_paid_at_index` and `20260921120000_session_version`; staging pending history is NOT TESTED, not assumed equal. No migration authorization has been supplied for the identified real staging DB.

Before any deploy: approve this exact environment/PG target and commit; read schema/history using the authorized DB access path; obtain and verify backup/checkpoint/recovery; identify one migration executor and freeze concurrent web promotions/manual migrate commands; approve the migration window and ordinary-index/session-column locking risk. Worker promotion must use the compatible approved commit without becoming another migration executor. If any gate is missing, keep DEPLOY_BLOCKED_BY_MIGRATION_RISK. Do not deploy first and discover the DB change afterward.

## External homologation sequence — NOT EXECUTED

1. **Storage:** approve dedicated volume or separately provisioned staging R2. With synthetic media prove original write/read, public URL, generated variants, editor save, retained references and redeploy persistence. Do not use production objects or migrate media silently.
2. **Stripe:** prove TEST keys on every participating process and staging-specific endpoint/secret before creating anything. Account read reports BR, card_payments active; this is not a successful test transaction. Isolated synthetic order/reservation/session: success/cancel redirects; approved/declined/insufficient-funds/expired-card/CVC/processing-error cases; duplicate requests and idempotency. Never use live keys or charge.
3. **PIX:** determine actual account/Test environment eligibility; then creation, pending, expiry, asynchronous success/failure, duplicate and late webhook. Missing pix_payments in the account response is not proof of unsupported PIX, and card_payments active is not PIX approval. [Stripe PIX documentation](https://docs.stripe.com/payments/pix).
4. **Parcelamento:** **REQUIRES PRODUCT DECISION**; account/product support **NOT VERIFIED**. Current checkout has card/PIX selection, no explicit installment implementation. The documented [Mastercard Installments](https://docs.stripe.com/payments/mastercard-installments) supported-country list does not include Brazil; this does not establish universal Stripe Brazil support/absence. Owner defines requirement, then verifies an eligible BR/BRL product/account with Stripe. Do not add a feature or promise installments from card capability.
5. **Webhook:** enabled TEST endpoint is `https://rare-staging-staging.up.railway.app/api/stripe/webhook`, API version 2026-04-22.dahlia. Registered events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, payment_intent.succeeded, payment_intent.payment_failed. Registration is not delivery. Exercise valid/invalid signature, test/live mismatch, duplicate event, retry, out-of-order/late delivery and transactional order reconciliation. Confirm correct endpoint signing secret without exposing it.
6. **Freight:** authenticate only against `https://sandbox.melhorenvio.com.br`; token presence alone is insufficient. Enable shipping only within approved staging. Quote `/api/v2/me/shipment/calculate`: PAC/SEDEX where applicable, measured package dimensions/weight, invalid CEP, timeout/provider failure and sanitized errors. No label purchase or shipment creation.
7. **Email:** after bootstrap, authorize specific test recipients (do not publish addresses), configure EMAIL_TEST_RECIPIENTS and a fresh valid EMAIL_SEND_NOT_BEFORE, inspect eligible backlog and use isolated synthetic messages only. Both web/worker must share this policy. Existing config validates as smtp_configured_delivery_unverified, not provider auth/delivery PASS. Test provider auth/send/delivery, token/lease claim, retry, uncertain handling, duplicate protection and worker processing. Never drain real/old backlog or send campaigns.
8. **Monitoring/ownership:** authenticated runtime/DB diagnostics, worker startup/restart, queue age/attempts/expired leases, webhook failures, outbox backlog/uncertain and test alert delivery. A SUCCESS deployment or empty log response is not a healthy processing-loop proof. Follow [CRON_OWNERSHIP.md](CRON_OWNERSHIP.md); do not invoke the production worker to test it.

Use the existing staging E2E fixtures only after isolation/authorization; local mocks and skipped STAGING_E2E are not external evidence. Record scenario, artifact, environment, timestamp and observed outcome; no absent error may be labeled homologation.

### Product dimensions strategy

**Exclude from real-quote homologation until measured**: supreme-bag, bone-chrome-hearts, jaqueta-nike-nocta, camiseta-bape, camiseta-hellstar. These are the prior local rare_dev findings, not an asserted staging/live inventory. No catalog was changed. Use an explicitly identified synthetic test product with an owner's actual measured package; no generic/copy-pasted or fabricated dimensions. Audit authorized staging catalog before quoting. Bape may vary package by variant; verify packaging rather than relying on fallback dimensions.

## Rollback plan — approval and drill required

- **Application:** preserve artifact/deployment identifiers, config snapshot references and current/new source commit. Current staging prior SHA is 4ea73f50cafdbf67e16dc71de985052075feca42; it is a reference, not yet a certified compatible rollback artifact. Approve compatibility before switching. Pause new test entry/promotions under the owner, preserve webhook reconciliation and one queue owner.
- **Database:** additive index/session migrations are not automatically reversed. Do not drop columns, reset database or restore over post-checkpoint writes. Review schema compatibility; if restore is required, explicitly authorize and reconcile writes after checkpoint with a recovery plan.
- **Sessions:** retain sessionVersion and credentialVersion revocation, temporary-password restrictions and invalidated-token behavior. Never reset counters or accept old tokens simply to make an older artifact run.
- **Orders/webhooks/outbox:** preserve order/reservation/payment IDs, webhook dedup records, leases/tokens and uncertain rows; account for events arriving during rollback. Reconcile against TEST provider state; do not blindly recreate sessions, re-charge, resend uncertain emails or release paid inventory.
- **Storage:** retain originals/variants/references and the same approved persistence target/URL scheme. Verify older artifact read compatibility; no automatic deletion/media backfill.

## Remaining human gates

1. Create the Draft PR and confirm required reviews/checks/protection: [manual PR handoff](../cycles/PR_STAGING_PREPARATION.md). Permission failure is PR_CREATION_BLOCKED_BY_PERMISSION, not grounds for ACL bypass.
2. Approve the staging target/bootstrap, compatible pinned artifact, checkpoint, single migration executor and explicit staging migration window. No production promotion included.
3. Authorize controlled test recipients/fixtures and provider scenarios; assign cron/alert owner, approve restore/rollback drill and decide [DEPENDENCY RESIDUAL RISK](../PRODUCTION_READINESS.md#dependency-residual-risk). Commercial risk acceptance remains the owner's decision.

READY FOR MERGE: NO (PR/remote gates). READY FOR STAGING/HOMOLOGATION: NO (bootstrap and authorization/verification gates). READY FOR PRODUCTION: NO (separate promotion gate).
