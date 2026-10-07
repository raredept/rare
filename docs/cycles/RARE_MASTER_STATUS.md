# RARE — Master Cycle status

```text
CURRENT_PHASE=2
CURRENT_CYCLE=DATABASE_VISIBILITY_AND_RECOVERY
PHASE_RESULT=BLOCKED
RELEASE_SECURITY_FREEZE=ACTIVE
RUNTIME_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84
STAGING_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
MAIN_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
AHEAD=33
BEHIND=0
PR=NONE
STAGING_STATUS=BLOCKED
PRODUCTION_STATUS=NOT_AUTHORIZED
LAST_GATE=PHASE_2_BLOCKED_BY_IDENTITY_LOCATION_AND_BACKUP_PROVIDER
NEXT_GATE=OWNER_IDENTITY_PATH_THEN_READ_ONLY_MIGRATION_METADATA
BASELINE_VERIFIED=YES
STAGING_MIGRATION_HISTORY_VERIFIED=NO
BACKUP_AVAILABLE=NO
BACKUP_PROVIDER_BLOCKER=YES
SSH_IDENTITY_HUMAN_ACTION_REQUIRED=YES
OWNER_PROVIDED_IDENTITY_PATH=NOT_RECEIVED
AUTHORIZED_PERSONAL_PUBLIC_KEY_REGISTRATION=YES_IF_MATCHED_AND_ABSENT
AUDIT_EXECUTION=NOT_EXECUTED_IDENTITY_PATH_REQUIRED
EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED
CREDENTIAL_INCIDENT=P0_ACTIVE
STAGING_CREDENTIALS=COMPROMISED
PRODUCTION_CREDENTIALS=COMPROMISED
PHASE_S_CAN_RESUME=NO
READY_FOR_MERGE=NO
READY_FOR_STAGING=NO
READY_FOR_EXTERNAL_HOMOLOGATION=NO
READY_FOR_PRODUCTION=NO
AUTHORIZED_FOR_PRODUCTION=NO
AUTHORIZED_FOR_PRODUCTION_SECURITY_CHANGE=NO
```

Cycle date: **2026-10-07, America/Sao_Paulo**. New readbacks below are around 08:52–08:53 local / 11:52–11:53 UTC. This file is the canonical current state. Update it in place on future executions; [Master log](RARE_MASTER_LOG.md) records relevant events, and specialized runbooks retain dated evidence and conditional plans. Current authority is the owner's human-assisted Phase 2 instruction, not earlier approval options.

## Baseline / evidence boundary

Entry local and remote release HEAD were both **d1679a55db13902a4a8c7815879caeef93a879c6**, **32 ahead / 0 behind** after fetch --all --prune; branch and main remained unchanged. After this cycle's actual local documentation commit, Git was re-read: **33 ahead / 0 behind**; the top records that verified count, not a forecast. Publication closure verifies local/remote equality after normal push. The runtime candidate remains distinct from documentation and undeployed. Resolve the containing documentation commit with `git log -1 --format=%H -- docs/cycles/RARE_MASTER_STATUS.md`; a document cannot contain its own immutable commit hash. The two unrelated preexisting untracked user files remain preserved/excluded.

BASELINE_VERIFIED=YES means the baseline inventory was reconciled with explicit unknowns and observed failures. It is **not** a database, security, remote CI, runtime-health, homologation or release PASS. No production configuration or runtime was inspected this cycle.

| Check | Current observation / limit |
|---|---|
| GitHub, 2026-10-07 11:51:48 UTC | One exact all-state head/base PR query returned none. No create/retry/merge; prior PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved, not newly retested. |
| Remote CI, historical 2026-10-07 01:57:03 UTC | Candidate 7a820b62… and previous entry documentation 9212d34f… each had pending/0 status contexts, 0 check-runs and 0 general Actions runs. NO_EVIDENCE then, not PASS. No new CI queries or claims for this cycle's documentation HEAD. |
| Required checks / reviews / branch protection | UNKNOWN. No PR boundary; connector lacks administrative branch-protection access. Workflow-configuration endpoint was refused by connector allowlist before a GitHub read; UNKNOWN, not a repository ACL diagnosis. No alternate token/authentication route used. |
| Railway CLI target, 2026-10-07T11:52:06.171Z | Explicit Rare project / staging environment / Postgres-MlyZ service matched. Four deployment IDs unchanged / SUCCESS; no SSH runtime target, application-health or commerce proof. |
| Staging web and worker, 2026-10-07T11:52:06.171Z | Both deployed source SHAs remain 4ea73f50cafdbf67e16dc71de985052075feca42. Candidate not deployed. Earlier service-variable classifications below are historical, not refreshed or runtime enforcement. |
| Volume metadata, historical | Previous Master Cycle refresh returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR. No volume metadata query this cycle; attachment/capacity/usage/region remain dated, not independently refreshed. |
| Backup inventory, 2026-10-07T11:53:30.918Z | One read-only exact known volume-instance query returned **0 snapshots / 0 schedules**; no late snapshot. Two create attempts cumulative, no third creation request. |
| Credential incident | All four affected categories in staging AND production remain COMPROMISED until rotation/revocation is proved. Presence or TEST classification does not close compromise. Rotation/revocation not executed. |

## Phase 2 — entry, work, gate, exit

**Entry / current authorization:** the owner partially resolved the human gate: use the legitimate owner-provided personal private identity solely for staging metadata READ ONLY. If its matching public key is absent, register **only that .pub in PERSONAL scope**; remove only that audit-only registration afterward, respecting 2FA. This permission is already granted; another generic approval is not required. No identity generation/private-content read or output, helper/AV bypass, GitHub arbitrary import, workspace key, backup/restore, rotation, deploy/redeploy/restart/migration or production action. Backup support remains owner-led and separate. Phase 3/4/5 are not started.

**Work performed:** Git/one PR readback, permitted local key-name/default-path and agent inspection, official personal Railway-key listing, installed CLI help verification for explicit identity/personal registration/2FA cleanup, explicit staging target/source readback, all 14 canonical references checked and one backup listing. No new GitHub-key discovery or configuration-classification/selector refresh; staging credential values were privately used only as secret-scan needles, never emitted. The old helper orchestration is not reused; no helper/executable/new key created. Current blocker is a missing **identity location**, not missing authorization or proof that the owner has no key.

**Gate / actual result:** **BLOCKED**. The owner asserts an identity was supplied, but no path or approved loaded agent was identifiable in this request/permitted scope. Stop registration/SSH/SQL before mutation; do not search unrelated drives/private content or reuse old task-generated temporary keys. Trustworthy history remains UNKNOWN and recovery unavailable; any future alternative recovery remains a separate explicit decision. Next-deploy config remains independently NOT VERIFIED.

**Exit:** document, validate, commit/push these safe docs, verify equality and STOP at the human gate. Remain in Phase 2. Phase 1 security containment is blocked by these prerequisites; Phase 3–13 are NOT ADVANCED. No full suite, E2E, clean build or dependency upgrade is required for documentation-only changes.

### SSH / endpoint security

| Evidence | Result |
|---|---|
| Owner-provided identity location | NOT RECEIVED / NOT IDENTIFIED. Path, algorithm, fingerprint and corresponding .pub registration status UNKNOWN. This does not contradict the owner's assertion that a legitimate identity exists elsewhere. |
| Local permitted inventory, 2026-10-07T11:52:01.284Z | One non-key metadata file, body not read; 0 .pub/private key-name candidates. Native defaults (`-G -F NUL`), 7 default paths/0 private files; no custom config read, unrelated-drive/temp-key search or private-content read. |
| Approved agents | ssh-add exit 2 / agent unavailable; key count UNKNOWN, not a successfully queried empty inventory. Native agent STOPPED/not started, Pageant absent, SSH_AUTH_SOCK absent. |
| Official personal railway ssh keys list, 2026-10-07T11:52:03.381Z | Exit 0 / verified EMPTY; no workspace scope or workspace-token environment, no public-key body printed. Matching key cannot be assessed without the owner's .pub. |
| Native official CLI 5.26.0 | ssh --identity-file/-i is supported; explicit project/environment/service required. keys add --key/--name supports .pub; no --workspace. keys remove can require --2fa-code; no bypass. No SSH command/registration/removal executed. |
| Linked GitHub metadata | UNKNOWN from the previous cycle's error, not freshly queried. Not the selected owner-provided-.pub route; no arbitrary import or authentication workaround. |
| Actual access / key operations | SSH_PATH=BLOCKED; SSH/SQL/import/register/create/copy/move/delete=NO. Existing identities untouched; key cleanup NOT APPLICABLE. No network SSH, host pin or transaction established. |
| Endpoint security | Historical helper remains QUARANTINED / ABANDONED; trust UNKNOWN. No restore/trust/recompile/rename/repackage/new helper, unencrypted key, protection disablement or exclusion. No general McAfee block of official SSH is established; official remote SSH runtime remains untested. |

### Database / recovery

Intended target: project **72ed12be-9a2a-4e13-8594-30ffd8ffa565**, staging **d8399691-dacf-41e9-a9d5-060c97672e39**, PostgreSQL **ed0a374e-79da-4aab-9e3a-bb684fb829d1**. Known volume **a0b78a5e-0dec-40ab-9d8c-c298be29ca5d**, instance **c5910985-a38a-479b-9274-e65ec6753c77**; historical SSH service-instance binding and recovery metadata are in the [database runbook](../security/STAGING_DATABASE_GATE.md). Reverify every binding immediately before any future authorized access or mutation; no production/default target permitted.

Repository inventory reconfirmed: **14 migrations** at deployed Git SHA 4ea73f50cafdbf67e16dc71de985052075feca42. The [canonical checksum reference](../security/STAGING_DATABASE_GATE.md#database-history--checksum-reference) uses Git blobs and Prisma LF/CRLF equivalence, not blind Windows worktree bytes.

```text
POSTGRESQL_VERSION=UNKNOWN
APPLIED=UNKNOWN
PENDING=UNKNOWN
FAILED=UNKNOWN
ROLLED_BACK=UNKNOWN
CHECKSUM_MISMATCH=UNKNOWN
MIGRATION_HISTORY_CLEAN=UNKNOWN
MIGRATE_DEPLOY_EXPECTED_NOOP=UNKNOWN
PHASE_M_REQUIRED=UNKNOWN
P0_MIGRATION_INTEGRITY_BLOCKER=UNKNOWN
RESTORE_DRILL_VERIFIED=NO
BACKUP_CREATE_ATTEMPTS_CUMULATIVE=2
THIRD_BACKUP_ATTEMPT=NO
BACKUP_ATTEMPT_TRACE_IDS=NOT AVAILABLE
```

All 14 database migration states are UNKNOWN, explicitly including **20260907150000_admin_temporary_password** (DDL + seed DML), **20260920120000_analytics_paid_at_index** and **20260921120000_session_version**. No corruption or clean/no-op outcome is inferred. No SQL or business rows/logs were queried; READ ONLY enforcement and ROLLBACK were not executed because no session existed.

Future approved SQL: BEGIN READ ONLY first; local statement_timeout 5000ms / lock_timeout 2000ms; verify transaction_read_only=on; server version and only migration_name, checksum, started_at, finished_at, rolled_back_at; allowlisted schema catalogs **only if a history inconsistency requires it**; ROLLBACK and confirm closure. The old key-generating helper orchestration/unconditional schema collection/classifier must not be reused as-is. Failed/partial/inconsistent history or genuine checksum mismatch is a P0 stop, not permission to repair or a pending-first migration decision.

The [Railway support handoff](../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains **READY DRAFT; OWNER_HANDLES_EXTERNALLY**. No support message/ticket was sent by Codex, and no owner ticket result/reference was supplied here. The two historical HTTP 200 / INTERNAL_SERVER_ERROR create attempts remain unresolved; new inventory is 0/0. Workflow/cause/cost/recoverability UNKNOWN. No backup/restore/schedule/PITR/dump/resize performed. Earlier read-query trace IDs are not historical backup-attempt trace IDs.

### Closed staging / providers

Historical configuration observation at **2026-10-07T01:57:45.893Z**, not refreshed by this identity-only cycle, comparing to closed-bootstrap expectations. **MATCH/DIFFERENT/MISSING do not prove current runtime enforcement or authorize a fix.** No feature/provider call was made.

| Expected configuration / classification | Web | Worker |
|---|---|---|
| APP_ENV=staging | MATCH | MATCH |
| CHECKOUT_ENABLED=false | DIFFERENT | MATCH |
| SHIPPING_ENABLED=false | DIFFERENT | MATCH |
| EMAIL_DRIVER=disabled | DIFFERENT | DIFFERENT |
| STORAGE_DRIVER=r2 expectation | DIFFERENT | MISSING |
| Stripe API mode | TEST | TEST |
| Stripe API credential presence | PRESENT | PRESENT |
| Webhook / session / cron credential presence | PRESENT / PRESENT / PRESENT | MISSING / MISSING / MISSING |

Missing categories on worker are configuration observations, **not** proof that every category is a required worker consumer. Persistent storage, email sendability, checkout/shipping behavior, worker queue/outbox effects and consumer/caller mapping remain unverified. No row/backlog/PII access or commercial activation occurred; existing independent runtime activity was not paused or audited. COMMERCE_CLOSED=NOT VERIFIED; required closed-bootstrap configuration is not yet matched across both services.

Stripe Card TEST / PIX / webhook / Melhor Envio Sandbox / email delivery / storage persistence / cron ownership and monitoring homologation remain **PENDING / NOT VERIFIED**. No TEST payment, LIVE charge, quote/label, real email, media upload or provider configuration change. Current Stripe presence is TEST, not homologation. Installments remain a future product decision, not implementation scope.

### Gate ledger / blockers

| Gate | Current state / reason |
|---|---|
| BASELINE | VERIFIED inventory with explicit limitations, not release PASS |
| SECURITY / Phase 1 | BLOCKED; P0 incident open, credentials COMPROMISED, no rotation/revocation |
| DATABASE / Phase 2 | BLOCKED; identity and trustworthy history unavailable; no recovery |
| PR / Phase 3 | BLOCKED / NOT ADVANCED; PR NONE, CI NO_EVIDENCE, required gates UNKNOWN |
| STAGING / Phase 5 | BLOCKED; candidate not deployed; closed expectations DIFFERENT/MISSING; next config NOT VERIFIED |
| HOMOLOGATION / Phases 6–7 | NOT EXECUTED externally |
| PRODUCTION / Phases 9–13 | NOT AUTHORIZED / NOT EXECUTED |

P0: compromised staging/production credentials; freeze active. Migration integrity UNKNOWN, not an established corruption incident. P1: **owner identity path/approved agent not identified**, backup provider failure, unknown history/next config, unverified closed bootstrap and candidate/homologation/PR gates. P2: historical legacy Vercel-cron warning and dependency UPSTREAM_WAIT, not fresh audit results. No dependency modernization or full audit.

## HUMAN AUTHORIZATION REQUIRED

**Current phase:** 2 — DATABASE_VISIBILITY_AND_RECOVERY. **Reason:** the authorized owner identity is not located: neither its private/public paths nor a usable approved agent were identified. Authorization for the limited audit and necessary personal .pub registration is **already granted**; the next requirement is exact missing location/access information, not renewed generic approval.

**Exact mutation:** none performed. Once the owner identifies the existing private/.pub pair, verify metadata and registration first; only if absent, the already authorized mutation is **one matching public-key registration PERSONAL**, named rare-staging-db-audit, with audit-only cleanup. No key generation or copy/move/delete of the owner's private file, workspace key, helper or automatic agent-service change.

**Environment/resources:** exact Rare/staging/Postgres-MlyZ identifiers above; necessary registration affects the owner's personal Railway SSH inventory, never workspace scope or production. Support is handled separately by the owner; Codex is not authorized to send it here.

**Expected side effects/downtime:** personal public-key registration changes access; subsequent audit opens one bounded metadata transaction. No service restart/deploy or planned downtime. An encrypted identity may require a legitimate owner-operated native prompt/approved agent; never passphrase automation or plaintext collection in chat.

**Security/database/provider impact:** authorized public-key lifecycle only after matching owner identity is known; no DB writes/business-data extraction, provider transactions/backup/restore or production changes. Endpoint protection unchanged. Never paste a key body, passphrase or credential into chat.

**Rollback:** preserve all preexisting identities; remove only a newly added audit-only matching-public-key registration afterward with verified personal ownership and available 2FA. Do not bypass 2FA. End any future SQL session with ROLLBACK. Do not restore compromised credentials or quarantined helper. If access cleanup cannot be verified, document and request owner action.

**Abort conditions:** wrong project/environment/service/scope, unavailable identity/2FA, AV prompt requiring bypass, secret output risk, unverified SSH target/host identity, READ ONLY not on, timeout/ambiguous outcome, unexpected LIVE credential, failed/inconsistent migrations/checksum mismatch, unknown migration/deploy effect or any production/provider-cost action.

OPTIONS:

- **A — Identify supplied files:** provide only the absolute private-identity path and matching .pub path. Do not paste contents or passphrase. Continue under the existing narrow audit/registration authorization once verified.
- **B — Identify supplied agent:** specify the already approved usable agent and public-key fingerprint; owner handles native unlock/agent access if needed. No automatic service change or helper. This does not generate a new identity.
- **C — Separate provider handoff:** owner handles Railway diagnosis externally and may provide a sanitized ticket/result reference; no Codex message, third backup or recovery alternative. This alone does not resolve identity location.
- **D — Hold:** keep freeze active, no mutation and no automatic retry/monitoring. Resume Phase 2 only with a new concrete owner identity/provider decision.

A/B identify the already authorized identity route; C is independent and owner-led. Stop here until the missing identity location is provided; Phase 2 remains unmet.

## Validation / publication

Current documentation-only checks: **git diff --check and staged --check PASS; release:guard 6 OK / 1 legacy Vercel-cron WARNING / 0 FAIL**. Eight scoped documents plus working/staged diffs: **0 exact configured-secret hits / 0 credential-pattern hits; 81 relative links / 0 broken; 0 unbalanced fences; 14 canonical checksum references / 0 incorrect; canonical status/Git counts match**. Private needle comparison covered four affected staging credential categories, database URL/password and current Railway authentication; no values printed or production read. Read-only documentation review completed; only six scoped docs staged. Final normal-push equality is verified at publication closure, not inferred from these scans.

No full E2E/application suite or new dependency audit. Railway guidance verified explicit native identity flags/personal scope/cleanup and target readbacks; Postgres guidance kept SQL deferred/bounded/read-only and schema collection conditional. Neither skill substitutes for identity location or actual database evidence.
