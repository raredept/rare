# Checkout expiry — operational ownership

Reviewed on 2026-10-03. Repository configuration is verified; **VERIFIED LIVE: NOT TESTED**. File presence does not prove that either scheduler/service is deployed, enabled or connected to the same database. No live cron, worker or configuration was changed.

## Repository map

| Entry | Configuration | Final flow | Email outbox |
|---|---|---|---|
| Vercel | `vercel.json`: `0 3 * * *`, GET `/api/cron/release-expired-inventory` | `releaseExpiredReservations` → `runCheckoutExpiryBatch` | Does not drain email outbox |
| Railway | `railway.cron.json`: `npm run checkout:worker`, `cronSchedule: null`, restart ALWAYS | `scripts/checkout-expiry-worker.ts` → serial `runCheckoutExpiryBatch` loop | Calls `processEmailOutbox` when the configured email driver is not disabled |

Vercel's schedule is daily at **03:00 UTC / 00:00 America/Sao_Paulo** under the current UTC−03 offset, not every few minutes. Railway's configuration is a persistent process, despite the filename: no Railway cron schedule. Its poll interval is 15,000 ms, adjusted for batch duration (minimum wait 100 ms); `--once` runs once and exits. Actual deployed commands/services must be checked live before an ownership decision.

The HTTP route supports GET and POST and validates CRON_SECRET with constant-time hash comparison; CRON_SECRET_PREVIOUS supports rotation. Missing configuration returns 503; invalid authorization 401. Do not print or put those values into documentation/logs.

## Queue and business protections

`src/lib/checkout-expiry.ts` backfills eligible legacy awaiting-payment orders using their existing deadline and `ON CONFLICT` on orderId. The default batch size is 20. Atomic `FOR UPDATE SKIP LOCKED` claiming grants a 120-second lease with a leaseToken; completion/retry queue writes require the current token. Failures retry with exponential delay from 15 seconds capped at 300 seconds; processing payments defer another check rather than releasing inventory prematurely.

Provider status is authoritative: Stripe session/intent reconciliation distinguishes paid, expired and processing/unconfirmed session creation. Inventory release/payment reconciliation also has transactional business guards. `SKIP LOCKED` avoids simultaneous claims of currently locked jobs, and leaseToken fences stale queue completion writes.

These mechanisms **do not**:

- elect one operational owner or eliminate redundant polling/provider requests;
- guarantee exactly-once external effects if a slow operation outlives its lease and another worker reclaims it;
- prove deployment state, credentials, alerting, timely execution or equal database targets;
- make a daily Vercel call equivalent to a persistent low-latency queue worker;
- drain email through the Vercel expiry route.

The worker's email outbox uses separate atomic SKIP LOCKED claims, a five-minute lease and token, up to five attempts with exponential retries (60 seconds to one hour). An expired sending lease becomes `uncertain`, not a blind resend. Deterministic message identity and row idempotency reduce duplication; they do not guarantee provider exactly-once delivery. Resolve uncertain messages through the existing review procedure. Drivers are selected explicitly (`disabled`, `smtp`, `zeptomail`), with no automatic provider fallback.

## Overlap risk

If both entries are active against the same database, they compete for the same expiry queue. Normal valid claims are protected, but there is unnecessary load, unclear incident ownership and possible overlapping provider requests after lease expiry. If they point to different databases, this is not the same queue but requires separate ownership per environment. Neither case has been verified live in this cycle.

## RECOMMENDED owner

**Railway persistent checkout worker as the primary owner per environment** is coherent with the existing durable expiry queue, 15-second polling and email outbox processing. This is a recommendation, not a confirmed live topology or an authorized service change. Keep a documented Vercel fallback/rollback plan, not two concurrent primary owners.

Before a separately authorized change, the operator must:

1. Inventory actual Vercel schedules and Railway services/processes, approved commit, environment and safely identified database. Compare targets without copying URLs/secrets into evidence.
2. Observe logs, queue age/backlog, attempts, expired leases, provider failures and email `uncertain` rows. Verify a single healthy worker and that disabled email remains disabled when intended.
3. Assign one named operational owner; document alert thresholds/on-call, tested startup/restart and rollback/failover. A stopped process must not leave checkout enabled without expiry/outbox ownership.
4. Approve any live scheduler/service modification explicitly. Only then enact the chosen ownership and verify scheduled invocations, worker health and queue drain with safe synthetic staging data.
5. For fallback, first establish which owner is stopped/unhealthy, then activate only the reviewed replacement. Restore email ownership separately if the fallback is the HTTP route. Do not infer outbox coverage from inventory expiry alone.

There is no automatic live-disable command in this runbook. Live ownership, alerting and failover remain EXTERNAL HOMOLOGATION REQUIRED / NOT TESTED.

## Evidence and reference

Repository: `vercel.json`, `railway.cron.json`, `scripts/checkout-expiry-worker.ts`, `src/app/api/cron/release-expired-inventory/route.ts`, `src/lib/checkout.ts`, `src/lib/checkout-expiry.ts`, `src/lib/checkout-policy.ts`, `src/lib/email-outbox-worker.ts`, `src/lib/transactional-email.ts`.

[Vercel Cron documentation](https://vercel.com/docs/cron-jobs) specifies UTC scheduling. Queue/lease/outbox behavior above is repository-derived, not proof of a live service.
