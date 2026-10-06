# RARE — CREDENTIAL ROTATION APPROVAL

Prepared 2026-10-06. **P0; RELEASE_SECURITY_FREEZE=ACTIVE. PLAN ONLY.** Incident/evidence: [CREDENTIAL_INCIDENT_202610.md](CREDENTIAL_INCIDENT_202610.md). No secrets, replacements, fingerprints or recipient/customer data are included. No credentials were created/rotated/revoked, no environment was changed, no service was deployed/restarted and no migration was run.

STAGING_CREDENTIAL_ROTATION_REQUIRED=YES. PRODUCTION_CREDENTIAL_ROTATION_REQUIRED=YES. AUTHORIZED_PHASE_S=NO. AUTHORIZED_PHASE_P=NO. Production urgency is independent of the Admin release; do not postpone Phase P until staging/bootstrap/merge.

## Frozen artifact and review boundary

Repository raredept/rare; branch codex/admin-dashboard-reconciled-20261002. Re-fetched main 4ea73f50cafdbf67e16dc71de985052075feca42; entry local/remote documentation HEAD 06981b8c844590b4f1c94cc3a41898cf7bd3404b, 25 ahead / 0 behind. Final documentation HEAD/count are reported after push, never embedded self-referentially.

- CODE_CANDIDATE_SHA: 7a820b62bb1515f7b30ccf31badf1f0881a6bd84, last runtime/test candidate, unchanged.
- STAGING_DEPLOYMENT_CHECKPOINT: b06ef6e437ee2d28fbeffeb5f91144c389aaa518, frozen future deployment checkpoint; only docs between runtime candidate/checkpoint/entry documentation HEAD.
- This containment dossier creates no runtime candidate and approves neither checkpoint deployment nor main merge.
- Current deployed source of BOTH environment web/worker pairs: 4ea73f50cafdbf67e16dc71de985052075feca42. Scoped auth/Stripe/webhook/cron/worker/config files are identical to checkpoint. Future containment activation must preserve the approved existing artifact, not promote Admin code.
- Exact PR search still absent. No creation retry after the known integration 403; PR_CREATION_BLOCKED_BY_PERMISSION. [Manual Draft handoff](../cycles/PR_STAGING_PREPARATION.md). Public repo; required protection read again 403; reviews/protection UNKNOWN. Entry-HEAD and repository-wide Actions runs 0, check-runs/statuses 0: NOT CONFIGURED / none reported, not PASS.

## Decisions before any action

Choose A, B, C or D below. A generic approval sentence does not waive prerequisites. Record privately: named operator, exact phase/environment/services, authority to create/revoke secrets, fixed exposure/cutover deadline, provider consumer inventory, missed-event handling, approved maintenance scope, verified migration-free activation path or separate migration authorization, session logout communication and cleanup disposition. Do not paste replacement values into chat or terminal arguments.

All current affected categories are **COMPROMISED** pending proof. Replacement status: NOT CREATED BY THIS CYCLE / external status UNKNOWN. Match/difference classifications cannot certify historical revocation. Credentials must be independent per environment, supplied through provider/Railway secret controls and validated without values. No TEST credential may be replaced with LIVE in staging.

### Non-negotiable activation gate — both phases

Both webs currently run migrate deploy in predeploy, with advisory locking disabled; workers currently do not. Updating Railway variables can trigger deployment; storing values without deployment does not refresh old processes. Restart/redeploy/rollback behavior must not be guessed. Native rollback restores custom variables and may reintroduce the compromise. Verify a supported path that activates the replacement with the already-approved artifact and **no DDL** before approving execution, or obtain a separate exact migration manifest/checkpoint/window approval. Config-file precedence also requires review so a worker cannot inherit web migrate deploy.

Do not mutate predeploy/config selectors/source/commerce flags merely to make rotation easy. If a temporary migration suppression/entry pause is necessary, its exact resource/delta/window/restoration must be independently and explicitly approved. No DB reset, migration resolve, schema inspection query or backup was executed here. Staging history and backups remain unverified; production schema/backup history were not queried. If the activation gate cannot be proved, the plan remains blocked; owner may separately authorize emergency provider expiration/entry containment with an explicit reconciliation/recovery disposition.

## STAGING ROTATION — Phase S

Environment: Rare / staging / d8399691-dacf-41e9-a9d5-060c97672e39.
Web: rare-staging / 3f4b79f6-2819-45a6-986d-584dc7ac803a.
Worker: rare-checkout-worker-staging / 2bfcf6af-11f4-459f-9089-a841ae25e57f.

| Required field | Phase S exact scope / gate |
|---|---|
| Credentials to rotate | Stripe TEST API key, staging webhook signing secret, staging ADMIN_SESSION_SECRET, staging CRON_SECRET; no new value generated here |
| Services affected | Web all four; worker API key only; local root env + five generated copies contain the same TEST key and require private replacement/approved sanitization; other consumers UNKNOWN until inventoried |
| Expected session impact | Both Admin and customer logins invalidated across every refreshed web instance; preserve counters, password/credential version and forced-change controls |
| Webhook impact | Retain current TEST destination/registered six-event contract; verify provider account/mode privately; receiver accepts one configured secret; provider transition must be independently approved |
| Cron impact | Web validates primary; staging worker does not use HTTP cron/secret; Vercel/manual callers UNKNOWN; do not enable a cron to test rotation |
| Required restarts/deploys | Controlled process activation for web + worker after replacement configuration, existing 4ea73f5 artifact; actual supported mechanism/migration-free manifest must be proved before execution; no candidate deployment |
| Validation | Replacement TEST identity, all consumers/read-only health, old API expired, old webhook-only signatures rejected, old Admin/customer JWTs rejected, synthetic re-login/forced-password restriction, old cron rejected; detailed boundaries below |
| Abort conditions | Any LIVE key, production identity/reference, unknown key/caller consumer, uncontrolled SMTP/Push/worker effects, predeploy DDL, missing webhook recovery, old credentials still accepted or mixed web instances |
| Estimated operational risk | HIGH until activation/backlog/caller gates resolved; TEST mode limits real charging, not staging DB writes, SMTP or exposure impact; no unsupported outage-time estimate |

Future order, ONLY AFTER PHASE S APPROVAL:

1. Inventory every TEST consumer/destination/caller privately; choose incident deadline and migration-free refresh path; approve staging-only entry/worker quiescence and preserve webhook retries, jobs/leases/outbox. Current web checkout=true/shipping=true/SMTP and worker SMTP are not closed. Proposed false/false/disabled remain a separate explicit bootstrap/config delta, not silently applied by credential authorization. Existing reconciliation ignores checkout flag.
2. Create independent replacements privately. Stripe API: choose provider rotation with immediate expiration or shortest explicitly approved overlap; do not assume all consumers have seven days. Webhook: choose immediate old-secret expiration plus retry recovery, or fixed minimal provider dual-signature window. Session/cron: CSPRNG >=32 random bytes; session code enforces >=32 characters. Stage secret values without incidental deployment and never in output/command history; no API-key or webhook values in repo. New local TEST usage must be similarly private.
3. Activate all consumers in the reviewed sequence/window on the existing compatible artifact. If overlap was explicitly approved, prove all replacements active, expire old API/provider webhook secret immediately at the agreed cutoff and remove all old session/cron acceptance. Complete verification and private local-copy disposition. On failure, hold affected entry under approved maintenance and recover forward with uncompromised replacements, never rollback exposed values. Phase S verified completion is required BEFORE candidate bootstrap/homologation, but does not authorize it.

## PRODUCTION ROTATION — Phase P (independent approval)

Environment: Rare / production / 6c9bbc98-9eb7-4a40-a352-e1aad3e8b6cd.
Web: rare / 28303795-8c51-4727-ac39-cfc87549bef1.
Worker: rare-cron / b199a18a-69e3-4971-86ab-20e142e42e02, currently a continuous checkout:worker, not the legacy HTTP cron caller.

| Required field | Phase P exact scope / gate |
|---|---|
| Credentials to rotate | Production LIVE API key, production webhook signing secret, production ADMIN_SESSION_SECRET and CRON_SECRET; not staging replacements |
| Services affected | rare web all four; rare-cron worker LIVE API key, plus configured matching CRON_SECRET (not used by current worker); inventory other services/vaults/Vercel/manual callers before cutover |
| Expected session impact | Production Admin AND customer logout/re-login; communicate downtime/logout privately; no customer data query or account change in this cycle |
| Webhook impact | Privately verify actual LIVE endpoint(s)/account/context/events, provider transition deadline and missed/late event disposition; no live endpoint list/API test fetched here |
| Cron impact | Validator web, potential Vercel/manual/external callers UNKNOWN; worker continues DB/Stripe reconciliation independent of storefront flags; coordinate only identified callers |
| Required restarts/deploys | Independent explicit production maintenance/config/process authorization; preserve current 4ea73f5 artifact and commerce state unless separately approved; web predeploy migration risk must be resolved before refresh |
| Validation | Replacement LIVE account/permissions via approved nontransactional checks; all web/worker replacements active; old API expired; old webhook/session/cron acceptance absent; existing payment reconciliation preserved; no real payment/quote/email test |
| Abort conditions | Unknown production consumer, lost/missed payment reconciliation without disposition, unknown/mismatched webhook destination, DDL or release promotion mixed into cutover, old-secret fallback/rollback, wrong identity or unexpected commerce change |
| Estimated operational risk | HIGH: LIVE credentials/payment reconciliation and customer sessions. Urgent containment independent of Admin readiness; minimize exposure window, do not wait for merge/staging |

Future order, ONLY AFTER PHASE P APPROVAL:

1. Owner urgently inventories LIVE consumers/destinations/callers, privately checks provider audit/use anomalies, approves exact containment deadline/maintenance/reconciliation plan and proves migration-free existing-artifact activation. Production approval is never inherited from Phase S; unknown consumers block a continuity-safe cutover, not the need for urgent owner response.
2. Owner creates independent replacements and performs selected immediate/minimal-overlap provider rotation. Coordinate web, rare-cron, all actual callers and secret sources; communicate Admin/customer logout. Only approved production resources/credential categories may change; no candidate/main promotion, migration, payment/refund/quote/email or broad cron change is included.
3. Activate approved consumers, prove new configuration, expire/revoke the exposed old API/provider secrets at the fixed cutoff, eliminate old JWT/cron acceptance and verify missed-event/reconciliation disposition with sanitized evidence. Remain frozen on uncertainty. Recovery uses uncompromised credentials and compatible current artifact; never restores old values. Record Phase P closure separately from release readiness.

## Consumer / transition contracts

- API key: web and worker within each environment currently match; process-cached Stripe clients require new process configuration. API replacement must preserve account/environment and needed checkout/session/PaymentIntent read/create/expire permissions; do not redesign scopes or switch accounts blindly. Revocation verification uses provider status plus approved nontransactional authentication failure checks, not a charge.
- Webhook: one application secret; provider dual signatures only during an explicitly chosen Roll secret interval, not app multi-secret support. Preserve destination and signature verification; reject mode mismatch. Live/sandbox retries have finite windows. No destination deletion, silent event loss, fabricated ACK or unrestricted replay. [Stripe webhook behavior](https://docs.stripe.com/webhooks).
- Session: ADMIN_SESSION_SECRET is shared by Admin/customer auth and proxy; AUTH_SECRET fallback currently absent. All replicas must use the replacement, old signature rejected immediately after cutover; no legacy signature list. Do not lower sessionVersion or credentialVersion, change password state or bypass temporary-password gates.
- Cron: optional CRON_SECRET_PREVIOUS support exists in current source; recommended incident policy leaves it absent. If owner explicitly accepts a minimum overlap, set deadline/removal/negative test; old value is still compromised while accepted. Do not treat configured rare-cron secret as proof of an active HTTP caller. Vercel/manual/external caller inventory remains UNKNOWN.
- Other provider/storage/DB credentials are not automatically rotated by this package. Additional credentialed URLs found in PowerShell history require private provenance/validity assessment; they did not match current PG passwords and are not authorization to mutate either database.

## Verification — future authorized actions, not performed here

| Action | Expected result | Failure / scope boundary |
|---|---|---|
| Read provider/vault/consumer inventory privately | Exact environment/account/services, no unknown consumers; replacements issued and old expiration recorded | Unknown consumer/account, unsupported mode or missing private operator authority |
| Verify active artifact/config on every consumer | Same approved existing artifact, new secret classification, sole compatible worker, no DDL | Plain stored-variable presence or restart alone is insufficient; old instances/config accepted, predeploy migration or candidate promotion |
| GET health/environment/source metadata | Healthy expected environment/current artifact, staging access restrictions retained | Failure/wrong environment; no customer/order queries or cron invocation |
| Approved nontransactional API authentication check | New correct account/mode works; old expired key no longer authenticates | Any staging LIVE, old key accepted, permissions/account mismatch; no session/payment creation |
| Controlled webhook signature/mode negative test | Missing/old-only/invalid signature and wrong mode rejected before reconciliation | Not a real payment; approved synthetic request only; correct signed handled events can mutate DB and require separate replay/fixture approval |
| Approved endpoint transition evidence | All deliveries accounted for with finite retry window and late/out-of-order/dedup disposition | No blanket “Stripe will retry forever”; do not delete destination/reset StripeEvent |
| Approved synthetic Admin/customer auth checks | Old cookies invalid; new login works; revoked sessions rejected; temporary-password restrictions retained | Login/logout write cookies; logout can increment DB counter, so not part of read-only current cycle; never use real customer fixtures |
| Cron negative check on each actual validator | No/mismatched/old secret returns 401 (or 503 if intentionally unconfigured); previous secret absent | Do NOT send a valid secret as a harmless smoke: valid GET/POST releases/reconciles inventory and can call Stripe |
| Runtime observer under approved controlled resume | No stale key/signature errors, queue/reconciliation policy observed, outbox/mail effects within approved baseline | Extra --once worker, automatic backlog drain, email/provider writes without authorization |
| Local copies / record handling | Root env privately updated; generated copies approved sanitized/removed; access to raw record restricted; sanitized timeline retained | No secret values in replacement commands/reports; file cleanup is not revocation; never claim remote records erased |

Do not weaken signature/mode/auth guards for successful tests. Verify that negative requests reached the intended handler rather than merely receiving an edge/Basic denial; use authorized staging access privately. No session counter reset or migration as a test shortcut. Completion evidence should contain only owner/phase/time, service/artifact identity, result classifications and private audit-reference location, never a credential identifier/fingerprint/value.

## P0 abort / contingency

Abort bootstrap/release for any committed/public real secret, unexpected staging LIVE key, unknown production consumer/caller, unplanned payment interruption, unmanageable webhook transition, old-secret acceptance, mixed instances, migration target/DDL uncertainty or configuration mismatch. Escalate to the owner, do not bypass the gate. Suspicious provider use calls for urgent separately authorized emergency containment, not autonomous revocation here.

If new credentials fail, repair with an uncompromised replacement/compatible artifact and reviewed environment. Native rollback can restore secrets/custom variables; verify replacements remain before any rollback or choose forward fix. Never re-enable expired/exposed secrets, reset orders/reservations/dedup/outbox, restore DB or alter volumes to simplify recovery. Preserve audit evidence without raw credential material.

## Cumulative release gates / authorization options

Phase S must actually complete and be verified before candidate bootstrap. Credential containment AND separate migration/checkpoint/single-executor approval are cumulative. Proposed bootstrap remains CHECKOUT_ENABLED=false, SHIPPING_ENABLED=false, EMAIL_DRIVER=disabled on both processes; these do not stop existing Stripe reconciliation/webhooks/expiry. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain. No new DB access attempt was made.

READY FOR MERGE=NO. READY FOR STAGING BOOTSTRAP=NO. READY FOR EXTERNAL HOMOLOGATION=NO. READY FOR PRODUCTION=NO. Both rotation phases AUTHORIZED=NO. Incident plan complete; incident containment/release recovery NOT COMPLETE.

- A — Authorize staging credential rotation only, with the explicit reviewed consumer/process activation scope and satisfied gates; no production or candidate bootstrap/migration permission.
- B — Authorize production credential rotation only, independently, with reviewed urgent maintenance/reconciliation/activation scope; no Admin release promotion/migration permission.
- C — Authorize both as two controlled, separately evidenced phases; select owner/order/windows independently, with production urgency preserved.
- D — Do not rotate yet; keep release frozen. This does not neutralize exposed credentials; urgent owner risk disposition still required.

Three minimal human decisions: (1) choose A/B/C/D and name authorized operator(s); (2) approve exact per-phase activation/migration-free maintenance, incident overlap/revocation deadline, session impact and caller/webhook recovery scope; (3) approve private local-copy/history/record-access cleanup disposition and maintainer PR/required-gate handoff. No secret should be supplied in chat. Stop after this sanitized documentation is validated and pushed.
