# RARE — Master Cycle status

```text
CURRENT_PHASE=2
CURRENT_CYCLE=DATABASE_VISIBILITY_AND_RECOVERY
PHASE_RESULT=BLOCKED
RELEASE_SECURITY_FREEZE=ACTIVE
RUNTIME_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84
STAGING_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
MAIN_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
AHEAD=34
BEHIND=0
PR=NONE
STAGING_STATUS=BLOCKED
PRODUCTION_STATUS=NOT_AUTHORIZED
LAST_GATE=PHASE_2_BLOCKED_BY_NATIVE_KEY_INTERACTION_AND_BACKUP_PROVIDER
NEXT_GATE=OWNER_NATIVE_KEY_VERIFICATION_AND_USABLE_IDENTITY
BASELINE_VERIFIED=YES
STAGING_MIGRATION_HISTORY_VERIFIED=NO
BACKUP_AVAILABLE=NO
BACKUP_PROVIDER_BLOCKER=YES
SSH_IDENTITY_HUMAN_ACTION_REQUIRED=YES
OWNER_PROVIDED_IDENTITY_PATH=VERIFIED
SSH_IDENTITY_PATH_INVALID=NO
SSH_KEY_PAIR_METADATA_MATCH=YES
SSH_KEY_PAIR_CRYPTOGRAPHIC_VERIFIED=NO
SSH_KEY_ENCRYPTION_STATUS=UNKNOWN
SSH_PASSPHRASE_INTERACTION_REQUIRED=YES
OWNER_NATIVE_INTERACTION_REQUIRED=YES
AUTHORIZED_PERSONAL_PUBLIC_KEY_REGISTRATION=YES_IF_MATCHED_AND_ABSENT
AUDIT_EXECUTION=NOT_EXECUTED_NATIVE_KEY_VERIFICATION_REQUIRED
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

Cycle date: **2026-10-07, America/Sao_Paulo**. Current resume checks are around 10:24–10:25 local / 13:24–13:25 UTC; older provider observations are explicitly historical. This file is the canonical current state. Update it in place on future executions; [Master log](RARE_MASTER_LOG.md) records relevant events, and specialized runbooks retain dated evidence and conditional plans. Current authority is the owner's Phase 2 resume instruction with exact existing identity paths, not earlier approval options.

## Baseline / evidence boundary

Entry local and remote release HEAD were both **fc69d2e2d2da0a54bc3fbea6ec576d9ca19fb740**, **33 ahead / 0 behind** after fetch --all --prune; branch and main remained unchanged. After this resume's actual local documentation commit, Git was re-read: **34 ahead / 0 behind**; the top reflects that verified count, not a prediction. Verify local/remote equality after normal push. The runtime candidate remains distinct from documentation; no runtime deployment occurred here. Resolve the containing documentation commit with `git log -1 --format=%H -- docs/cycles/RARE_MASTER_STATUS.md`; a document cannot contain its own immutable commit hash. The two unrelated preexisting untracked user files remain preserved/excluded.

BASELINE_VERIFIED=YES means the baseline inventory was reconciled with explicit unknowns and observed failures. It is **not** a database, security, remote CI, runtime-health, homologation or release PASS. No production configuration or runtime was inspected this cycle.

| Check | Current observation / limit |
|---|---|
| GitHub, 2026-10-07 13:24:00 UTC | One exact all-state head/base PR query returned none. No create/retry/merge; prior PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved, not newly retested. |
| Remote CI, historical 2026-10-07 01:57:03 UTC | Candidate 7a820b62… and previous entry documentation 9212d34f… each had pending/0 status contexts, 0 check-runs and 0 general Actions runs. NO_EVIDENCE then, not PASS. No new CI queries or claims for this cycle's documentation HEAD. |
| Required checks / reviews / branch protection | UNKNOWN. No PR boundary; connector lacks administrative branch-protection access. Workflow-configuration endpoint was refused by connector allowlist before a GitHub read; UNKNOWN, not a repository ACL diagnosis. No alternate token/authentication route used. |
| Railway CLI target, historical 2026-10-07T11:52:06.171Z | Explicit Rare project / staging environment / Postgres-MlyZ service matched then. No target/provider readback this resume before the native-interaction stop; SSH runtime never verified. |
| Staging web and worker, historical 2026-10-07T11:52:06.171Z | Both deployed source SHAs were 4ea73f50cafdbf67e16dc71de985052075feca42; top STAGING_SHA is this last observed source, not a fresh runtime verification. No deployment here. Stored-variable classifications below remain historical. |
| Volume metadata, historical | Previous Master Cycle refresh returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR. No volume metadata query this cycle; attachment/capacity/usage/region remain dated, not independently refreshed. |
| Backup inventory, historical 2026-10-07T11:53:30.918Z | Last verified listing: **0 snapshots / 0 schedules**, no late snapshot then. Not refreshed after this resume's native-interaction stop. No verified checkpoint; two create attempts cumulative, no third request. |
| Credential incident | All four affected categories in staging AND production remain COMPROMISED until rotation/revocation is proved. Presence or TEST classification does not close compromise. Rotation/revocation not executed. |

## Phase 2 — entry, work, gate, exit

**Entry / current authorization:** the owner resolved the missing-location gate by supplying the existing private identity **%USERPROFILE%/.ssh/rare_staging_db_audit_20261007** and matching **.pub**. Use only this identity for staging metadata READ ONLY. If its corresponding public key is absent, register **only that .pub in PERSONAL scope**, suggested name rare-staging-db-audit-20261007; remove only a newly added audit-only registration afterward, respecting 2FA. Permission is already granted, but pair/usability verification must precede registration/SSH. No new identity/private-material output or copy, helper/AV bypass, arbitrary import, workspace key, backup/restore, rotation, deploy/redeploy/restart/migration or production action. Backup support remains owner-led/separate; no Phase 3/4/5.

**Work performed:** Git/one PR readback, exact supplied-file metadata, native OpenSSH fingerprint verification, one bounded public derivation attempt captured only in memory, native agent availability and all 14 canonical references. Both files exist/outside repository/not reparse points; `.ssh` directory is not within a discovered Git repository. Metadata fingerprints MATCH / ED25519 256. Derivation timed out without a verifiable result; native agent unavailable. No registration/inventory/SSH/target/backup/config readback after that stop. Staging values may be used privately only as documentation-secret-scan needles, never emitted. No old helper/orchestrator/new executable/key; no private body or unnecessary public-key body printed.

**Gate / actual result:** **BLOCKED** at **native key interaction / cryptographic verification**, no longer missing paths. Matching fingerprints do not prove successful private-key decryption/use. Derivation timeout is not a mismatch, invalid-key, corruption, wrong-passphrase or confirmed-encryption finding. Encryption/passphrase state and cryptographic pair/usability remain UNKNOWN. **SSH_PASSPHRASE_INTERACTION_REQUIRED=YES** records the need for a legitimate owner-operated native interaction, not a captured passphrase prompt. Native agent is unavailable; do not collect/store/automate a passphrase or bypass this stop. No Railway registration/SSH/SQL; history UNKNOWN, recovery unavailable, next-deploy config independently NOT VERIFIED.

**Exit:** document, validate, commit/push these safe docs, verify equality and STOP at the human gate. Remain in Phase 2. Phase 1 security containment is blocked by these prerequisites; Phase 3–13 are NOT ADVANCED. No full suite, E2E, clean build or dependency upgrade is required for documentation-only changes.

### SSH / endpoint security

| Evidence | Result |
|---|---|
| Owner-provided identity location | VERIFIED: supplied private/.pub paths exist outside E:/rare, no reparse points, `.ssh` outside discovered Git repository. Existing owner files unchanged. |
| Native ssh-keygen -l metadata, 2026-10-07T13:24:47.199Z | Private/public metadata: **ED25519, 256 bits; SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw**, same fingerprint. No comment/body output. |
| Native ssh-keygen -y attempt, 2026-10-07T13:25:26.656Z | 8-second bounded attempt, no interactive stdin/custom askpass; timeout / no successful derivation / no secret output. Cryptographic pair and encryption/passphrase state UNKNOWN; not SSH_KEY_PAIR_MISMATCH. |
| Native agent, same check | ssh-add -l exit 2 / unavailable; key count and matching loaded-key availability UNKNOWN, not an empty-agent proof. No agent/service change. |
| Official personal railway ssh keys list, historical 2026-10-07T11:52:03.381Z | Exit 0 / EMPTY then; not refreshed this resume after the native-interaction stop. Corresponding current registration UNKNOWN; key added by this cycle NO. |
| Native official CLI 5.26.0, previously verified help | Explicit ssh --identity-file/-i supported; personal keys add --key/--name, no --workspace; remove may require 2FA. No SSH/registration/removal executed this resume. |
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

The [Railway support handoff](../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains **READY DRAFT; OWNER_HANDLES_EXTERNALLY**. No support message/ticket was sent by Codex, and no owner ticket result/reference was supplied here. The two historical HTTP 200 / INTERNAL_SERVER_ERROR create attempts remain unresolved; last verified inventory is 0/0 at **11:53:30.918Z**, not refreshed this resume. Workflow/cause/cost/recoverability UNKNOWN. No backup/restore/schedule/PITR/dump/resize performed. Earlier read-query trace IDs are not historical backup-attempt trace IDs.

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
| DATABASE / Phase 2 | BLOCKED; identity paths verified but cryptographic usability/native interaction unresolved; history UNKNOWN; no recovery |
| PR / Phase 3 | BLOCKED / NOT ADVANCED; PR NONE, CI NO_EVIDENCE, required gates UNKNOWN |
| STAGING / Phase 5 | BLOCKED; candidate not deployed; closed expectations DIFFERENT/MISSING; next config NOT VERIFIED |
| HOMOLOGATION / Phases 6–7 | NOT EXECUTED externally |
| PRODUCTION / Phases 9–13 | NOT AUTHORIZED / NOT EXECUTED |

P0: compromised staging/production credentials; freeze active. Migration integrity UNKNOWN, not an established corruption incident. P1: **owner native key verification/use interaction required**, backup provider failure, unknown history/next config, unverified closed bootstrap and candidate/homologation/PR gates. P2: historical legacy Vercel-cron warning and dependency UPSTREAM_WAIT, not fresh audit results. No dependency modernization or full audit.

## HUMAN AUTHORIZATION REQUIRED

**Current phase:** 2 — DATABASE_VISIBILITY_AND_RECOVERY. **Reason:** identity paths are now valid and metadata fingerprints match, but cryptographic verification/use did not complete; native interaction is required and agent unavailable. Authorization for this identity's limited audit and necessary personal .pub registration is **already granted**; the next requirement is native owner interaction/usability verification, not another path or renewed generic approval.

**Exact mutation:** none performed. Once the existing identity's cryptographic pair/use is verified legitimately, check personal registration; only if absent, the already authorized mutation is **one matching public-key registration PERSONAL**, named rare-staging-db-audit-20261007, with audit-only cleanup. No generation or copy/move/delete of the owner's private file, workspace key, helper or automatic agent-service change.

**Environment/resources:** exact Rare/staging/Postgres-MlyZ identifiers above; necessary registration affects the owner's personal Railway SSH inventory, never workspace scope or production. Support is handled separately by the owner; Codex is not authorized to send it here.

**Expected side effects/downtime:** personal public-key registration changes access; subsequent audit opens one bounded metadata transaction. No service restart/deploy or planned downtime. An encrypted identity may require a legitimate owner-operated native prompt/approved agent; never passphrase automation or plaintext collection in chat.

**Security/database/provider impact:** authorized public-key lifecycle only after matching owner identity is known; no DB writes/business-data extraction, provider transactions/backup/restore or production changes. Endpoint protection unchanged. Never paste a key body, passphrase or credential into chat.

**Rollback:** preserve all preexisting identities; remove only a newly added audit-only matching-public-key registration afterward with verified personal ownership and available 2FA. Do not bypass 2FA. End any future SQL session with ROLLBACK. Do not restore compromised credentials or quarantined helper. If access cleanup cannot be verified, document and request owner action.

**Abort conditions:** wrong project/environment/service/scope, unavailable identity/2FA, AV prompt requiring bypass, secret output risk, unverified SSH target/host identity, READ ONLY not on, timeout/ambiguous outcome, unexpected LIVE credential, failed/inconsistent migrations/checksum mismatch, unknown migration/deploy effect or any production/provider-cost action.

OPTIONS:

- **A — Native verification/unlock:** owner completes official OpenSSH pair verification in a legitimate native terminal; if a passphrase is requested, enter it only there. Supply only sanitized result/fingerprint, never passphrase/key body. This alone does not prove usable authentication within Codex.
- **B — Approved native access:** owner provides an already usable approved agent/native interaction for the same identity, then pair/usability and registration are revalidated under existing permission. No automatic service change, helper or new identity by Codex.
- **C — Separate provider handoff:** owner handles Railway diagnosis externally and may provide a sanitized ticket/result reference; no Codex message, third backup or recovery alternative. This alone does not resolve native key verification/usability.
- **D — Hold:** keep freeze active, no mutation and no automatic retry/monitoring. Resume Phase 2 only with a new concrete owner identity/provider decision.

A/B resolve native verification/use of the already authorized identity; C is independent and owner-led. Stop here until legitimate native interaction/usability is available; Phase 2 remains unmet. Do not send passphrase or key body to this chat.

## Validation / publication

This resume's checks: **git diff --check and staged --check PASS; release:guard 6 OK / 1 legacy Vercel-cron WARNING / 0 FAIL**. Eight scoped docs/current diffs: **0 exact configured-secret hits / 0 credential-pattern hits; 81 relative links / 0 broken; 0 unbalanced fences; 14 canonical references / 0 incorrect; canonical state/Git counts match**. Additional five-doc/current/branch-diff scan: **0 exact supplied-public-body hits / 0 public-key-body patterns**; private material not read by the scanner, bodies never printed. Staging credential values/authentication used privately only as validation needles, no production read. Read-only documentation review completed; only five requested canonical docs staged; backup/support handoff unchanged. Final normal-push equality is verified at closure, not inferred from scans.

No full E2E/application suite/build or new dependency audit. Railway guidance kept official identity/personal-scope/readback boundaries and no authentication workaround; Postgres guidance kept SQL deferred/bounded/read-only and schema collection conditional. Neither skill substitutes for actual native usability, database or recovery evidence.
