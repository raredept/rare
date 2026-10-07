# RARE — Master Cycle status

```text
CURRENT_PHASE=2
CURRENT_CYCLE=DATABASE_VISIBILITY_AND_RECOVERY
PHASE_RESULT=BLOCKED
RELEASE_SECURITY_FREEZE=ACTIVE
RUNTIME_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84
STAGING_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
MAIN_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
AHEAD=35
BEHIND=0
PR=NONE
STAGING_STATUS=BLOCKED
PRODUCTION_STATUS=NOT_AUTHORIZED
LAST_GATE=PHASE_2_BLOCKED_BY_SSH_TIMEOUT_AND_BACKUP_PROVIDER
NEXT_GATE=OWNER_OFFICIAL_SSH_ACCESS_DIAGNOSIS
BASELINE_VERIFIED=YES
STAGING_MIGRATION_HISTORY_VERIFIED=NO
BACKUP_AVAILABLE=NO
BACKUP_PROVIDER_BLOCKER=YES
SSH_IDENTITY_HUMAN_ACTION_REQUIRED=NO
SSH_ACCESS_HUMAN_ACTION_REQUIRED=YES
SSH_AGENT=AVAILABLE
SSH_AGENT_EXPECTED_FINGERPRINT=MATCH
OWNER_PROVIDED_IDENTITY_PATH=VERIFIED
SSH_IDENTITY_PATH_INVALID=NO
SSH_KEY_PAIR_METADATA_MATCH=YES
SSH_KEY_PAIR_CRYPTOGRAPHIC_VERIFIED=NO
SSH_KEY_ENCRYPTION_STATUS=UNKNOWN
SSH_PASSPHRASE_INTERACTION_REQUIRED=NO_OBSERVED_PROMPT
OWNER_NATIVE_INTERACTION_REQUIRED=NO
AUTHORIZED_PERSONAL_PUBLIC_KEY_REGISTRATION=YES_IF_MATCHED_AND_ABSENT
SSH_KEY_REGISTRATION=TEMPORARY
SSH_KEY_SCOPE=PERSONAL
SSH_KEY_CLEANUP=VERIFIED_REMOVED
SSH_KEY_REMOVAL_REQUIRES_HUMAN_2FA=NO
SSH_ATTEMPTED=YES
SSH_RUNTIME_TARGET_VERIFIED=NO
AUDIT_EXECUTION=NOT_EXECUTED_SSH_RUNTIME_TARGET_NOT_VERIFIED
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

Cycle date: **2026-10-07, America/Sao_Paulo**. Current agent/access checks are around 10:46–10:57 local / 13:46–13:57 UTC; older observations are explicitly historical. This file is the canonical current state. Update it in place on future executions; [Master log](RARE_MASTER_LOG.md) records relevant events, and specialized runbooks retain dated evidence and conditional plans. Current authority is the owner's SSH-agent-ready Phase 2 instruction, not earlier approval options.

## Baseline / evidence boundary

Entry local and remote release HEAD were both **192fa74ba1535648c68d50254959921b4896ff3d**, **34 ahead / 0 behind** after fetch --all --prune; branch and main remained unchanged. After this cycle's actual local documentation commit, Git was re-read: **35 ahead / 0 behind**. The top records that verified count within the same unpublished documentation commit, not a prediction. Verify local/remote equality after normal push. The runtime candidate remains distinct from documentation; no runtime deployment occurred here. Resolve the containing documentation commit with `git log -1 --format=%H -- docs/cycles/RARE_MASTER_STATUS.md`; a document cannot contain its own immutable commit hash. The two unrelated preexisting untracked user files remain preserved/excluded.

BASELINE_VERIFIED=YES means the baseline inventory was reconciled with explicit unknowns and observed failures. It is **not** a database, security, remote CI, runtime-health, homologation or release PASS. No production configuration or runtime was inspected this cycle.

| Check | Current observation / limit |
|---|---|
| GitHub, 2026-10-07 13:47:33 UTC | One exact all-state head/base PR query returned none. No create/retry/merge; prior PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved, not newly retested. |
| Remote CI, historical 2026-10-07 01:57:03 UTC | Candidate 7a820b62… and previous entry documentation 9212d34f… each had pending/0 status contexts, 0 check-runs and 0 general Actions runs. NO_EVIDENCE then, not PASS. No new CI queries or claims for this cycle's documentation HEAD. |
| Required checks / reviews / branch protection | UNKNOWN. No PR boundary; connector lacks administrative branch-protection access. Workflow-configuration endpoint was refused by connector allowlist before a GitHub read; UNKNOWN, not a repository ACL diagnosis. No alternate token/authentication route used. |
| Railway CLI target, 2026-10-07T13:50:29.234Z | Explicit Rare project / staging environment / Postgres-MlyZ IDs and names matched in control-plane. Normal official SSH attempted with all three IDs; runtime verification did not return before timeout. No SQL. |
| Staging web and worker, 2026-10-07T13:50:29.234Z | Both deployed source SHAs are 4ea73f50cafdbf67e16dc71de985052075feca42; four latest deployment IDs remain unchanged/SUCCESS. Source/control-plane observation, not SSH runtime or application-health proof. No deployment here. Stored-variable classifications below remain historical. |
| Volume metadata, historical | Previous Master Cycle refresh returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR. No volume metadata query this cycle; attachment/capacity/usage/region remain dated, not independently refreshed. |
| Backup inventory, 2026-10-07T13:59:32.490Z | One read-only listing: **0 snapshots / 0 schedules**, no late snapshot visible. No verified recovery checkpoint; two create attempts cumulative, no third request. |
| Credential incident | All four affected categories in staging AND production remain COMPROMISED until rotation/revocation is proved. Presence or TEST classification does not close compromise. Rotation/revocation not executed. |

## Phase 2 — entry, work, gate, exit

**Entry / current authorization:** the owner manually unlocked the existing identity **%USERPROFILE%/.ssh/rare_staging_db_audit_20261007** into Windows OpenSSH Agent without sharing its passphrase. Verify the loaded ED25519 fingerprint, use only its matching **.pub in PERSONAL scope** if absent, then normal official SSH to exact staging IDs; remove only a newly added audit registration afterward, respecting 2FA. No forced private-file mode, new identity/private-material output or copy, helper/AV bypass, arbitrary import, workspace key, backup/restore, rotation, deploy/redeploy/restart/migration or production action. Backup support remains owner-led/separate; no later phase.

**Work performed:** Git/one PR readback, native `ssh-add -l` availability/fingerprint, supplied-file/public-key metadata, personal Railway inventory/registration/readback, exact control-plane target and 14 canonical references. Agent AVAILABLE: one loaded ED25519 identity MATCH. Both existing files remain outside repository/not reparse points; no private derivation or passphrase interaction attempted this cycle. Personal inventory 0→1→0; normal official SSH runtime-only check timed out, scoped native child terminated, new registration removed and absence verified. No SQL or config readback. Staging values may be used privately only as documentation-secret-scan needles, never emitted. No old helper/orchestrator/new executable/key; no private/public body printed.

**Gate / actual result:** **BLOCKED — SSH_ATTEMPT_TIMEOUT / SSH_RUNTIME_TARGET_NOT_VERIFIED**. The previous unavailable-agent gate is resolved; remote authentication/runtime are not proved. The local CLI timeout did not close its native SSH child, so only that positively scoped audit child was stopped at 13:56:20 UTC; no retry or SQL. Timeout is not proof of a wrong passphrase, invalid key, host mismatch, McAfee/network/provider cause or cryptographic pair failure. No passphrase prompt was observed/handled; private-file encryption and remote key use remain unverified. History UNKNOWN, recovery unavailable, next-deploy config independently NOT VERIFIED.

**Exit:** authorized personal-key cleanup completed; document, validate, commit/push these safe docs, verify equality and STOP at the official-access human gate. Remain in Phase 2. Phase 1 security containment is blocked by these prerequisites; Phase 3–13 are NOT ADVANCED. No full suite, E2E, clean build or dependency upgrade is required for documentation-only changes.

### SSH / endpoint security

| Evidence | Result |
|---|---|
| Owner-provided identity location | VERIFIED: supplied private/.pub paths exist outside E:/rare, no reparse points, `.ssh` outside discovered Git repository. Existing owner files unchanged. |
| Native agent, 2026-10-07T13:46:32.618Z | Native ssh-add -l exit 0: AVAILABLE, 1 identity, ED25519 **SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw** MATCH. No comment/body output or agent/service change. |
| Existing files/public metadata, 2026-10-07T13:49:26.581Z | Private/public exist outside repository, no reparse points; public native fingerprint MATCH / ED25519. No key generation, private derivation, copy or edit. Earlier derivation timeout is historical, not this cycle. |
| Personal CLI auth/inventory, 13:49:27.659–13:49:29.511 UTC | Existing personal login authenticated; token environment overrides absent. Registered inventory verified 0, expected key absent. No workspace selected. |
| Authorized registration, 2026-10-07T13:51:18.162Z | Only supplied .pub added PERSONAL as rare-staging-db-audit-20261007; 0→1 readback MATCH. Private key not transmitted. |
| Official normal SSH / scoped close, 13:52:06–13:56:20 UTC | Explicit project/environment/service; no caller-forced -i, tunnel, session or helper. Runtime-only check timed out; only the verified audit native SSH child was terminated. No runtime marker/psql proof or SQL. |
| Official cleanup, 13:57:11.794–13:57:14.714 UTC | Newly registered fingerprint removed PERSONAL, exit 0; readback **No SSH keys registered**, expected fingerprint absent. 1→0 verified; no 2FA needed. Owner files and loaded agent unchanged. |
| Linked GitHub metadata | UNKNOWN from the previous cycle's error, not freshly queried. Not the selected owner-provided-.pub route; no arbitrary import or authentication workaround. |
| Actual access / key operations | SSH_PATH=BLOCKED; SSH_ATTEMPTED=YES / SQL=NO / personal register+remove=YES. Import/create/copy/move/local delete=NO. Owner identities untouched; cleanup VERIFIED. No successful SSH session or host identity verified; no database transaction established. |
| Endpoint security | Historical helper remains QUARANTINED / ABANDONED; trust UNKNOWN. No restore/trust/recompile/rename/repackage/new helper, unencrypted key, protection disablement or exclusion. No general McAfee block or timeout root cause is established. |

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

All 14 database migration states are UNKNOWN, explicitly including **20260907150000_admin_temporary_password** (DDL + seed DML), **20260920120000_analytics_paid_at_index** and **20260921120000_session_version**. No corruption or clean/no-op outcome is inferred. No SQL or business rows/logs were queried; READ ONLY enforcement and ROLLBACK were not executed because no database session was opened. DATABASE_WRITES_PERFORMED=NO / SCHEMA_CHANGED=NO describes this audit only; independent writers were not paused/audited.

Future approved SQL: BEGIN READ ONLY first; local statement_timeout 5000ms / lock_timeout 2000ms; verify transaction_read_only=on; server version and only migration_name, checksum, started_at, finished_at, rolled_back_at; allowlisted schema catalogs **only if a history inconsistency requires it**; ROLLBACK and confirm closure. The old key-generating helper orchestration/unconditional schema collection/classifier must not be reused as-is. Failed/partial/inconsistent history or genuine checksum mismatch is a P0 stop, not permission to repair or a pending-first migration decision.

The [Railway support handoff](../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains **READY DRAFT; OWNER_HANDLES_EXTERNALLY**, unchanged. No support message/ticket was sent by Codex, and no owner ticket result/reference was supplied here. The two historical HTTP 200 / INTERNAL_SERVER_ERROR create attempts remain unresolved; one current read-only inventory at **2026-10-07T13:59:32.490Z** is 0/0 with no late snapshot visible. Workflow/cause/cost/recoverability UNKNOWN; BACKUP_AVAILABLE=NO verified checkpoint / BACKUP_PROVIDER_BLOCKER=YES. No backup/restore/schedule/PITR/dump/resize performed. Earlier read-query trace IDs are not historical backup-attempt trace IDs.

### Closed staging / providers

Historical configuration observation at **2026-10-07T01:57:45.893Z**, not refreshed by this access-only cycle, comparing to closed-bootstrap expectations. **MATCH/DIFFERENT/MISSING do not prove current runtime enforcement or authorize a fix.** No feature/commercial-provider call was made.

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
| DATABASE / Phase 2 | BLOCKED; agent AVAILABLE/MATCH but official SSH timed out before runtime proof; history UNKNOWN; no recovery |
| PR / Phase 3 | BLOCKED / NOT ADVANCED; PR NONE, CI NO_EVIDENCE, required gates UNKNOWN |
| STAGING / Phase 5 | BLOCKED; candidate not deployed; closed expectations DIFFERENT/MISSING; next config NOT VERIFIED |
| HOMOLOGATION / Phases 6–7 | NOT EXECUTED externally |
| PRODUCTION / Phases 9–13 | NOT AUTHORIZED / NOT EXECUTED |

P0: compromised staging/production credentials; freeze active. Migration integrity UNKNOWN, not an established corruption incident. P1: **owner official SSH access diagnosis required**, backup provider failure, unknown history/next config, unverified closed bootstrap and candidate/homologation/PR gates. P2: historical legacy Vercel-cron warning and dependency UPSTREAM_WAIT, not fresh audit results. No dependency modernization or full audit.

## HUMAN ACTION REQUIRED

**Current phase:** 2 — DATABASE_VISIBILITY_AND_RECOVERY. **Reason:** identity/agent AVAILABLE/MATCH, but normal official SSH timed out before runtime verification. Limited audit authority is already granted; the next requirement is owner diagnosis/evidence for legitimate official connectivity, not another identity path or disclosure of a passphrase. No automatic retry follows this cycle.

**Exact mutation performed:** one matching public-key registration PERSONAL, named rare-staging-db-audit-20261007, followed by official removal and empty readback. There is no residual audit registration. Future access must revalidate current agent/fingerprint, personal inventory and exact target before using existing limited authority. No owner private/public file generation/copy/move/delete, workspace key, helper or automatic agent-service change.

**Environment/resources:** exact Rare/staging/Postgres-MlyZ identifiers above. Registration affected the owner's PERSONAL account inventory, not an environment-bound key; all attempted connections were restricted to the exact staging target. No workspace key or production service/configuration was selected/changed. Support is handled separately by the owner; Codex is not authorized to send it here.

**Actual/expected side effects:** personal public-key access was added then removed. No DB transaction, restart/deploy or planned downtime occurred. A future approved audit may open one bounded metadata transaction only after runtime proof. Keep the owner-loaded agent intact; never passphrase automation or plaintext collection in chat.

**Security/database/provider impact:** authorized personal public-key lifecycle only; no DB writes/business-data extraction, commercial-provider transaction, backup/restore or production change. Endpoint protection unchanged. Never paste a key body, passphrase or credential into chat.

**Rollback:** preserve all preexisting identities; remove only a newly added audit-only matching-public-key registration afterward with verified personal ownership and available 2FA. Do not bypass 2FA. End any future SQL session with ROLLBACK. Do not restore compromised credentials or quarantined helper. If access cleanup cannot be verified, document and request owner action.

**Abort conditions:** wrong project/environment/service/scope, unavailable identity/2FA, AV prompt requiring bypass, secret output risk, unverified SSH target/host identity, READ ONLY not on, timeout/ambiguous outcome, unexpected LIVE credential, failed/inconsistent migrations/checksum mismatch, unknown migration/deploy effect or any production/provider-cost action.

OPTIONS:

- **A — Official access diagnosis:** owner checks legitimate native Railway/OpenSSH connectivity for the exact staging target and supplies only a sanitized failure/result. Do not run SQL or paste key/passphrase/connection details; no helper, host-trust/AV bypass or tunnel. Any temporary personal registration still requires scoped cleanup.
- **B — Resume with concrete access evidence:** after owner diagnosis, revalidate this same loaded agent/fingerprint, personal inventory and target; retry the narrow official runtime-first audit only under an explicit resume. No automatic service change, helper or new identity.
- **C — Separate provider handoff:** owner handles Railway backup diagnosis externally and may provide a sanitized ticket/result reference; no Codex message, third backup or recovery alternative. This alone does not prove SSH connectivity or known migration history.
- **D — Hold:** keep freeze active, no mutation and no automatic retry/monitoring. Resume Phase 2 only with a concrete owner access/provider decision.

A/B address official access, not the already resolved unavailable-agent gate; C is independent and owner-led. Stop here until legitimate runtime access can be proved; Phase 2 remains unmet. Do not send passphrase or key body to this chat.

## Validation / publication

Current proportional checks: **git diff --check and staged --check PASS; release:guard 6 OK / 1 unchanged legacy Vercel-cron WARNING / 0 FAIL**, 325 tracked files / 43 browser-bundle files. Eight scoped docs/current diffs: **0 exact configured-secret hits / 0 credential-pattern hits; 81 relative links / 0 broken; 0 unbalanced fences; 14 canonical references / 0 incorrect; canonical state/Git counts match**. Additional five-doc/working/staged/branch-diff scan: **0 supplied-public-body hits / 0 public-key-body patterns**, private material not read. Agent recheck at **2026-10-07T14:05:29.035Z** remains AVAILABLE/MATCH; no audit native SSH child remains. Read-only review completed; only five requested canonical docs staged; backup/support handoff unchanged. Staging credential values/authentication used privately only as validation needles, no production read. Actual post-commit count is **35 ahead / 0 behind**; final normal-push equality is verified at closure, not inferred from scans.

No full E2E/application suite/build or new dependency audit. Railway guidance kept the official personal-key lifecycle, exact target/readbacks and safe cleanup after timeout; Postgres guidance kept SQL gated on runtime proof, bounded/read-only and schema collection conditional. Neither skill substitutes for actual runtime, database or recovery evidence.
