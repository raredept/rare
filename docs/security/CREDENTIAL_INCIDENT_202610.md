# RARE — credential incident / October 2026

Assessment: 2026-10-06. Severity **P0**. Incident discovered and disclosed during the 2026-10-04 staging preflight. **RELEASE_SECURITY_FREEZE=ACTIVE** is an operational/documentary state, not a new environment variable. No rotation, revocation, configuration change, deploy/restart, migration, provider transaction or cleanup was performed in this cycle.

Primary decision artifact: [CREDENTIAL_ROTATION_APPROVAL.md](CREDENTIAL_ROTATION_APPROVAL.md). Existing bootstrap dossier: [STAGING_BOOTSTRAP_APPROVAL.md](../cycles/STAGING_BOOTSTRAP_APPROVAL.md). A plan is not containment. Staging and production remain separate, independently authorized phases.

## Incident / scope / known exposure channel

A PowerShell helper named Compare collided with the built-in Compare-Object alias and emitted staging and production credential values into conversation/tool output. This was an agent diagnostic error, not a proven application vulnerability. Do not replay the erroneous command, share the raw record, or use its output as documentation. Treat affected credentials as **COMPROMISED** until authorized replacement/revocation and verification are evidenced. Absence from Git does not restore confidentiality; unauthorized use/access has neither been proved nor excluded.

Affected categories: Stripe server API credentials, Stripe webhook signing secrets, ADMIN_SESSION_SECRET and CRON_SECRET in staging and production. Current presence/difference is not evidence that an exposed old value has been revoked: no comparison against the raw incident record was performed. New credentials were not created here; their existence outside this cycle is UNKNOWN.

## Repository exposure assessment / safe method

Read-only diagnostics captured CLI output in memory and emitted only allowlisted metadata/classifications. Unique helper names were used; no credential, suffix, fingerprint, hash of a credential, recipient or customer/order detail was emitted. An ephemeral scanner script outside Git contains diagnostic code only, no captured values; no raw scan/provider/variable response was written to disk. Existing release guard was inspected before execution. No scanner/tool was installed.

Entry-state tracked/untracked scan: **505 files**. All reachable refs at that scan: **207 commits, 1,717 unique blobs, 1,709 text blobs**. All text blobs were inspected in memory with credential patterns and exact matches against the four currently configured Railway categories. No configured affected credential matched current versionable files or reachable historical text blobs. Eight binary blobs were not semantically decoded. The subsequent docs-only commit is separately checked before publication; final HEAD/count are reported at closure. Reflogs, unreachable objects, deleted remote surfaces and other clones are outside this result.

Pattern candidates in .env.example, test files, scripts/qa-checkout-concurrency.ts and scripts/validate-linux-standalone.mjs were privately triaged as template/synthetic QA literals, not currently configured keys. The two scripts set QA/build-only values and use an in-process Stripe double or closed local validation; historical variants remain pattern-based findings, not provider validation of every former value. No **confirmed** P0_REPOSITORY_SECRET_EXPOSURE was found. This is NOT a guarantee that arbitrary encoded/unknown former credentials never existed in Git.

## Exposure surfaces — evidence and limits

| Surface | Classification | Evidence / action |
|---|---|---|
| Conversation/tool output | FOUND | Original P0 acknowledged; treat confidentiality as compromised, never reproduce/share raw output |
| Current Git worktree/versionable files | CHECKED / NOT FOUND for affected real values | 505 files, including two preexisting untracked user docs; fixtures triaged; no user file changed |
| Reachable Git history/all fetched refs | CHECKED / NOT FOUND for affected real values | 207 commits / 1,709 text blobs; patterns + current exact matches; binary/unreachable limits above |
| GitHub public branch | CHECKED / NOT FOUND within scanned refs | Repository visibility PUBLIC; local/remote HEAD matched at entry; reachable branch history scanned; no public-clean guarantee beyond scope |
| GitHub PR/issues/comments | CHECKED / NOT FOUND by patterns | Exact requested PR absent; API list returned 1 issue, 0 issue comments, 0 review comments; no credential-shaped matches; deleted/private/inaccessible surfaces UNKNOWN |
| GitHub CI logs | NOT FOUND for Actions runs | All repository Actions runs reported 0; final-known SHA checks/statuses also 0; external CI/log providers UNKNOWN |
| Local logs/output/QA/browser reports | CHECKED / FOUND | 15,773 readable artifact/config/history files in bounded roots; five generated standalone .env copies plus root .env contain the configured Stripe TEST credential; see paths below |
| PowerShell PSReadLine history | CHECKED / FOUND additional sensitive material | Windows PowerShell history contains 11 credentialed connection-URL occurrences; none of parsed passwords matched current staging/production PG passwords; provenance/validity UNKNOWN, private owner triage required |
| Current app-terminal scrollback/process history | UNKNOWN | File history is not a complete terminal buffer/process audit; no live UI/clipboard read performed |
| Local Codex transcript | NOT ACCESSIBLE for content scan | Current chat transcript exists but read failed due to file in use; failed read is NOT a negative scan. Known conversation exposure remains FOUND |
| Relevant temporary files | CHECKED / NOT FOUND by scoped patterns | Task-prefixed Temp inventory found the diagnostic script only; unrelated temp files/full user profile not scanned |
| Playwright ZIP text | CHECKED / NOT FOUND by patterns | 14 archives / 686 readable entries; 2,304 binary/large entries skipped; no extraction or copying |
| Screenshots/images | UNKNOWN content | 836 files inventoried, none modified since incident date; no OCR/visual certification |
| Railway build/runtime logs | CHECKED bounded sample / NOT FOUND | Up to 200 lines per web/worker/build/runtime since 2026-10-04; 49 production-web runtime rows, other samples empty; only classifications printed. Older/other deployment/HTTP/network logs UNKNOWN |
| Documentation | CHECKED / NOT FOUND within scanner rules | Existing release docs plus new incident/approval docs scanned again before commit |
| Clipboard / clipboard-generated files outside repo | UNKNOWN | No clipboard access or broad attachment/user-profile search; existing workspace generated text covered by scoped scan |

Artifact roots included output, playwright-report, .next/static, .next/server, .vercel and root env/log/tmp candidates; nonexistent logs/log/tmp/temp/test-results/coverage roots were recorded absent. Node dependencies/cache trees were excluded. There were 1,618 binary files and 4 oversized files in the broad pass; they are not clean certifications. .next/standalone/.env was separately inspected and matches the same local Stripe TEST key. ZIP image contents and browser profile databases remain UNKNOWN.

### Local sensitive copies — no values

| Path | Type | Tracking / scope | Required action after approval |
|---|---|---|---|
| .env | Configured Stripe TEST credential | IGNORED / CURRENT LOCAL CONFIG | Privately replace with approved TEST credential or remove its use; never commit |
| .next/standalone/.env | Same configured Stripe TEST credential | IGNORED / GENERATED BUILD | Quarantine access; approved sanitization/removal or controlled rebuild; do not distribute the build directory |
| output/final-review-clean-artifacts-20261003/standalone/.env | Configured Stripe TEST credential | IGNORED / LOCAL ARTIFACT | Approved targeted sanitization/removal; preserve required non-secret QA evidence |
| output/final-review-next-backup-20261003/standalone/.env | Configured Stripe TEST credential | IGNORED / LOCAL ARTIFACT | Same; it is not a safe distributable backup |
| output/integration-clean-artifacts-20261003/standalone/.env | Configured Stripe TEST credential | IGNORED / LOCAL ARTIFACT | Same |
| output/next-pre-reconcile/standalone/.env | Configured Stripe TEST credential | IGNORED / LOCAL ARTIFACT | Same |
| Windows PowerShell PSReadLine ConsoleHost_history.txt | Credentialed connection URLs; validity UNKNOWN | OUTSIDE REPO / HISTORICAL LOCAL | Owner privately identifies origin/revocation state and authorizes selective cleanup; do not expand automatically into database rotation |

Generated copies predate the diagnostic event and are not proven to have been created by it. Root env is an intended local credential store, but the copied credential still belongs to the compromised category. No sensitive file was removed, modified, copied or staged. No Git history rewrite is justified by a confirmed committed affected secret here; if one is later confirmed, revoke first and coordinate host/clone/cache remediation, never force-push unilaterally.

## Affected credential matrix / required rotations

| Credential | Staging | Production | Rotation required | Side effect |
|---|---|---|---|---|
| Stripe server API key | PRESENT / TEST / COMPROMISED | PRESENT / LIVE / COMPROMISED | YES, independently | Web + expiry worker clients; existing-session/order reconciliation can fail if consumer cutover incomplete |
| Stripe webhook signing secret | Web PRESENT / COMPROMISED | Web PRESENT / COMPROMISED | YES, independently | Signature verification and provider retry transition; distinct from API key |
| ADMIN_SESSION_SECRET | Web PRESENT / COMPROMISED; AUTH_SECRET MISSING | Web PRESENT / COMPROMISED; AUTH_SECRET MISSING | YES, independently | Admin AND customer JWTs invalidated on every updated web instance |
| CRON_SECRET | Web PRESENT / COMPROMISED; worker MISSING | Web + rare-cron PRESENT / MATCHES_WEB / COMPROMISED | YES, independently | HTTP cron validators/callers; continuous worker is not that HTTP caller |

Staging web's four present categories differ from production. Web/worker API keys match within each environment; stage worker differs from production worker. CRON_SECRET_PREVIOUS is MISSING in both webs. These are current classifications, not proof of revocation or absence of other consumers.

## Consumer coordination / source evidence

| Consumer | API key | Webhook secret | Session secret | Cron secret | Evidence / boundary |
|---|---|---|---|---|---|
| Railway staging rare-staging | USES KEY | USES KEY | USES KEY | USES KEY as validator | Active service 3f4b79f6-2819-45a6-986d-584dc7ac803a |
| Railway staging rare-checkout-worker-staging | USES KEY | DOES NOT USE | DOES NOT USE | DOES NOT USE / MISSING | Active service 2bfcf6af-11f4-459f-9089-a841ae25e57f; continuous checkout:worker |
| Railway production rare | USES KEY | USES KEY | USES KEY | USES KEY as validator | Active service 28303795-8c51-4727-ac39-cfc87549bef1 |
| Railway production rare-cron | USES KEY | DOES NOT USE | DOES NOT USE | PRESENT, current worker DOES NOT USE | Active service b199a18a-69e3-4971-86ab-20e142e42e02; checkout:worker, no schedule; historical/manual caller still UNKNOWN |
| Dedicated PG/Redis services in each environment | DOES NOT USE | DOES NOT USE | DOES NOT USE | DOES NOT USE | Four categories MISSING; no DB data queries |
| Local tooling/root env/build copies | USES TEST KEY / copies FOUND | Actual consumers UNKNOWN | QA/template use; production identity not matched | Manual caller script exists, use UNKNOWN | Replace copied TEST key privately; no automation/tool was executed to create a transaction |
| CI / other services / external schedulers | UNKNOWN outside inspected surface | UNKNOWN | UNKNOWN | UNKNOWN | No GitHub Actions runs/workflow tree reported; provider vaults/secrets outside connection not inspected |
| Vercel | UNKNOWN | UNKNOWN | UNKNOWN | Configured in repo, active caller UNKNOWN | CLI unavailable; .vercel link is not evidence of runtime; owner inventory required |

Railway Rare project 72ed12be-9a2a-4e13-8594-30ffd8ffa565. Staging environment d8399691-dacf-41e9-a9d5-060c97672e39; production 6c9bbc98-9eb7-4a40-a352-e1aad3e8b6cd. Both web/worker pairs were observed at 4ea73f50cafdbf67e16dc71de985052075feca42. Source/config/secret consumers above are byte-identical in the scoped comparison with b06ef6e. This is not an audit of all production behavior or data.

Code pointers verified at current source (same scoped deployed source): src/lib/env.ts:117 session source/minimum, :133 Stripe API source, :141 webhook source; src/lib/stripe.ts:8 cached client; src/lib/auth.ts:19/28/45/99 signatures/revocation; src/lib/customer-auth.ts:19/23/36/71 same secret; src/proxy.ts:13/19/36 both optimistic JWT checks; src/app/api/stripe/webhook/route.ts:37/55/62 signature/mode; src/app/api/cron/release-expired-inventory/route.ts:17/27 current/previous validator; scripts/call-release-expired-cron.mjs:69 HTTP caller; scripts/checkout-expiry-worker.ts:12 loop; src/lib/checkout-expiry.ts:33/71 reconciliation/TEST or LIVE session expiry. No Admin UI audit reopened.

## Rotation ordering / provider impact

See the approval package for separate Phase S / Phase P sequences. Replacement creation and expiration are provider writes; updating Railway variables and activating new processes are external changes. None is authorized here. Production containment is urgent and independent of the Admin release; it must not wait for candidate merge or staging homologation.

Stripe API clients are cached per process; changing stored variables does not refresh running clients. Approved operators must verify every new process reads the replacement and only then use a strictly bounded incident-approved overlap or immediate expiration policy. [Stripe compromised-key guidance](https://docs.stripe.com/keys-best-practices) calls for immediate rotation on exposure; ordinary long graceful migration schedules are not automatic authorization to leave compromised access active. [Key management](https://docs.stripe.com/keys) distinguishes creation from immediate/scheduled expiration. No restricted-key permission redesign is performed here.

### Webhook impact

Application reads **one** STRIPE_WEBHOOK_SECRET and verifies raw body with constructEvent. No application old/new-secret list exists. Stripe's [documented Roll secret](https://docs.stripe.com/webhooks#roll-endpoint-signing-secrets-periodically) can temporarily sign deliveries with both active provider secrets; that does not make the application accept both secrets. This compromise requires owner choice: immediate expiration plus approved receiver cutover/retry recovery, or minimum explicit provider overlap with a fixed deadline. Never silently accept the exposed secret for continuity.

Staging URL known: https://rare-staging-staging.up.railway.app/api/stripe/webhook. Registration was TEST/enabled with six events on 2026-10-04, **not re-fetched from Stripe in this cycle**. Production handler path /api/stripe/webhook is code-confirmed; production registration/all destinations/connected-account scope must be privately verified before rotation. Six handled events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, payment_intent.succeeded, payment_intent.payment_failed.

Preserve StripeEvent dedup, IDs, transactional reconciliation, reservations, leases and outbox. Provider retries are not infinite: Stripe documents live retries up to three days and sandbox retries over a few hours; deletion/disabling can suppress future retries. Owner must inventory missed delivery disposition privately, preserve receipts, explicitly approve replay after cutover and account for late/out-of-order events. Do not manufacture events, discard history, recreate payments, replay blindly or acknowledge unprocessed failures as success. API key rotation does not replace webhook secret rotation.

### Session impact

Both Admin (8h) and customer (30d) JWTs use the same resolved ADMIN_SESSION_SECRET, falling back to AUTH_SECRET only if the primary is absent. Both primary consumers and proxy verifiers use the current single secret. All updated web instances reject old signatures, so Admins AND customers must log in again. Mixed old/new instances or rollback of old variables can undermine containment. Minimum enforced by code: non-placeholder >=32 characters. Proposed private generation: independent CSPRNG material of at least 32 random bytes (256 bits), encoded to meet the existing length contract; no new value generated or printed here.

Do not reset/lower sessionVersion, change passwordHash/credentialVersion, bypass mustChangePassword, or enable an old signing-secret fallback. Reauthentication may require the normal password-change flow. Old/revoked token rejection, new Admin/customer login and temporary-password server-side restriction must be tested with approved synthetic accounts only. Login/logout tests alter auth/cookies and logout can increment DB sessionVersion: they are future approved operations, not read-only checks performed here.

### Cron impact

Code validator accepts CRON_SECRET and optional CRON_SECRET_PREVIOUS using timing-safe comparison. Both live webs currently have only the primary. Existing continuous workers do not call the HTTP cron endpoint; production rare-cron merely has the primary configured. Historical/manual script can POST it; vercel.json describes a GET scheduler at 0 3 * * *, but live Vercel state is UNKNOWN. [Vercel docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) describe automatic Bearer injection if that provider is actually running the job.

Preferred incident cutover: identify and pause only approved callers, replace validator/current callers, leave CRON_SECRET_PREVIOUS absent, then resume the named owner after verification. Dual-secret capability exists in this deployed source but prolongs exposed authorization; any overlap requires separate risk acceptance/deadline and removal verification. Never invent a caller, disable Vercel by inference, run HTTP cron as a harmless health probe, or invoke an extra --once worker. Authorized cron requests can mutate DB and reach Stripe even with storefront checkout closed.

## Migration / configuration activation trap

Fresh 2026-10-06 Railway config: BOTH staging and production webs have `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`; both workers have no predeploy and start checkout:worker. Config-file selectors are not reported, so effective precedence remains a future gate. Rotation does not authorize migrations or candidate deployment. A plain restart is not evidence that updated stored secrets will load; Railway [deployment actions](https://docs.railway.com/deployments/deployment-actions) preserve original image/config, and rollback restores custom variables. Operator must prove the selected activation mechanism uses approved replacements and cannot run DDL, OR obtain independent migration authorization before any deployment. No unsupported restart shortcut is prescribed.

## Verification / rollback / contingency

Required closure evidence: approved environment/service manifest and independent Phase P authorization; every consumer on a replacement; exposed API keys and old provider signing secrets expired; exposed session/cron secrets absent from all accepting instances/fallbacks; missed webhooks reconciled/deduplicated; synthetic auth/cron-negative checks; preserved schema/volumes/outbox; local copies privately updated or sanitized under approval; credential-free operator timestamps/result references. No secret fingerprint/hash or raw logs in evidence.

Do NOT rollback by restoring compromised values. Railway native rollback can restore those variables: reviewed image rollback must retain the replacements and be reverified, or prefer forward recovery. If activation fails, freeze the affected entry/consumer under explicit emergency authorization, preserve events/jobs and use a new uncompromised replacement or compatible artifact. No automatic restore/reset/reservation release or mail resend. If abuse is suspected, owner urgently escalates to provider/security support through a private legitimate channel; no unauthorized containment is inferred here.

## Legitimate retention / cleanup

No logs, history, artifacts or audit records were deleted. Restrict access/stop sharing raw diagnostics through owner/platform controls, retain a sanitized timeline, and ask the responsible product/account owner about supported retention/deletion mechanisms. No remote deletion API or retention change was exercised; do not claim the conversation or provider records were erased. Targeted local cleanup should verify exact absolute paths, preserve needed non-secret evidence, exclude entire repo/home/user-history directories, and account for backups/sync copies. Revocation comes first; file cleanup alone never contains the credential.

## Production authorization boundary / status

Documentation-only validation 2026-10-06: six incident/release documents have zero credential-shaped hits, zero broken relative file links and balanced Markdown fences; git diff --check passed. npm run release:guard: 6 OK, 1 unchanged legacy Vercel cron warning, 0 FAIL; 43 existing browser bundle files checked. Final current-config exact-match checks are required again before commit. No full E2E/build/dependency audit or provider auth/transaction test was repeated. These checks do not undo tool-record exposure or certify uninspected surfaces.

ROTATED_THIS_CYCLE: NONE. REVOKED_THIS_CYCLE: NONE. REMOVED_THIS_CYCLE: NONE. RAW_VALUES_REPRODUCED_THIS_CYCLE: NO.

PRODUCTION_CREDENTIAL_ROTATION_REQUIRED=YES. STAGING_CREDENTIAL_ROTATION_REQUIRED=YES. AUTHORIZED_PHASE_S=NO. AUTHORIZED_PHASE_P=NO. RELEASE_SECURITY_FREEZE=ACTIVE. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain; no DB query or migration was performed here. Prior code QA remains dated, not rerun.

Security/Railway/storefront guidance influenced safe-output diagnostics, single-secret versus provider-overlap distinctions, credential-preserving recovery and existing-order side-effect boundaries. No runtime/config/dependency/migration file changed. Stop after sanitized docs validation/commit/push.
