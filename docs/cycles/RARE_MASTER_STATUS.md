# RARE — Master Cycle status

```text
CURRENT_PHASE=2
CURRENT_CYCLE=DATABASE_VISIBILITY_AND_RECOVERY
PHASE_RESULT=BLOCKED
RELEASE_SECURITY_FREEZE=ACTIVE
RUNTIME_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84
STAGING_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
MAIN_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
AHEAD=37
BEHIND=0
PR=NONE
PR_OBSERVATION=HISTORICAL_NONE_20261007T134733Z
STAGING_STATUS=BLOCKED
PRODUCTION_STATUS=NOT_AUTHORIZED
LAST_GATE=PHASE_2_BLOCKED_BY_COMMON_SSH_PATH_AFTER_TCP_AND_BACKUP_PROVIDER
NEXT_GATE=OWNER_A_B_RESULT_AND_WARP_RESTORATION_CONFIRMATION
BASELINE_VERIFIED=YES
STAGING_MIGRATION_HISTORY_VERIFIED=NO
BACKUP_AVAILABLE=NO
BACKUP_PROVIDER_BLOCKER=YES
SSH_IDENTITY_HUMAN_ACTION_REQUIRED=NO
SSH_ACCESS_HUMAN_ACTION_REQUIRED=YES
SSH_AGENT=AVAILABLE
SSH_AGENT_EXPECTED_FINGERPRINT=MATCH
SSH_IDENTITY_OBSERVATION=HISTORICAL_20261007T142925Z
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
SSH_ATTEMPTED_THIS_CYCLE=NO
SSH_RESULT_OBSERVATION=HISTORICAL_20261007T143554Z_TO_143845Z
SSH_RUNTIME_TARGET_VERIFIED=NO
DNS_RESOLUTION=PASS
TCP_22=REACHABLE
SSH_TARGET_RESOLUTION=MATCH
RAILWAY_SSH_TARGET_RESOLUTION_BLOCKER=NO
POSTGRES_SSH_COMMAND_TEST=TIMEOUT
POSTGRES_DEPLOYMENT_INSTANCE_SSH=TIMEOUT
WEB_SSH=TIMEOUT
RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES
OBSERVED_FAILURE_STAGE=NATIVE_SSH_AFTER_TCP_ESTABLISHED
FAILURE_CAUSE=UNKNOWN
SSH_FAILURE_LAYER=UNKNOWN
RAILWAY_NETWORK_DIAGNOSTICS=OWNER_REPORTED_COMPLETED_TIMESTAMP_NOT_SUPPLIED
WARP_STATE_BASELINE=UNKNOWN
WARP_CURRENT_STATE=CONNECTED
WARP_CURRENT_STATE_OBSERVED_AT=2026-10-07T15:11:41.592Z
SSH_WITH_WARP=OTHER
SSH_WITH_WARP_EVIDENCE=HISTORICAL_TIMEOUT_NOT_TIME_ALIGNED_TO_WARP_STATUS
SSH_WITHOUT_WARP=OTHER
SSH_WITHOUT_WARP_EVIDENCE=RESULT_NOT_SUPPLIED_CODEX_NOT_EXECUTED_OWNER_EXECUTION_UNKNOWN
WARP_RECONNECTED_AFTER_TEST=UNKNOWN
WARP_SSH_INTERFERENCE=UNDETERMINED
RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN
DATABASE_ACCESS_PATH=NONE
WEB_DATABASE_TARGET_MATCH=NOT_VERIFIED
AUDIT_EXECUTION=NOT_EXECUTED_OWNER_A_B_RESULT_REQUIRED
EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED
CREDENTIAL_INCIDENT=P0_OPEN
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

Cycle date: **2026-10-07, America/Sao_Paulo**. Current authority is the owner's **Phase 2 Cloudflare WARP A/B isolation** instruction. The owner controls any temporary WARP disconnect/reconnect; Codex must not change WARP, McAfee, Windows Firewall, Railway/staging configuration, credentials or production. This file is the canonical current state; [Master log](RARE_MASTER_LOG.md) records events. Earlier 14:29–14:39 UTC SSH/identity/target observations are historical, not re-executed in this A/B cycle.

## Baseline / evidence boundary

WARP A/B entry local and remote release HEAD were both **c8788b37f92a8a6cffb2feb3ec60329c7ba5ac1d**, **36 ahead / 0 behind** after fetch --all --prune; main remains **4ea73f50cafdbf67e16dc71de985052075feca42**. The material-evidence documentation commit was created and its actual count verified as **37 ahead / 0 behind**, recorded in the same unpublished commit; verify normal-push equality at closure. The runtime candidate remains distinct from documentation; no runtime deployment occurred here. Resolve the containing documentation commit with `git log -1 --format=%H -- docs/cycles/RARE_MASTER_STATUS.md`; a document cannot contain its own immutable commit hash. The two unrelated preexisting untracked user files remain preserved/excluded.

BASELINE_VERIFIED=YES means the baseline inventory was reconciled with explicit unknowns and observed failures. It is **not** a database, security, remote CI, runtime-health, homologation or release PASS. No production configuration or runtime was inspected this cycle.

| Check | Current observation / limit |
|---|---|
| GitHub, historical 2026-10-07 13:47:33 UTC | Last exact all-state head/base PR query returned none. No PR/CI query or create/retry/merge this timeout-isolation cycle; top PR is the last observation, not a fresh query. Prior PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved. |
| Remote CI, historical 2026-10-07 01:57:03 UTC | Candidate 7a820b62… and previous entry documentation 9212d34f… each had pending/0 status contexts, 0 check-runs and 0 general Actions runs. NO_EVIDENCE then, not PASS. No new CI queries or claims for this cycle's documentation HEAD. |
| Required checks / reviews / branch protection | UNKNOWN. No PR boundary; connector lacks administrative branch-protection access. Workflow-configuration endpoint was refused by connector allowlist before a GitHub read; UNKNOWN, not a repository ACL diagnosis. No alternate token/authentication route used. |
| Railway target/instances, 2026-10-07T14:33:51.366–14:33:53.157Z | Explicit Rare/staging PG and web IDs/names matched. Each has one active deployment equal to latest, SUCCESS/stopped=false and one selected RUNNING deployment instance. Metadata table below. Not runtime/authentication proof. |
| Staging deployed source | Current web control-plane source is 4ea73f50cafdbf67e16dc71de985052075feca42. Worker source on that SHA is historical 13:50:29.234Z, not independently refreshed here. No deployment; stored-variable classifications below remain historical. |
| Volume metadata, historical | Previous Master Cycle refresh returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR. No volume metadata query this cycle; attachment/capacity/usage/region remain dated, not independently refreshed. |
| Backup inventory, historical 2026-10-07T13:59:32.490Z | Last verified listing: **0 snapshots / 0 schedules**, no late snapshot then. Not queried this isolation cycle. No verified recovery checkpoint; two create attempts cumulative, no third request. |
| Credential incident | All four affected categories in staging AND production remain COMPROMISED until rotation/revocation is proved. Presence or TEST classification does not close compromise. Rotation/revocation not executed. |

## Current Phase 2 — WARP A/B awaiting owner result

**Material new owner-reported evidence:** official Railway Network Diagnostics completed, execution timestamp not supplied: Railway HTTP endpoint **PASS / HTTP200**, edge **gru1**, traceroute **COMPLETED**, ping loss **0%**, latency approximately **19ms**; system resolver **connectivity-check.warp-svc / 127.0.2.2** experienced timeouts before resolution, Cloudflare **1.1.1.1 lookup PASS**, observed egress **AS13335**. This is the owner's sanitized report, not independently executed/reproduced by Codex. HTTP-path health and observed Cloudflare routing do not prove SSH health or an internal WARP defect.

**Current independent read-only check:** installed `warp-cli --help` confirmed `status`; `warp-cli status` at **2026-10-07T15:11:41.592Z** returned **CONNECTED**, exit0. Only classification was emitted; no settings, registration, connect/disconnect or configuration command ran. Current CONNECTED does **not** establish the historical SSH baseline or that an A/B test occurred and WARP was restored afterward.

**Missing owner evidence:** controlled with-WARP SSH result/state/time, without-WARP result and tested service, and explicit reconnection confirmation. Previous PG/web TIMEOUT observations remain historical and are not time-aligned with a verified WARP state. `SSH_WITH_WARP=OTHER` means no controlled baseline was reconciled; `SSH_WITHOUT_WARP=OTHER` means result not supplied and not executed by Codex; external owner execution remains UNKNOWN, not a measured failure. No new SSH, agent/key/provider operation, SQL/DB connection, backup listing/mutation, secret read/rotation, deployment, configuration or production action occurred in this cycle. WARP baseline **UNKNOWN**, interference **UNDETERMINED**, gateway failure **NOT PROVEN**; no A/B cause is inferred.

**Next / conditional audit:** owner supplies the A/B result and restoration confirmation. WITH timeout / WITHOUT pass confirms **CLOUDFLARE_WARP_PATH / CONFIRMED_BY_A_B**, not an internal mechanism; both timeout means **NOT_CONFIRMED**, with Railway/upstream only a triage hypothesis, not exclusion of local/authentication causes. Future options are a temporary owner-approved disconnect for the metadata audit or a separately approved split-tunnel/policy review; **no permanent WARP change is authorized**. Only successful official Railway SSH plus fresh exact staging/runtime identity permits the already-approved metadata audit: BEGIN READ ONLY first, local statement_timeout5000ms/lock_timeout2000ms, verify transaction_read_only=on before only five migration fields/necessary allowlisted catalogs, then confirmed ROLLBACK and session closure. No application rows/logs, migration, fix, deploy or next phase. All DB counts remain UNKNOWN; backup provider blockerYES/no third; incidentP0_OPEN/rotationNO/freezeACTIVE/readinessNO.

## Historical Phase 2 — SSH timeout isolation entry, work, gate, exit

**Entry / current authorization:** use the same owner-loaded Windows OpenSSH Agent and existing **%USERPROFILE%/.ssh/rare_staging_db_audit_20261007**/.pub; matching public-key PERSONAL registration if absent and scoped removal are authorized. Diagnose DNS/TCP first, preview config with --dry-run only, verify Service/Service Instance/Deployment Instance distinctions, then one noninteractive `true` per authorized path: PG service, PG active deployment instance only after service timeout, and web staging. Web-host metadata fallback is conditional on WEB_SSH=PASS and private proof that it targets the same staging PG. No passphrase request/read/store, new identity/helper, arbitrary import/workspace key, firewall/AV/TLS/host-trust bypass, public DB exposure, backup/restore/rotation/deploy/redeploy/restart/migration or production action. Support remains owner-led; no later phase.

**Work performed:** Git preflight, native agent/public-file checks, PERSONAL lifecycle 0→1→0, native DNS/TCP commands, two read-only config previews (second resolves escaped IdentityFile rendering), fresh control-plane instance metadata, and exactly three bounded official SSH `true` probes. No caller-forced -i; automatic -i was observed in each native child. Expected target and TCP/22 Established were observed per child; all three timed out, then only their positively scoped native processes were terminated. New registration removed and empty inventory verified; loaded agent preserved. No new PR/CI query, backup listing, SQL, DB-binding/module probe or runtime config inspection. No old helper/new executable/key or key body printed. Staging values may be used privately only as documentation-secret-scan needles, never emitted.

**Gate / actual result:** **BLOCKED — CASE B / RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES**. DNS/TCP reachability, generated PG Service Instance target and native child targets MATCH; the same timeout affects PG service, its verified active deployment instance and web staging, after TCP Established. This isolates the observed failing stage to the common native SSH path after TCP, not a basic TCP/22 failure or demonstrated PG-specific/Service-ID mismatch. **Root cause, gateway versus local route, SSH handshake/authentication stage and remote host/runtime remain UNKNOWN**; no passphrase prompt or publickey denial was observed. It does not prove a CLI/AV/provider defect. WEB_SSH is not PASS, so fallback cannot open a DB connection. History UNKNOWN; recovery and next-deploy config remain independent blockers.

**Exit:** personal-key cleanup completed; materially new network/instance/cross-service evidence authorizes one documentation update including the support handoff, not another commit merely repeating a blocker. Validate/commit/push only scoped docs, verify equality and STOP. Owner runs official Railway Network Diagnostics or an owner-approved alternate-network comparison; Codex downloads/runs no diagnostic tool and sends no support message. Phase 2 remains unmet, Phase 3–13 NOT ADVANCED. No full suite/E2E/build/dependency upgrade for docs-only changes.

### SSH / endpoint security

| Evidence | Result |
|---|---|
| Owner-provided identity location | VERIFIED: supplied private/.pub paths exist outside E:/rare, no reparse points, `.ssh` outside discovered Git repository. Existing owner files unchanged. |
| Native agent / existing public files, 14:29:25.435–14:29:25.891 UTC | Native ssh-add -l exit0: AVAILABLE, 1 ED25519 identity, **SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw** MATCH; supplied private/.pub exist outside repository/no symlinks, public fingerprint MATCH. No private derivation/comment/body/passphrase output or file/agent/service change. |
| PERSONAL registration, 2026-10-07T14:30:57.484Z | Existing personal auth / token overrides absent; inventory0→1, only supplied .pub rare-staging-db-audit-20261007 MATCH. No workspace/import/private transmission. |
| Network, 2026-10-07T14:31:46.034Z | Resolve-DnsName PASS; Test-NetConnection ssh.railway.com -Port22 REACHABLE. Only classifications printed, no address dump or firewall change. No basic TCP egress blocker observed; later SSH/local-route causes not excluded. |
| Config previews, 14:32:38.079 / 14:34:30.252 UTC | --dry-run with explicit staging IDs: HostName ssh.railway.com; User=PG Service Instance ID3b37cfd9… MATCH, not Service ID. IdentityFile is owner's existing private path; no body read/config write. |
| PG service true probe, 14:35:54.368–14:36:22.793 UTC | TIMEOUT; 25-second deadline, native target MATCH/TCP22 Established/automatic-i present; scoped child terminated. No command success or remote authentication/runtime proof. |
| PG deployment-instance true probe, 14:38:17.584–14:38:45.952 UTC | Exactly one override of verified RUNNING instance371feb81…: TIMEOUT; native target MATCH/TCP22 Established, scoped close. Project/env/service flags supplied, but override ownership was proved separately because CLI skips resolution for -d. |
| Web staging true probe, 14:38:17.924–14:38:45.955 UTC | Exactly once: TIMEOUT; native service-instance targetd6368ea1… MATCH/TCP22 Established, scoped close. No web fallback, module/DB-binding query or SQL. |
| Official cleanup, 14:39:49.590–14:39:52.008 UTC | New fingerprint removed PERSONAL, exit0; readback empty/expected absent, no2FA. Agent still AVAILABLE/MATCH; owner local pair untouched. All scoped audit native SSH processes closed. |
| Linked GitHub metadata | UNKNOWN from the previous cycle's error, not freshly queried. Not the selected owner-provided-.pub route; no arbitrary import or authentication workaround. |
| Actual access / key operations | SSH_PATH=BLOCKED; SSH_ATTEMPTED=YES / SQL=NO / personal register+remove=YES. Import/create/copy/move/local delete=NO. Owner identities untouched; cleanup VERIFIED. No successful SSH session or host identity verified; no database transaction established. |
| Endpoint security | Historical helper remains QUARANTINED / ABANDONED; trust UNKNOWN. No restore/trust/recompile/rename/repackage/new helper, unencrypted key, protection disablement or exclusion. No general McAfee block or timeout root cause is established. |

Fresh control-plane metadata, not SSH runtime proof:

| Identifier | Postgres-MlyZ | rare-staging web |
|---|---|---|
| Service ID | ed0a374e-79da-4aab-9e3a-bb684fb829d1 | 3f4b79f6-2819-45a6-986d-584dc7ac803a |
| Service Instance ID / default SSH user | 3b37cfd9-f315-40df-a8a6-35673912d346 | d6368ea1-30e4-4593-b35a-65f21537a1ed |
| Current Deployment ID | a20b8647-5a81-4a0b-a44f-b096a58996f3 | 3e4874f3-397c-47fa-be77-73d1b0089ceb |
| Current RUNNING Deployment Instance ID | 371feb81-4709-4070-a96a-d9ad854e254b | a47838d1-1f83-4127-960a-1ffc8d49d8d3 |

[Official SSH documentation](https://docs.railway.com/cli/ssh) distinguishes Service ID from Service Instance ID and supports deployment-instance targets. [CLI v5.26.0 resolution](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/mod.rs#L88-L107) makes -d a direct override; explicit project/env/service flags do not validate its ownership. [Windows CLI discovery](https://github.com/railwayapp/cli/blob/v5.26.0/src/controllers/ssh/keys.rs#L60-L122) uses Pageant and may select the local .pub/private sibling, while native Windows OpenSSH can use its own loaded agent; automatic-i was observed, not forced by the caller, and is **not a proven timeout cause**. No key/agent/config substitution is authorized by that source observation.

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

Future approved PG-host SQL requires runtime proof, then BEGIN READ ONLY first; local statement_timeout5000ms/lock_timeout2000ms, verify on, server version and only five approved migration fields, minimal schema only if inconsistency requires it, ROLLBACK/closure. Web fallback requires WEB_SSH=PASS, exact web-runtime identity and private proof of the same PG target; only temporary stdin execution with existing Node/Prisma, no app/server/file/package changes. First transaction user SQL SET TRANSACTION READ ONLY, then SHOW on before metadata; prove actual transaction end/rollback and await disconnect before publishing results. A caught Prisma sentinel alone is not rollback proof. If protection/modules/binding cannot be proved, STOP without metadata. No such fallback/runtime/SQL check executed here. Old key-generating orchestration/unconditional schema collection/classifier must not be reused. Integrity failures take priority over pending/no-op conclusions, without repair authority.

The [Railway support handoff](../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains **READY DRAFT; OWNER_HANDLES_EXTERNALLY**, materially expanded with the owner's diagnostic report and unresolved A/B gate. Codex sent no message/ticket and downloaded/executed no diagnostic tool; owner external contact/result is not verified. Two historical HTTP200/INTERNAL_SERVER_ERROR create attempts remain unresolved; last verified prior-cycle inventory **2026-10-07T13:59:32.490Z** is0/0/no late snapshot then, not refreshed here. Workflow/cause/cost/recoverability UNKNOWN; BACKUP_AVAILABLE=NO verified checkpoint / provider blockerYES. No third create, backup/restore/schedule/PITR/dump/resize. Read-query trace IDs are not historical backup-attempt IDs.

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
| DATABASE / Phase 2 | BLOCKED; all three official SSH probes timed out after TCP Established despite matching targets; no web fallback/runtime proof; history UNKNOWN; no recovery |
| PR / Phase 3 | BLOCKED / NOT ADVANCED; PR NONE, CI NO_EVIDENCE, required gates UNKNOWN |
| STAGING / Phase 5 | BLOCKED; candidate not deployed; closed expectations DIFFERENT/MISSING; next config NOT VERIFIED |
| HOMOLOGATION / Phases 6–7 | NOT EXECUTED externally |
| PRODUCTION / Phases 9–13 | NOT AUTHORIZED / NOT EXECUTED |

P0: compromised staging/production credentials; freeze active. Migration integrity UNKNOWN, not an established corruption incident. P1: **owner WARP A/B result and restoration confirmation required; diagnostics already owner-reported**, backup failure, unknown history/next config, unverified closed bootstrap/candidate/homologation/PR gates. P2: historical legacy Vercel-cron warning and dependency UPSTREAM_WAIT, not fresh audit results. No dependency modernization or full audit.

## HUMAN ACTION REQUIRED

Provide the controlled with-/without-WARP SSH results, tested target and restoration confirmation; the current status is CONNECTED, but A/B completion is unknown. Owner retains control of WARP. No other protection or permanent policy may be changed. Do not share key bodies, passphrases, credentials or raw diagnostic files. Phase 2 is BLOCKED; no new SSH/SQL runs while this evidence is missing. No Railway support message is sent by Codex.

## Historical timeout-isolation human-action package — superseded by the A/B gate

**Current phase:** 2 — DATABASE_VISIBILITY_AND_RECOVERY. **Reason:** DNS/TCP PASS and matching default/active-instance targets, but all three official SSH probes timed out at the native path after TCP Established. Limited audit authority remains; next requirement is owner official Network Diagnostics or approved alternate-network evidence, not another identity or a passphrase. No automatic retry follows this cycle.

**Exact mutation performed:** one matching public-key registration PERSONAL, named rare-staging-db-audit-20261007, followed by official removal and empty readback. There is no residual audit registration. Future access must revalidate current agent/fingerprint, personal inventory and exact target before using existing limited authority. No owner private/public file generation/copy/move/delete, workspace key, helper or automatic agent-service change.

**Environment/resources:** exact Rare/staging/Postgres-MlyZ identifiers above. Registration affected the owner's PERSONAL account inventory, not an environment-bound key; all attempted connections were restricted to the exact staging target. No workspace key or production service/configuration was selected/changed. Support is handled separately by the owner; Codex is not authorized to send it here.

**Actual/expected side effects:** personal public-key access was added then removed. No DB transaction, restart/deploy or planned downtime occurred. A future approved audit may open one bounded metadata transaction only after runtime proof. Keep the owner-loaded agent intact; never passphrase automation or plaintext collection in chat.

**Security/database/provider impact:** authorized personal public-key lifecycle only; no DB writes/business-data extraction, commercial-provider transaction, backup/restore or production change. Endpoint protection unchanged. Never paste a key body, passphrase or credential into chat.

**Rollback:** preserve all preexisting identities; remove only a newly added audit-only matching-public-key registration afterward with verified personal ownership and available 2FA. Do not bypass 2FA. End any future SQL session with ROLLBACK. Do not restore compromised credentials or quarantined helper. If access cleanup cannot be verified, document and request owner action.

**Abort conditions:** wrong project/environment/service/scope, unavailable identity/2FA, AV prompt requiring bypass, secret output risk, unverified SSH target/host identity, READ ONLY not on, timeout/ambiguous outcome, unexpected LIVE credential, failed/inconsistent migrations/checksum mismatch, unknown migration/deploy effect or any production/provider-cost action.

OPTIONS:

- **A — Official Network Diagnostics:** owner follows [Railway's official guide](https://docs.railway.com/networking/troubleshooting/network-diagnostics) and shares a reviewed sanitized result with Railway through an approved channel. Codex has not downloaded/run the tool or sent evidence. No SQL/key/passphrase/raw transcript, helper or host-trust/AV/firewall/TLS bypass.
- **B — Resume with concrete access evidence:** after owner diagnosis, revalidate this same loaded agent/fingerprint, personal inventory and target; retry the narrow official runtime-first audit only under an explicit resume. No automatic service change, helper or new identity.
- **C — Approved alternate network / provider handoff:** owner may compare connectivity from another owner-approved network and handle the expanded Railway support draft externally. Supply a sanitized result/reference; no Codex support message or third backup. Do not disable endpoint/network protections. This alone does not prove known DB history.
- **D — Hold:** keep freeze active, no mutation and no automatic retry/monitoring. Resume Phase 2 only with a concrete owner access/provider decision.

A/B address official access, not the already resolved unavailable-agent gate; C is independent and owner-led. Stop here until legitimate runtime access can be proved; Phase 2 remains unmet. Do not send passphrase or key body to this chat.

## Validation / publication

Previous timeout-isolation documentation validation: **git diff --check PASS; release:guard 6 OK / 1 unchanged legacy Vercel-cron WARNING / 0 FAIL**, 325 tracked files / 43 browser-bundle files; eight-doc configured/pattern hits0, 91links/0broken, balanced fences,14correct canonical references, state/countsMATCH and public-body scan0. These are dated previous-cycle results, not fresh A/B validation. Current documentation is limited to material owner diagnostic evidence and the read-only WARP state; proportional offline checks and normal publication must pass before closure. No configured credential/authentication value is read for this A/B cycle; no runtime source change.

Current WARP A/B documentation checks: **diff check PASS; release:guard6 OK / 1 unchanged legacy warning / 0 FAIL**; eight-doc/working/staged/branch-diff credential and key-body pattern hits **0**, **102 relative links / 0 broken**, balanced fences, **14 correct canonical checksum references**, state/Git counts MATCH. These are offline/pattern checks, not a fresh exact-configured-secret comparison or a provider/DB/SSH/A/B test. Read-only cross-review precision findings fixed. Stage only the six material-evidence docs, record actual post-commit counts, normal push/equality readback, then STOP Phase2 pending owner results; preserve both unrelated untracked files.

No full E2E/application suite/build or new dependency audit. Railway guidance kept official dry-run/identifier distinctions, bounded native probes and scoped personal-key cleanup; Postgres guidance kept fallback SQL blocked without web/runtime/binding/READ ONLY proof. Neither skill proves the unresolved gateway/local cause, database history or recovery.
