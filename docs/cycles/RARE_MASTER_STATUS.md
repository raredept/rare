# RARE — Master Cycle status

```text
CURRENT_PHASE=2
CURRENT_CYCLE=DATABASE_VISIBILITY_AND_RECOVERY
PHASE_RESULT=BLOCKED
RELEASE_SECURITY_FREEZE=ACTIVE
RUNTIME_CANDIDATE_SHA=7a820b62bb1515f7b30ccf31badf1f0881a6bd84
STAGING_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
MAIN_SHA=4ea73f50cafdbf67e16dc71de985052075feca42
AHEAD=38
BEHIND=0
PR=NONE
PR_OBSERVATION=HISTORICAL_NONE_20261007T134733Z
STAGING_STATUS=BLOCKED
PRODUCTION_STATUS=NOT_AUTHORIZED
LAST_GATE=PHASE_2_OWNER_A_B_CONFIRMED_WARP_PATH_DB_WINDOW_PENDING
NEXT_GATE=OWNER_CONTROLLED_DB_ACCESS_WINDOW
BASELINE_VERIFIED=YES
STAGING_MIGRATION_HISTORY_VERIFIED=NO
BACKUP_AVAILABLE=NO
BACKUP_PROVIDER_BLOCKER=YES
SSH_IDENTITY_HUMAN_ACTION_REQUIRED=NO
SSH_ACCESS_HUMAN_ACTION_REQUIRED=YES
SSH_AGENT=AVAILABLE
SSH_AGENT_EXPECTED_FINGERPRINT=MATCH
SSH_IDENTITY_OBSERVATION=2026-10-07T17:45:59.275Z
OWNER_PROVIDED_IDENTITY_PATH=VERIFIED
SSH_IDENTITY_PATH_INVALID=NO
SSH_KEY_PAIR_METADATA_MATCH=YES
SSH_KEY_PAIR_CRYPTOGRAPHIC_VERIFIED=NO
SSH_KEY_ENCRYPTION_STATUS=UNKNOWN
SSH_PASSPHRASE_INTERACTION_REQUIRED=NO_OBSERVED_PROMPT
OWNER_NATIVE_INTERACTION_REQUIRED=NO
AUTHORIZED_PERSONAL_PUBLIC_KEY_REGISTRATION=NOT_REQUIRED_PREEXISTING_MATCH
SSH_KEY_REGISTRATION=PREEXISTING_NOT_CREATED_BY_THIS_CYCLE
SSH_KEY_SCOPE=PERSONAL
SSH_KEY_CLEANUP=NOT_APPLICABLE_PREEXISTING_KEY_PRESERVED
SSH_KEY_REMOVAL_REQUIRES_HUMAN_2FA=NOT_APPLICABLE_NO_REMOVAL
SSH_ATTEMPTED=YES
SSH_ATTEMPTED_THIS_CYCLE=NO
SSH_RESULT_OBSERVATION=OWNER_REPORTED_A_B_WEB_TRUE_WITHOUT_WARP_PASS
SSH_RUNTIME_TARGET_VERIFIED=NO
DNS_RESOLUTION=PASS
TCP_22=REACHABLE
SSH_TARGET_RESOLUTION=MATCH
RAILWAY_SSH_TARGET_RESOLUTION_BLOCKER=NO
RAILWAY_TARGET_RESOLUTION_BLOCKER=NO
TCP_22_BLOCKER=NO
SSH_IDENTITY_BLOCKER=NO
POSTGRES_SSH_COMMAND_TEST=TIMEOUT
POSTGRES_DEPLOYMENT_INSTANCE_SSH=TIMEOUT
WEB_SSH=PASS_OWNER_REPORTED_WITHOUT_WARP_TRUE
RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES
OBSERVED_FAILURE_STAGE=NATIVE_SSH_AFTER_TCP_ESTABLISHED
FAILURE_CAUSE=INTERNAL_WARP_MECHANISM_UNKNOWN
SSH_FAILURE_LAYER=CLOUDFLARE_WARP_PATH
RAILWAY_NETWORK_DIAGNOSTICS=OWNER_REPORTED_COMPLETED_TIMESTAMP_NOT_SUPPLIED
WARP_STATE_BASELINE=CONNECTED
WARP_CURRENT_STATE=DISCONNECTED
WARP_CURRENT_STATE_OBSERVED_AT=2026-10-07T17:56:03.413Z
SSH_WITH_WARP=TIMEOUT_HISTORICAL
SSH_WITH_WARP_EVIDENCE=OWNER_REPORTED_CONTROLLED_A_B
SSH_WITHOUT_WARP=PASS
SSH_WITHOUT_WARP_EVIDENCE=OWNER_REPORTED_WEB_TRUE_SESSION_COMPLETED
WARP_RECONNECTED_AFTER_TEST=YES
WARP_RESTORE_OBSERVATION=OWNER_REPORTED_AFTER_A_B_TIMESTAMP_NOT_SUPPLIED
WARP_SSH_INTERFERENCE=CONFIRMED_BY_A_B
RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN
HUMAN_WARP_WINDOW_REQUIRED=YES
OWNER_DB_ACCESS_WINDOW_CONFIRMATION=PENDING
DATABASE_ACCESS_PATH=NONE
WEB_DATABASE_TARGET_MATCH=NOT_VERIFIED
AUDIT_EXECUTION=NOT_EXECUTED_OWNER_DB_WINDOW_CONFIRMATION_REQUIRED
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

Cycle date: **2026-10-07, America/Sao_Paulo**. Current authority is the owner's **Phase 2 database visibility** instruction following completed owner-controlled WARP A/B. Metadata-only audit is already approved, but the current database-access window remains owner-controlled. Codex must not disconnect/reconnect WARP or alter permanent policies, McAfee, Windows Firewall, Railway/staging configuration, credentials or production. This file is canonical; [Master log](RARE_MASTER_LOG.md) records events. The web PASS and post-A/B restoration are owner-reported, not a Codex PostgreSQL/SQL success.

## Baseline / evidence boundary

Database-visibility entry local and remote release HEAD were both **8eac8920e05fdda275c72d690b5603f45b8630b1**, **37 ahead / 0 behind** after fetch --all --prune; main remains **4ea73f50cafdbf67e16dc71de985052075feca42**. A material-evidence documentation commit was created and its actual count verified as **38 ahead / 0 behind**, recorded in the same unpublished commit; verify normal-push equality at closure. The runtime candidate remains distinct from documentation; no runtime deployment occurred here. Resolve the containing documentation commit with `git log -1 --format=%H -- docs/cycles/RARE_MASTER_STATUS.md`; a document cannot contain its own immutable commit hash. The two unrelated preexisting untracked user files remain preserved/excluded.

BASELINE_VERIFIED=YES means the baseline inventory was reconciled with explicit unknowns and observed failures. It is **not** a database, security, remote CI, runtime-health, homologation or release PASS. No production configuration or runtime was inspected this cycle.

| Check | Current observation / limit |
|---|---|
| GitHub, historical 2026-10-07 13:47:33 UTC | Last exact all-state head/base PR query returned none. No PR/CI query or create/retry/merge this timeout-isolation cycle; top PR is the last observation, not a fresh query. Prior PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved. |
| Remote CI, historical 2026-10-07 01:57:03 UTC | Candidate 7a820b62… and previous entry documentation 9212d34f… each had pending/0 status contexts, 0 check-runs and 0 general Actions runs. NO_EVIDENCE then, not PASS. No new CI queries or claims for this cycle's documentation HEAD. |
| Required checks / reviews / branch protection | UNKNOWN. No PR boundary; connector lacks administrative branch-protection access. Workflow-configuration endpoint was refused by connector allowlist before a GitHub read; UNKNOWN, not a repository ACL diagnosis. No alternate token/authentication route used. |
| Railway target/instances, 2026-10-07T17:48:49.318Z | Fresh official explicit-project/environment metadata matches Rare/staging PG and web IDs. Each latest deployment equals active, SUCCESS, known PG371feb81… and weba47838d1… instances RUNNING. IDs in table below remain unchanged. Not SSH runtime/authentication/SQL proof; deploymentStopped was not emitted by this sanitized check. |
| Staging deployed source | Current web control-plane source is 4ea73f50cafdbf67e16dc71de985052075feca42. Worker source on that SHA is historical 13:50:29.234Z, not independently refreshed here. No deployment; stored-variable classifications below remain historical. |
| Volume metadata, historical | Previous Master Cycle refresh returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR. No volume metadata query this cycle; attachment/capacity/usage/region remain dated, not independently refreshed. |
| Backup inventory, historical 2026-10-07T13:59:32.490Z | Last verified listing: **0 snapshots / 0 schedules**, no late snapshot then. Not queried this isolation cycle. No verified recovery checkpoint; two create attempts cumulative, no third request. |
| Credential incident | All four affected categories in staging AND production remain COMPROMISED until rotation/revocation is proved. Presence or TEST classification does not close compromise. Rotation/revocation not executed. |

## Current Phase 2 — owner A/B confirmed; database window required

**Material owner report:** controlled A/B completed; WARP baseline **CONNECTED**, with-WARP **TIMEOUT_HISTORICAL**, without-WARP **PASS** for official Railway SSH on exact Rare/staging **rare-staging web**, remote command **true**. Owner reports session established, remote command completed and expected closure, plus **WARP_RECONNECTED=YES** after that A/B; execution timestamp not supplied. Classify **WARP_SSH_INTERFERENCE=CONFIRMED_BY_A_B / SSH_FAILURE_LAYER=CLOUDFLARE_WARP_PATH / RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN**. TCP22/identity/target-resolution blockers **NO** for that reported successful path. Internal WARP mechanism remains UNKNOWN. Expected closure after a short remote command is not itself an error. The owner-reported web PASS is **not** PostgreSQL access, runtime identity verification, same-DB binding proof or a migration audit.

**Fresh read-only preflight, UTC:** native agent at **17:45:59.275Z** AVAILABLE/one ED25519 expected fingerprint MATCH; WARP status at **17:45:59.865Z** **DISCONNECTED**, no action by Codex. Existing known_hosts entry for ssh.railway.com present at **17:45:59.956Z**; owner reports first-use acceptance, not an independently verified host-key fingerprint. No host-key/body output or trust/config change. Personal CLI authentication at **17:47:48.644Z** verified, token overrides absent; PERSONAL inventory read at **17:47:50.922Z** contains the expected fingerprint already registered, **not created by this cycle**. Preserve it; do not remove the owner's preexisting registration or pair/agent. No key lifecycle was performed.

**Fresh target evidence at 17:48:49.318Z:** project72ed12be-9a2a-4e13-8594-30ffd8ffa565 / stagingd8399691-dacf-41e9-a9d5-060c97672e39 / PGserviceed0a374e-79da-4aab-9e3a-bb684fb829d1 / ServiceInstance3b37cfd9-f315-40df-a8a6-35673912d346 MATCH. Current deploymenta20b8647-5a81-4a0b-a44f-b096a58996f3 has RUNNING instance371feb81-4709-4070-a96a-d9ad854e254b; latest=active/SUCCESS. Web source remains4ea73f50cafdbf67e16dc71de985052075feca42; managed PG exposes no Git SHA. No production target/default selection, variables/configuration query, new SSH/SQL or backup request.

**Actual gate:** **HUMAN_WARP_WINDOW_REQUIRED=YES / OWNER_DB_ACCESS_WINDOW_CONFIRMATION=PENDING**. Current DISCONNECTED does not establish who opened a new window, its readiness or its agreed duration; the owner explicitly retains control. A non-blocking request for “janela aberta” was sent; no response is available yet. No automatic disconnect, reconnect, split tunnel, policy/protection change or SSH retry. Audit approval already exists; request only the owner's window confirmation, not another audit permission. If no audit window is intended now, the owner should restore WARP and agree a short later window.

Read-only closure status at **2026-10-07T17:56:03.413Z** still returned **DISCONNECTED**, exit0, no Codex WARP change. No owner window confirmation, new SSH/SQL or session was available at that check; the restoration YES above applies only to the reported completed A/B, not this later state.

**Conditional audit:** revalidate current IDs/agent/preexisting key immediately before official SSH. Prove exact PG runtime before one bounded existing-psql stdin audit; no new executable/helper/file/install. First SQL **BEGIN READ ONLY**; SET LOCAL statement_timeout5000ms/lock_timeout2000ms; SHOW transaction_read_only must return **on** before metadata. Collect server version and only migration_name/checksum/started_at/finished_at/rolled_back_at, complete bounded output/no silent LIMIT/truncation, minimal allowlisted catalogs only if necessary. Require explicit successful ROLLBACK and confirmed session closure before publishing history. Stop on changed host trust, target mismatch, failed guard, timeout or ambiguous result; no TLS/host-trust bypass. Static review reconfirmed14canonical references/UTF-8/LF/CRLF variants, not DB results. No SQL/session/ROLLBACK occurred this cycle; PostgreSQL version, all five counts and critical3 remain UNKNOWN; historyverifiedNO/cleanUNKNOWN/Munknown/SNO. Backup/config/security remain independently BLOCKED, no third/rotation/deploy/production/next phase.

## Historical Phase 2 — WARP A/B awaiting owner result

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

The [Railway support handoff](../security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains **READY DRAFT; OWNER_HANDLES_EXTERNALLY**, expanded with the owner's confirmed WARP A/B and still-pending DB access window. Codex sent no message/ticket and downloaded/executed no diagnostic tool; owner external contact/result is not verified. Two historical HTTP200/INTERNAL_SERVER_ERROR create attempts remain unresolved; last verified prior-cycle inventory **2026-10-07T13:59:32.490Z** is0/0/no late snapshot then, not refreshed here. Workflow/cause/cost/recoverability UNKNOWN; BACKUP_AVAILABLE=NO verified checkpoint / provider blockerYES. No third create, backup/restore/schedule/PITR/dump/resize. Read-query trace IDs are not historical backup-attempt IDs, and SSH interference does not establish the backup errors' cause.

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
| DATABASE / Phase 2 | BLOCKED; WARP A/B owner-confirmed/web true PASS, current owner DB-window confirmation pending; PG runtime/SQL/history UNKNOWN; no recovery |
| PR / Phase 3 | BLOCKED / NOT ADVANCED; PR NONE, CI NO_EVIDENCE, required gates UNKNOWN |
| STAGING / Phase 5 | BLOCKED; candidate not deployed; closed expectations DIFFERENT/MISSING; next config NOT VERIFIED |
| HOMOLOGATION / Phases 6–7 | NOT EXECUTED externally |
| PRODUCTION / Phases 9–13 | NOT AUTHORIZED / NOT EXECUTED |

P0: compromised staging/production credentials; freeze active. Migration integrity UNKNOWN, not an established corruption incident. P1: **A/B now owner-confirmed; current owner-controlled DB access window required**, backup failure, unknown history/next config, unverified closed bootstrap/candidate/homologation/PR gates. P2: historical legacy Vercel-cron warning and dependency UPSTREAM_WAIT, not fresh audit results. No dependency modernization or full audit.

## HUMAN ACTION REQUIRED

Confirm “janela aberta” for the already-approved metadata-only audit. WARP was observed DISCONNECTED; no owner confirmation of the current DB window was received, so Codex opens no SSH/SQL session yet. External owner actions and who opened the disconnected state are UNKNOWN. Owner retains WARP control and must reconfirm restoration after the future audit; restore it now if no audit window is intended. No other protection/permanent policy may change; do not share key bodies/passphrases/credentials/raw diagnostics. Phase2 remains BLOCKED; no Codex support message.

## Historical timeout-isolation human-action package — superseded by the current DB-window gate

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

Historical WARP A/B pending-cycle documentation checks: **diff check PASS; release:guard6 OK / 1 unchanged legacy warning / 0 FAIL**; eight-doc/working/staged/branch-diff credential and key-body pattern hits0,102relative links/0broken, balanced fences,14correct canonical references/statecountsMATCH. Current material evidence is the owner-confirmed A/B and fresh read-only identity/inventory/target state; revalidate scoped docs/offline patterns/links/checksums/state before normal publication. No new exact-configured-secret comparison, production read, SSH/SQL/DB result or runtime source change is implied. Preserve both unrelated untracked files and STOP Phase2 pending the owner's access window.

Current confirmed-A/B documentation validation: **diff checkPASS / release:guard6OK,1unchangedlegacywarning,0FAIL**; eight-doc/working/staged/branch-diff credential/key-body pattern hits0, **113 relative links/0broken**, balanced fences, **14 correct canonical references**, state/Git countsMATCH. No exact configured-secret comparison or provider/DB/SSH test is represented by these offline checks. Cross-review preserved owner attribution, preexisting-key ownership and the pending window; only six canonical/specialized docs are scoped for one material-evidence commit and normal publication.

No full E2E/application suite/build or new dependency audit. Railway guidance kept official dry-run/identifier distinctions, bounded native probes and scoped personal-key cleanup; Postgres guidance kept fallback SQL blocked without web/runtime/binding/READ ONLY proof. Neither skill proves the unresolved gateway/local cause, database history or recovery.
