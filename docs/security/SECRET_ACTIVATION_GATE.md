# RARE — secret activation & migration gate

## Current Phase 2 / migration history verified, independent gates blocked — 2026-10-07

Current authority/state: [canonical Master status](../cycles/RARE_MASTER_STATUS.md), [Master log](../cycles/RARE_MASTER_LOG.md), and [database gate](STAGING_DATABASE_GATE.md). **CURRENT_PHASE=2; DATABASE_HISTORY_GATE=PASS; PHASE_RESULT=DATABASE_VISIBILITY_VERIFIED_RECOVERY_BLOCKED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The owner explicitly authorized/opened the WARP window; **HUMAN_WARP_WINDOW_REQUIRED=RESOLVED**. The metadata objective UNKNOWN -> KNOWN was achieved, not release/recovery/activation approval.

**Direct audit evidence, UTC:** immediately before SSH at **2026-10-07T19:05:37.742Z**, WARP was DISCONNECTED and the native agent AVAILABLE / expected fingerprint MATCH. Official PostgreSQL SSH audit **19:05:37.743Z–19:05:43.430Z** verified the exact staging runtime before SQL, verified **transaction_read_only=on**, returned PostgreSQL **18.6 (Debian 18.6-1.pgdg13+2)** and 14 migration metadata rows, then confirmed the server **ROLLBACK**, psql completion and SSH exit **0**. Session closed; **0 remaining audit native SSH processes**. Codex did not toggle WARP; **OWNER_WARP_RECONNECT_REQUIRED=YES** after all audit access closed. Post-audit owner reconnection is not asserted.

The fresh control-plane target at **18:57:52.867Z** matched project **72ed12be-9a2a-4e13-8594-30ffd8ffa565**, staging **d8399691-dacf-41e9-a9d5-060c97672e39**, PostgreSQL Service **ed0a374e-79da-4aab-9e3a-bb684fb829d1** and Service Instance **3b37cfd9-f315-40df-a8a6-35673912d346**. The remote guard also matched the exact project/environment/service and deployment **a20b8647-5a81-4a0b-a44f-b096a58996f3** before metadata. First SQL was **BEGIN READ ONLY**; local statement timeout **5000ms** / lock timeout **2000ms**, with SHOW returning **on** before collection. Only approved PostgreSQL version and five migration fields were collected, not business/PII/seed values.

All **14** rows are **APPLIED**, one attempt each, with exact checksums against canonical Git blobs at deployed SHA **4ea73f50cafdbf67e16dc71de985052075feca42**, not Windows worktree bytes. **APPLIED=14; PENDING=0; FAILED=0; ROLLED_BACK=0; CHECKSUM_MISMATCH=0; EXTRA_MIGRATIONS=0; ANOMALIES=0.**

```text
STAGING_MIGRATION_HISTORY_VERIFIED=YES
MIGRATION_HISTORY_CLEAN=YES
MIGRATE_DEPLOY_EXPECTED_NOOP=YES
PHASE_M_REQUIRED=NO
P0_MIGRATION_INTEGRITY_BLOCKER=NO
READ_ONLY_VERIFIED=YES
ROLLBACK=EXECUTED_AND_CONFIRMED
DATABASE_WRITES_PERFORMED=NO
SCHEMA_CHANGED=NO
```

| Sensitive migration | Verified migration-history result |
|---|---|
| 20260907150000_admin_temporary_password | APPLIED / canonical checksum MATCH |
| 20260920120000_analytics_paid_at_index | APPLIED / canonical checksum MATCH |
| 20260921120000_session_version | APPLIED / canonical checksum MATCH |

Clean/no-op describes the complete migration-history comparison to those 14 deployed-SHA references; `prisma migrate deploy` was not executed. APPLIED does not verify business/account seed values or every current schema effect. NO writes/schema changes describes this audit, not independent application writers, which were not paused/audited. No migration, resolve/repair, DDL/DML, install or app change occurred.

The matching PERSONAL registration was **preexisting**, not added or removed by this cycle: **TEMPORARY_KEY_CLEANUP=NOT REQUIRED / PREEXISTING_KEY_PRESERVED**. Owner local pair and loaded agent were preserved; no new key, import, private transmission, helper or protection/host-trust bypass. Historical cleanup records below are not today's key lifecycle.

**Independent gates remain blocked:** BACKUP_AVAILABLE=NO verified checkpoint / BACKUP_PROVIDER_BLOCKER=YES; last verified inventory **2026-10-07T13:59:32.490Z**, 0 snapshots / 0 schedules, not refreshed here; cumulative creates **2 / NO_THIRD_ATTEMPT**. **EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN.** Stripe API, Stripe webhook, ADMIN_SESSION_SECRET and CRON_SECRET in staging **and production** remain **COMPROMISED / P0_OPEN / ROTATION=NO / FREEZE=ACTIVE**. All release readiness and Phase S resume remain NO. Clean history does not authorize deployment, secret activation or recovery. The support handoff was not changed or sent by Codex; owner external contact remains unverified.

Fresh Git entry local/remote HEAD **44c6fa252bc648bfb32ef83f38005f4c2eb450c8**, branch **codex/admin-dashboard-reconciled-20261002**, main **4ea73f50cafdbf67e16dc71de985052075feca42**, **38 ahead / 0 behind**. Exact all-state head/base PR query at **2026-10-07T19:06:14.456Z** returned NONE. This cycle permits only local updates to the five authorized documents, not staging/commit/push or another Git mutation; verified entry **38 / 0** is retained, with no publication or forecast count asserted.

**STOP after this audit.** Owner reconnects WARP manually; Codex performs no automatic reconnect or permanent policy change. Keep backup/config/security gates blocked; no Phase 3/4/5, migration, deploy/redeploy/restart, secret rotation or production action. Only the five authorized canonical documents may record this material evidence, with proportional documentation validation; no support-handoff churn, build or E2E.

## Historical Phase 2 / WARP A/B confirmed, owner DB window required — 2026-10-07 (17:45–17:48 UTC)

Current authority/state: [canonical Master status](../cycles/RARE_MASTER_STATUS.md), [Master log](../cycles/RARE_MASTER_LOG.md), [database gate](STAGING_DATABASE_GATE.md), and [owner-led support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; HUMAN_WARP_WINDOW_REQUIRED=YES; OWNER_WINDOW_CONFIRMATION=PENDING; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Metadata-only audit authority is already granted; an explicit owner-controlled DB access window is still required. Current WARP DISCONNECTED is not itself that confirmation.

**Owner-reported controlled A/B; execution timestamp NOT SUPPLIED:** baseline WARP CONNECTED / SSH with WARP TIMEOUT_HISTORICAL; without WARP, official Railway SSH to Rare project **72ed12be-9a2a-4e13-8594-30ffd8ffa565**, staging **d8399691-dacf-41e9-a9d5-060c97672e39**, **web rare-staging**, remote `true`, established a session and completed the command. Connection closure was expected for `true`, not an error. The owner reports WARP restored **YES at the end of that A/B test**; this does not describe a later/current audit window. This is attributed owner evidence, not a PostgreSQL or Codex-executed SQL PASS.

```text
WARP_SSH_INTERFERENCE=CONFIRMED_BY_A_B
SSH_FAILURE_LAYER=CLOUDFLARE_WARP_PATH
WARP_INTERNAL_MECHANISM=UNKNOWN
RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN
TCP_22_BLOCKER=NO
SSH_IDENTITY_BLOCKER=NO
RAILWAY_TARGET_RESOLUTION_BLOCKER=NO
POSTGRES_SSH_PASS=NOT_VERIFIED
SQL_EXECUTED=NO
```

The NO blocker classifications describe the owner-reported successful web comparison, not universal connectivity or PostgreSQL/runtime/database proof. The owner also reports adding `ssh.railway.com` to `known_hosts` on first access (first-use TOFU); a root read-only check at **2026-10-07T17:45:59.956Z** found the entry present. Neither proves independent host-fingerprint pinning. No host-trust bypass, fingerprint substitution or known-host/configuration write was performed by Codex.

**Separate current read-only checks:** native agent at **17:45:59.275Z** AVAILABLE, one expected ED25519 fingerprint MATCH; `warp-cli status` at **17:45:59.865Z** DISCONNECTED, with no connect/disconnect/configuration action by Codex. PERSONAL auth/key reads at **17:47:48–17:47:50 UTC** found the expected public-key registration **PREEXISTING**, not created in this cycle: preserve it, do not remove the owner's registration. Control-plane read at **17:48:49.318Z** matched exact staging PostgreSQL Service **ed0a374e-79da-4aab-9e3a-bb684fb829d1**, Service Instance **3b37cfd9-f315-40df-a8a6-35673912d346**, current RUNNING Deployment Instance **371feb81-4709-4070-a96a-d9ad854e254b**, and observed web source **4ea73f50cafdbf67e16dc71de985052075feca42**. These are metadata checks, not SSH runtime proof; dates in this paragraph are 2026-10-07 UTC.

No new SSH, SQL, READ ONLY verification, ROLLBACK, key/provider mutation, backup, rotation, configuration or production operation occurred. PostgreSQL version, all five counts and all 14 real DB migration states remain UNKNOWN; history verified NO. Previous audit registration cleanup remains historical and does not imply the current PERSONAL inventory is empty. Backup remains an independent blocker: last verified listing **2026-10-07T13:59:32.490Z**, 0 snapshots / 0 schedules, not refreshed; cumulative creates **2 / NO_THIRD_ATTEMPT**. Effective next-deploy config **NOT VERIFIED** / safe activation **NOT PROVEN**; all four affected credential categories in staging and production **COMPROMISED / ROTATION=NO**; all release readiness NO. Support remains **CODEX_NOT_SENT / OWNER_STATUS_NOT_VERIFIED**.

Next: owner explicitly confirms the temporary access window and controls WARP restoration afterward; Codex does not change WARP or create split-tunnel/policy workarounds, weaken McAfee/firewall/TLS/host trust, or touch production. Only fresh official PostgreSQL SSH and exact staging/runtime target proof may precede the approved metadata transaction: **BEGIN READ ONLY** first, local statement timeout **5000ms** / lock timeout **2000ms**, **SHOW transaction_read_only** must return **on** before metadata, otherwise ROLLBACK/ABORT. Collect approved server version and only `migration_name, checksum, started_at, finished_at, rolled_back_at`; necessary allowlisted schema metadata only if inconsistency requires it; finish with **ROLLBACK and verified session closure**. No install/app change, migration, deploy/redeploy, credential activation/rotation or Phase 3/4/5. **STOP pending explicit owner window confirmation.** Earlier dated sections are historical, not current execution authority.

## Historical Phase 2 / WARP A/B awaiting owner result — 2026-10-07 (15:11 UTC status)

Current authority/state: [canonical Master status](../cycles/RARE_MASTER_STATUS.md), [Master log](../cycles/RARE_MASTER_LOG.md), [database gate](STAGING_DATABASE_GATE.md), and [owner-led support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The next gate is the owner's A/B result plus WARP restoration confirmation, not an assumed SSH success or a new automatic retry.

**Owner-reported Railway Network Diagnostics; execution time NOT PROVIDED:** HTTP 200 / edge gru1; traceroute COMPLETED; ping loss 0%; latency about 19 ms. Reported system resolver `connectivity-check.warp-svc / 127.0.2.2` experienced timeouts before resolution; Cloudflare 1.1.1.1 lookup PASS; client egress AS13335. This is attributed owner evidence for that HTTP/network diagnostic, not independently verified SSH health or a proven WARP failure mechanism. Codex did not download/run the diagnostic tool or send support evidence.

**Separate direct local observation:** read-only `warp-cli help/status` at **2026-10-07T15:11:41.592Z** reported **CONNECTED**, with no configuration change. This does not establish WARP state during the historical SSH probes or prove that a disconnect/reconnect A/B cycle occurred.

```text
WARP_STATE_BASELINE=UNKNOWN
SSH_WITH_WARP=HISTORICAL_TIMEOUT_NOT_TIME_ALIGNED
SSH_WITHOUT_WARP=NOT_REPORTED_OR_EXECUTED
WARP_RECONNECTED_AFTER_TEST=UNKNOWN
WARP_SSH_INTERFERENCE=UNDETERMINED
RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN
```

`NOT_REPORTED_OR_EXECUTED` means no without-WARP result was provided and Codex performed no such test; it is not a claim that the owner has not tested externally. The historical timeouts are not a confirmed with-WARP A/B baseline. WARP is owner-controlled: obtain the baseline state, SSH results with/without WARP and explicit restoration confirmation. No permanent WARP change, other protection disablement, McAfee/firewall/TLS/host-trust bypass or unattended test is authorized.

No new SSH, key lifecycle, provider query/mutation, SQL, backup, credential rotation, configuration or production operation occurred in this awaiting-result cycle. The prior PERSONAL cleanup remains historical, not a fresh inventory read. PostgreSQL version, all five migration counts and all 14 DB migration states remain UNKNOWN; history verified NO. Backup/config/security gates remain blocked independently: last verified backup inventory **2026-10-07T13:59:32.490Z**, 0 snapshots / 0 schedules, not refreshed; cumulative creates **2 / NO_THIRD_ATTEMPT**; next-deploy config **NOT VERIFIED**; safe secret activation **NOT PROVEN**; all four affected credential categories in staging and production **COMPROMISED / ROTATION=NO**. All release readiness remains NO; support remains **CODEX_NOT_SENT / OWNER_STATUS_NOT_VERIFIED**.

Conditional metadata-only continuation requires official Railway SSH PASS and fresh exact staging/runtime target proof first. Then **BEGIN READ ONLY** before metadata, local statement timeout **5000ms** / lock timeout **2000ms**, and **SHOW transaction_read_only** must return **on**; otherwise ROLLBACK and ABORT. Collect only the approved server version and `migration_name, checksum, started_at, finished_at, rolled_back_at`; finish with **ROLLBACK and verified session closure**. None occurred here. No install/app change, migration, deploy/redeploy, activation or later phase is authorized. **STOP pending the owner A/B/restoration result.** Earlier dated sections below are historical and do not supersede this gate.

## Historical Case B: post-TCP official SSH timeout — 2026-10-07 (14:29–14:39 UTC)

Current authority/state: [canonical Master status](../cycles/RARE_MASTER_STATUS.md), [Master log](../cycles/RARE_MASTER_LOG.md), [database gate](STAGING_DATABASE_GATE.md), and [expanded owner-led support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; CASE=B; RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The observed failure is native SSH **after TCP establishment** across PostgreSQL service, current PostgreSQL deployment-instance, and staging web targets. The actual root cause within gateway/local route/authentication remains **UNKNOWN**; this is not a confirmed basic TCP block, target mismatch, or PostgreSQL-specific failure.

Entry documentation HEAD was **50b0a78e63f517ef5a27967190a904369ef584cb**, **35 ahead / 0 behind**; main and observed deployed web source remain **4ea73f50cafdbf67e16dc71de985052075feca42**. Managed Postgres Git SHA is not exposed. Final publication SHA/equality/counts belong to canonical closure after actual publication, not a forecast here. No PR or CI query was performed in this cycle; the **2026-10-07T13:47:33Z** no-PR result is historical, not a fresh assertion. No PR creation/retry/merge, runtime candidate deployment, or later-phase advancement occurred.

### Identity, targets and three bounded connectivity tests — UTC

At **2026-10-07T14:29:25.435Z**, the existing owner-loaded agent was **AVAILABLE**, with exactly one expected ED25519 identity / fingerprint **MATCH**. Existing owner private/.pub files remained outside the repository and unchanged; public fingerprint metadata was verified, with no key-body/passphrase output. Only the authorized matching **PERSONAL .pub** was registered at **14:30:57.484Z**, inventory **0 → 1**. No private upload, new key generation, helper, or 2FA workaround was used.

DNS **PASS** and TCP port 22 **REACHABLE** were observed at **14:31:46.034Z**. Control-plane readbacks at **14:33:51–14:33:53Z** reconfirmed Rare project `72ed12be-9a2a-4e13-8594-30ffd8ffa565`, staging `d8399691-dacf-41e9-a9d5-060c97672e39`, PostgreSQL service `ed0a374e-79da-4aab-9e3a-bb684fb829d1`, and web service `3f4b79f6-2819-45a6-986d-584dc7ac803a`, with current RUNNING deployment instances. Observed web source SHA is unchanged; managed Postgres Git SHA is not exposed. These control-plane checks do not prove SSH runtime access.

Native dry-run PostgreSQL target resolution correctly used **ServiceInstance `3b37cfd9-f315-40df-a8a6-35673912d346`** as SSH User, not the PostgreSQL Service ID. At **14:34:30.252Z**, unchanged configuration and the owner's expected IdentityFile were **MATCH**. The caller did not force `-i`; the observed native child automatically supplied `-i`. This is configuration evidence, not a successful authentication claim.

| Requested noninteractive command / target | Observed lifecycle | Result |
|---|---|---|
| `true` / PostgreSQL service | 2026-10-07T14:35:54.368Z–14:36:22.793Z | TIMEOUT; native target MATCH / TCP 22 ESTABLISHED |
| `true` / current RUNNING PostgreSQL DeploymentInstance `371feb81-4709-4070-a96a-d9ad854e254b` | 2026-10-07T14:38:17.584Z–14:38:45.952Z | TIMEOUT; native target MATCH / TCP 22 ESTABLISHED |
| `true` / staging web service | 2026-10-07T14:38:17.924Z–14:38:45.955Z | TIMEOUT; native target MATCH / TCP 22 ESTABLISHED |

Each test had a **25-second execution deadline**; the lifecycle ranges include scoped termination/closure. Only the expected audit children were terminated, and all related processes closed. No successful remote `true` execution, remote authentication, or runtime target proof was obtained. No helper/tunnel/interactive session, host-trust, AV, TLS or firewall bypass occurred; no network-diagnostic download/execution was performed.

Only this new PERSONAL registration was removed at **14:39:49.590Z**; the official readback at **14:39:52.008Z** verified an empty personal inventory. No 2FA was required. The owner files and still-AVAILABLE matching agent were preserved; no preexisting identity was deleted or changed.

### Activation remains closed / next owner gate

**WEB_SSH_PASS=NO**, so no stdin fallback, runtime module resolution, database-binding check, Prisma client construction/connection, SQL, READ ONLY verification, or ROLLBACK was executed. PostgreSQL version, all five migration counts, actual checksums/schema, and all **14 repository migration database states remain UNKNOWN**, including admin-temporary-password seed, analytics paidAt index and session-version effects. History verified **NO** / clean **UNKNOWN** / no-op **UNKNOWN** / Phase M **UNKNOWN**; no corruption or pending-migration diagnosis is established. Independent application writers were not paused or audited.

**No backup inventory was queried in this cycle.** The **2026-10-07T13:59:32.490Z** inventory of **0 snapshots / 0 schedules**, with no late snapshot visible then, is historical. No adequate checkpoint or restore has been verified; present late-arrival state was not refreshed. Cumulative creation requests remain **2; NO_THIRD_ATTEMPT**. No backup/create/retry/PITR/dump/restore/schedule/delete or Codex support transmission occurred. The materially expanded [support package](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains owner-led **READY DRAFT / CODEX_NOT_SENT / OWNER_STATUS_NOT_VERIFIED**; backend cause/outcome/cost remain unproved.

**EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN**, independently of SSH/migration history. No selector/configuration change is authorized by these observations. All four affected categories — Stripe API, Stripe webhook, ADMIN_SESSION_SECRET and CRON_SECRET — in staging **and** production remain **COMPROMISED; ROTATION=NO; FREEZE=ACTIVE**. READY FOR MERGE / STAGING / EXTERNAL HOMOLOGATION / PRODUCTION = **NO**. No application/runtime/config/variable change, deploy/redeploy/restart, migration/DDL/DML, credential rotation, commerce or production action occurred; provider writes were limited to the authorized personal .pub registration and its cleanup.

Next: the owner may review/run [Railway's network diagnostics](https://docs.railway.com/networking/troubleshooting/network-diagnostics), or obtain sanitized results from another owner-approved network, and explicitly resume Phase 2 with that evidence. Codex has not downloaded/executed that tool or sent the support draft. **STOP; no automatic retry or later-phase/Phase S continuation.** All prior dated sections below are historical; their observations and approvals do not supersede this closure.

## Historical agent-ready resume / first official SSH timeout — 2026-10-07 (13:46–13:59 UTC)

Current authority/state: [canonical Master status](../cycles/RARE_MASTER_STATUS.md), [Master log](../cycles/RARE_MASTER_LOG.md), [database gate](STAGING_DATABASE_GATE.md). **PHASE_RESULT=BLOCKED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Supplied private/.pub **%USERPROFILE%/.ssh/rare_staging_db_audit_20261007** files remain outside repository/not reparse points/unchanged. Owner manually unlocked Windows OpenSSH Agent; current agent AVAILABLE / fingerprint MATCH. Existing identity use and matching PERSONAL .pub registration were authorized. Current blocker is **SSH_ATTEMPT_TIMEOUT / SSH_RUNTIME_TARGET_NOT_VERIFIED**, not unavailable agent or a renewed passphrase request.

Fresh entry Git local=origin **192fa74ba1535648c68d50254959921b4896ff3d**, **34 ahead / 0 behind**; main **4ea73f50cafdbf67e16dc71de985052075feca42**. Explicit control-plane target readback at **2026-10-07T13:50:29.234Z** matched Rare/staging/Postgres-MlyZ IDs/names; four deployments unchanged/SUCCESS, web/worker source main SHA. Not SSH runtime proof. One exact PR query **2026-10-07 13:47:33 UTC** returned none; no PR creation/retry/merge or fresh CI check. No candidate **7a820b62bb1515f7b30ccf31badf1f0881a6bd84** runtime deployment here. Final publication counts belong to canonical status/Git, not this entry snapshot.

Native `ssh-add -l` at **2026-10-07T13:46:32.618Z** exit 0: AVAILABLE, one loaded ED25519 identity **SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw** MATCH; existing-file/public metadata reconfirmed at **13:49:26.581Z**. Personal inventory 0, only matching .pub registered/read back 1 at **13:51:18.162Z**. Normal official SSH with explicit three IDs, no caller-forced -i/tunnel/session/helper, timed out before runtime markers. Only scoped audit child terminated at **13:56:20 UTC**; remote authentication/cause unproved. No SQL, READ ONLY/ROLLBACK not executed. Only new PERSONAL registration removed at **13:57:11.794Z**, readback **13:57:14.714Z** verified empty/expected fingerprint absent; no 2FA needed. Owner files/agent untouched; no private derivation/passphrase request/read/store or key-body/credential output. Private encryption/remote signing remain unverified; earlier unavailable-agent/derivation observations are historical, not current blockers.

All 14 canonical Git/checksum references were reconfirmed, **not compared with DB history**. PostgreSQL version, all five migration counts and all 14 DB states remain UNKNOWN, including admin-temporary-password seed, analytics paidAt index and session-version migrations. History verified NO / clean UNKNOWN / no-op UNKNOWN / Phase M UNKNOWN; no integrity defect established. Only after SSH runtime-target proof may the authorized narrow READ ONLY transaction collect version/five migration fields, verify on and end with ROLLBACK; schema metadata only if history inconsistency requires it. A clean/no-op result would still not authorize redeploy or Phase S. No DB/schema writes by this audit; independent writers not paused/audited.

One current read-only backup inventory at **2026-10-07T13:59:32.490Z** returned **0 snapshots / 0 schedules**; no late snapshot visible. Backup available NO verified checkpoint / provider blocker YES / cumulative creates 2 / third request NO; recovery/workflow/cause/cost unproved. The [support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) remains READY DRAFT / OWNER_HANDLES_EXTERNALLY, unchanged here; Codex did not send it, and no owner ticket/result was supplied. Volume/stored-variable readbacks below remain historical.

**EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN** independently of migration history. Do not alter selectors/configuration here. Stripe API, Stripe webhook, ADMIN_SESSION_SECRET and CRON_SECRET in staging AND production remain **COMPROMISED; ROTATION=NO; FREEZE=ACTIVE**. Only authorized personal public-key add/remove occurred; no deploy/restart/redeploy, migration/DDL/DML, commercial-provider/backup/restore, secret/source/config/variable or production mutation. READY FOR MERGE/STAGING/EXTERNAL HOMOLOGATION/PRODUCTION=NO. STOP Phase 2, no later phase or automatic retry. Next: owner diagnosis of official staging SSH connectivity with sanitized evidence; never send key contents/passphrase or bypass host trust/AV/interaction.

## Historical official identity cycle — 2026-10-06

The following dated observations and previous execution authority are historical; the current owner's identity route and canonical status above supersede them.

**INCOMPLETE — SAFE STOP; SSH_PATH=BLOCKED; SSH_IDENTITY_HUMAN_ACTION_REQUIRED=YES. RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Removing the abandoned helper from the intended access path did not establish a usable official SSH identity or complete the audit. **MIGRATION HISTORY = KNOWN was NOT achieved.** Current evidence and next gates: [staging database gate](STAGING_DATABASE_GATE.md), [incident record](CREDENTIAL_INCIDENT_202610.md) and [owner-ready backup support draft](RAILWAY_BACKUP_SUPPORT_HANDOFF.md). Support is READY DRAFT / NOT SENT; no provider was contacted.

Entry local/origin documentation HEAD matched b9d7cbf5a47648fa0486414d0392b043b04efd29; origin/main and web/worker deployed source remained 4ea73f50cafdbf67e16dc71de985052075feca42; **30 ahead / 0 behind**. Final documentation SHA, remote equality and counts are reported at closure, not inferred here. One fresh exact head/base PR query returned `issues: []`; no PR exists in that result, no creation attempt/retry or merge was performed, and the known PR_CREATION_BLOCKED_BY_PERMISSION remains. This is not green CI.

### Official identity discovery — actual observations

| Time / scope | Sanitized result |
|---|---|
| 2026-10-06T20:39:30.516Z — Railway CLI 5.26.0 personal `ssh keys list` | Exit 0; personal registered inventory verified empty. No workspace inventory claim. |
| Existing local `.ssh` inventory | 1 file; 0 public-key candidates; 0 private-key candidates. No private body, key comment/email or full public key disclosed. |
| 2026-10-06T20:41:35.258Z — native `ssh -G` metadata | 7 configured identity paths; 0 existing private-key files. This was configuration inspection, not an SSH connection. |
| Existing agents | `ssh-add -l` exit 2 / agent unavailable; 0 returned agent keys. Native agent Stopped and not started; SSH_AUTH_SOCK absent; Pageant not running. |
| Authentication scope | RAILWAY_API_TOKEN and RAILWAY_TOKEN environment variables absent; existing personal login/default context used, not a new token. |
| 2026-10-06T20:42:26.595Z — official `gitHubSshKeys` metadata query | HTTP 200 / GraphQL INTERNAL_SERVER_ERROR; no key metadata obtained. Linked GitHub-key availability UNKNOWN, not zero. No ACL, permission or root cause was proved by the generic error. |

The [official CLI v5.26.0 import implementation](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/keys.rs#L404) imports one unregistered GitHub key automatically when only one is returned, prompts among multiple keys with a TTY, or selects the first without a TTY. It does not establish possession of a matching private key; this variant has no explicit `--key` selector. **IMPORT_CLI_EXECUTED=NO**: importing merely to try, without an available matching private identity, was not justified. No token hunt, new authentication mechanism, import/add/delete/create/copy/move of keys or change to preexisting keys occurred. Removals are NOT APPLICABLE.

### Helper disposition / evidence boundary

QUARANTINED_HELPER=ABANDONED; HELPER_TRUST=UNKNOWN. The earlier exact ASKPASS helper has five recorded McAfee events in family **Real Protect-LS**, with QUARANTINED status. Recorded event timestamps have no timezone offset and must not be converted to UTC by assumption; no helper file hash was measured. The record does not prove a false positive or maliciousness. No restore, trust approval, execution, recompile, rename, replacement helper/new executable, antivirus setting/exclusion change or unencrypted-key generation was performed in this cycle.

The legacy helper quarantine persists; a general native SSH/Railway antivirus block is **NOT ESTABLISHED**. The current audit blocker is absence of an available official identity. Abandoning that helper is neither proof that endpoint security is resolved nor proof that official SSH connected. **SSH_EXECUTED=NO; SQL_EXECUTED=NO; READ_ONLY_MODE=NOT VERIFIED; ROLLBACK=NOT EXECUTED**; no database session existed.

### Current target / backup / migration gates

API target identity was reverified at **2026-10-06T20:41:33.034Z**: Rare project 72ed12be-9a2a-4e13-8594-30ffd8ffa565; staging environment d8399691-dacf-41e9-a9d5-060c97672e39; Postgres-MlyZ service ed0a374e-79da-4aab-9e3a-bb684fb829d1; intended SSH service instance 3b37cfd9-f315-40df-a8a6-35673912d346; volume a0b78a5e-0dec-40ab-9d8c-c298be29ca5d; volume instance c5910985-a38a-479b-9274-e65ec6753c77. No production target was selected. SSH runtime identity is NOT VERIFIED. PG volume remains READY / 5000 MB capacity / **187.547648 MB used** (prior 187.531264 MB); this is storage metadata, not DB size. Region UNKNOWN. All four staging deployments remain SUCCESS and unchanged; web/worker retain 4ea73f50cafdbf67e16dc71de985052075feca42.

The final backup **read only** at 2026-10-06T20:43:01.586Z returned **0 snapshots / 0 schedules**; no delayed backup was visible then. Cumulative creation requests remain **2; NO_THIRD_ATTEMPT**; current provider writes **0**. BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; RESTORE_DRILL_VERIFIED=NO; BACKUP_PROVIDER_BLOCKER=YES; TRACE_ID=NOT_AVAILABLE in retained sanitized evidence. Backend outcome, cause and cost remain UNKNOWN. No snapshot or zero-cost guarantee is inferred; no backup/create/restore/schedule/delete/resize was attempted in this cycle.

Actual PG version, applied/pending/failed/rolled-back counts, DB checksums and schema are **UNKNOWN**. All 14 repository migration states remain UNKNOWN, specifically including `admin_temporary_password`, analytics-index and session-version application/effects. STAGING_MIGRATION_HISTORY_VERIFIED=NO; STAGING_MIGRATION_HISTORY_CLEAN=UNKNOWN; MIGRATE_NOOP=UNKNOWN; PHASE_M_REQUIRED=UNKNOWN; MIGRATION_BLOCKER=YES due to missing evidence, not identified corruption. EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED and SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN remain independent gates. The earlier stored single-executor/predeploy evidence below is historical; no new effective-config read or mutation was performed here.

All four affected credential categories remain COMPROMISED; ROTATED=NO; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO; READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. No runtime/source/config/variable change, deploy/restart, migration/DDL/DML, credential rotation, commercial-provider/commerce or production action occurred. Next: legitimate owner provision/selection of an already approved personal identity with its available Windows private key and linked-GitHub metadata availability review, plus owner submission of the ready support draft. Proposed unsent subject: **Manual volume backup returns INTERNAL_SERVER_ERROR with no snapshot created**. No automatic key generation, antivirus change, third backup, SQL continuation or Phase S resumption follows this incomplete safe stop.

## Historical backup reconciliation / trusted audit ABORT — 2026-10-06

This previous cycle records the helper-based local abort and second/final backup request. It is superseded by the official identity cycle above; its current-endpoint-blocker wording, configuration readbacks and next-step proposals are historical, not new official SSH/SQL evidence or authority.

**ABORT; BACKUP_PROVIDER_BLOCKER=YES; ENDPOINT_SECURITY_BLOCKER=YES; MIGRATION_BLOCKER=YES. RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The [staging database gate](STAGING_DATABASE_GATE.md) contains the current execution record; the [Railway backup support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) is a sanitized draft only, **SUPPORT_NOT_CONTACTED**. This cycle did not complete trusted SQL access or obtain a verified backup. All affected staging/production credentials remain **COMPROMISED**, rotated **NO**; all release readiness remains **NO**.

Entry local/origin documentation HEAD matched 30104ad071bac4df6c0b31524358c262f5b33b25; main remained 4ea73f50cafdbf67e16dc71de985052075feca42; **29 ahead / 0 behind**. Final Git publication is reported separately, not embedded as a self-referential final HEAD.

### Current authority and exact target

The latest owner instruction authorized one **second and final** backup request only after a fresh empty inventory, plus trusted metadata-only SQL **irrespective of backup success**. The prior checkpoint-before-SSH condition is historical and does not govern this cycle. Neither permission authorized Phase M/S/P, rotation, migration, deployment, restart, restore or endpoint-security bypass. No third backup attempt is authorized.

Target IDs were reverified: Rare project 72ed12be-9a2a-4e13-8594-30ffd8ffa565; staging d8399691-dacf-41e9-a9d5-060c97672e39; Postgres-MlyZ service ed0a374e-79da-4aab-9e3a-bb684fb829d1; service instance 3b37cfd9-f315-40df-a8a6-35673912d346; volume a0b78a5e-0dec-40ab-9d8c-c298be29ca5d; volume instance c5910985-a38a-479b-9274-e65ec6753c77. Service-instance and volume-instance IDs are distinct.

### Backup outcome — second and final request

Fresh inventory at 2026-10-06T17:30:27.210Z showed 0 snapshots / 0 schedules, with no late backup from the first attempt observed. The separately authorized second request at 2026-10-06T17:30:46.574Z returned HTTP 200 / INTERNAL_SERVER_ERROR without a usable workflow ID. Readbacks at 2026-10-06T17:30:48.048Z, 2026-10-06T17:32:38.169Z and 2026-10-06T17:52:44.877Z each showed 0 snapshots / 0 schedules. Cumulative creation requests across both authorizations: **2; NO_THIRD_ATTEMPT**.

TRACE_ID=NOT_CAPTURED: no correlation ID is available in sanitized evidence; the initial parser did not cover all possible locations, so raw-response absence is not asserted. BACKUP_AVAILABLE=NO verified backup; STAGING_BACKUP_VERIFIED=NO; backend outcome and cost UNKNOWN. The provider blocker is an operational result, not proof of a structural, permission, quota or billing cause. Empty readbacks do not prove no internal work or no possible later snapshot. No restore, schedule change, delete/lock, PITR enable or dump was performed.

### Trusted access outcome — independent endpoint-security abort

Local temporary key-generation validation rejected transient key pairs; no validated usable key was obtained. All transient pairs were removed, without deleting any preexisting key. The personal Railway key inventory was 0 before and after: **KEY_REGISTERED=NO; REMOTE_KEY_ABSENCE_VERIFIED=YES; REMOTE_KEY_DELETE=NOT APPLICABLE; LOCAL_TEMP_KEY_CLEANUP=YES**.

Sanitized McAfee log evidence confirmed the helper was **QUARANTINED**, with five related events. **ENDPOINT_SECURITY_BLOCKER=YES.** No quarantine restoration, antivirus bypass/exclusion, unencrypted-key fallback or alternative access workaround was used. SSH_SQL_EXECUTED=NO; the planned READ ONLY transaction and ROLLBACK were **NOT EXECUTED**. This abort was not caused by applying the old backup prerequisite.

PostgreSQL version, actual migration applied/pending/failed/rolled-back counts, database checksums, checksum match and actual schema remain **UNKNOWN**. STAGING_MIGRATION_HISTORY_VERIFIED=NO; STAGING_MIGRATION_HISTORY_CLEAN=NOT VERIFIED; MIGRATE_NOOP=UNKNOWN; PHASE_M_REQUIRED=UNKNOWN. MIGRATION_BLOCKER=YES means missing trustworthy history/schema evidence, **not confirmed corruption or a discovered failed migration**.

### Current configuration and next decision

Fresh stored configuration still has web predeploy `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`; worker/PG/Redis predeploy NONE. CURRENT_STORED_MIGRATION_EXECUTOR_COUNT=1, with advisory locking disabled; FUTURE_MIGRATION_EXECUTOR_COUNT=UNKNOWN. Web/worker selectors and root directories remain null; September 25 resolved snapshots retain empty manifests. EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN. Current stored/snapshot evidence does not certify the next deployment or a migration-free activation path.

Next: owner/provider triage of the two backup requests using the draft handoff, and legitimate owner review of endpoint quarantine/trusted SSH access. **No automatic backup retry, quarantine reversal, key registration or access retry follows from this dossier.** No current SQL success, no-op migrate, recovery proof, Phase M requirement or Phase S readiness is asserted. No source/predeploy/selector/variable/commerce/production change or credential rotation was performed. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO.

Everything below is historical evidence or conditional analysis, including earlier checkpoint requirements, backup proposals and Phase S approvals. It is not current execution authority; the current cycle and explicit owner direction above take precedence.

## Historical first recovery attempt — 2026-10-06

**MANUAL_BACKUP_FAILED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Historical execution record: [STAGING_DATABASE_GATE.md](STAGING_DATABASE_GATE.md). Owner then authorized exactly one staging PG backup and conditional temporary personal SSH/metadata access after availability, not Phase M/S/P. All target IDs were matched. One volumeInstanceBackupCreate request at 2026-10-06T16:52:38.126Z returned HTTP 200 / INTERNAL_SERVER_ERROR without workflowId; three subsequent listings showed 0 snapshots / 0 schedules, last at 16:55:22.004Z. BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; backend outcome/cost UNKNOWN. No second create or retry in that first attempt.

No key generated/registered, SSH or SQL: the backup prerequisite failed. Migration counts, version and schema remain UNKNOWN; STAGING_MIGRATION_HISTORY_VERIFIED=NO; PHASE_M_REQUIRED=UNKNOWN. Stored web predeploy and worker NONE reverified; selectors still null, old resolved manifests empty. EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN. Latest staging deployments/mount/state unchanged in readback. No runtime/source/config/variable/production change, rotation, migration or restore performed; credentials remain COMPROMISED.

The earlier backup authorization proposal below is historical: current authority was used for one request, not an unbounded retry. Recommended next decision is owner/provider triage and read-only outcome reconciliation, then fresh exact authority for any additional creation attempt. Keep freeze; do not advance to SSH/Phase S without the checkpoint. One PR search still absent; no creation retry. Only five requested docs change; final validation/Git publication results are reported at closure.

## Historical read-only investigation — superseded execution snapshot

Everything below records the previous cycle, including its no-backup-create and MANUAL_BACKUP_AUTHORIZATION_REQUIRED statements. It is retained as dated evidence/conditional analysis, not the current execution result or authorization. Refer to the current recovery record above for this cycle.

Assessment: 2026-10-06. **READ-ONLY investigation; RELEASE_SECURITY_FREEZE=ACTIVE. PHASE_S_CAN_RESUME=NO.** This instruction supersedes execution authority for this cycle: do not resume the previous conditional Phase S attempt. No credential creation, rotation, revocation, config change, deploy, restart, migration, backup creation/restore or provider side effect was performed. Existing sensitive local copies/evidence were preserved.

## Current incident state

All four affected credential categories remain **COMPROMISED** pending independently verified cutover/retirement in staging and production. Presence or difference from production is not revocation proof. [Incident record](CREDENTIAL_INCIDENT_202610.md); [rotation approval package](CREDENTIAL_ROTATION_APPROVAL.md); [release readiness](../PRODUCTION_READINESS.md).

| Gate | Decision | Evidence boundary |
|---|---|---|
| STAGING_MIGRATION_HISTORY_VERIFIED | NO | TLS trust failure; no migration metadata retrieved |
| STAGING_BACKUP_VERIFIED | NO | Backup/schedule inventories verified empty; no adequate checkpoint/recovery proved |
| SAFE_SECRET_ACTIVATION_PATH | NOT PROVEN | Restart variable refresh unproved; redeploy retains predeploy risk |
| EFFECTIVE_NEXT_DEPLOY_CONFIG | NOT VERIFIED | Explicit selectors absent; snapshot is not next-deployment proof |
| PHASE_S_CAN_RESUME | NO | Unknown migration state, no verified backup/recovery, ambiguous next config |
| Chosen activation path | NONE | No experiment on staging; no replacement staged |

Repository raredept/rare; branch codex/admin-dashboard-reconciled-20261002. Re-fetched entry local/remote documentation HEAD 4b78a32623958dd8b0ed36b530a08df08e7c0639; main 4ea73f50cafdbf67e16dc71de985052075feca42; **27 ahead / 0 behind**. Final documentation HEAD/count are reported after push, not embedded self-referentially. Runtime candidate 7a820b62bb1515f7b30ccf31badf1f0881a6bd84 and future staging checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518 remain frozen/not deployed.

One all-state exact head/base PR search returned no PR. No creation retry: PR_CREATION_BLOCKED_BY_PERMISSION remains the earlier failure. Entry SHA individual statuses and PR-triggered Actions runs returned empty; public REST independently reported 0 entry check-runs and 0 repository Actions runs. That is not PASS and not proof about every external CI provider. Final SHA results are reported after publication. No workflow was triggered manually.

## Railway variable semantics

Installed CLI **5.26.0** supports variable set --skip-deploys and private stdin input. This can store a variable change without deployment; it does not refresh an existing process. Stored configuration and Railway's separate staged-change mechanism are not interchangeable activation evidence. No variable-setting command was executed.

- [Restart](https://docs.railway.com/cli/restart) reuses the deployment image without rebuild. No explicit guarantee was found that it loads newly stored/staged secrets. RESTART_SECRET_ACTIVATION=NOT PROVEN.
- [Redeploy](https://docs.railway.com/cli/redeploy) documents applying variable changes. Standard redeploy is not a same-image/no-DDL guarantee. The [predeploy command](https://docs.railway.com/deployments/pre-deploy-command) runs before application startup.
- [Skipped builds](https://docs.railway.com/builds/skipped-builds) can reuse an image with runtime variables, but predeploy still runs; Deployments-tab redeploy always rebuilds. Build skipping alone does not suppress migrations.
- [Config precedence](https://docs.railway.com/config-as-code/reference): environment-specific code config > base code config > service settings. Default discovery looks for railway.toml/railway.json. Worker railway.cron.json requires explicit selection, not merely file existence. Current docs deprecate Config as Code and retain legacy services until 2026-12-01; eligibility/resolution must be verified, not inferred or migrated in this incident.

Public CLI [redeploy implementation](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/redeploy.rs) uses deploymentRedeploy(id); --from-source is a different latest-source operation and is not approved here. [Public service API](https://docs.railway.com/integrations/api/manage-services) supports commitSha pinning; neither that nor usePreviousImageTag proves same image + changed settings + skipped predeploy. No installed CLI skip-predeploy flag or documented equivalent API override was found in the examined operations.

## Current staging deployment semantics / predeploy origin

Explicit Rare project 72ed12be-9a2a-4e13-8594-30ffd8ffa565; staging environment d8399691-dacf-41e9-a9d5-060c97672e39. Authentication used the existing CLI session only; read-only HTTPS GraphQL queries were captured privately and emitted through an allowlist. No OAuth refresh/new token/access workaround was deliberately performed. Raw variables/configuration, credentials, recipients and connection details were not printed or saved.

| Field | Web: rare-staging | Worker: rare-checkout-worker-staging |
|---|---|---|
| Service ID | 3f4b79f6-2819-45a6-986d-584dc7ac803a | 2bfcf6af-11f4-459f-9089-a841ae25e57f |
| Current successful deployment | 3e4874f3-397c-47fa-be77-73d1b0089ceb | d254cbc1-5f91-49ba-a866-1f596ae5151a |
| Current source SHA | 4ea73f50cafdbf67e16dc71de985052075feca42 | same |
| Stored source branch | integration/pre-go-live | integration/pre-go-live |
| Stored predeploy | PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy | NONE |
| Effective snapshot predeploy | same migration command | NONE |
| Explicit railwayConfigFile selector | null / absent | null / absent |
| rootDirectory | null | null |
| resolvedFileConfig.configFile | null | null |
| resolvedFileConfig.fileManifest / snapshot fileServiceManifest | empty object / empty object | empty object / empty object |
| Resolution timestamp | 2026-09-25T12:25:57.270Z | 2026-09-25T12:25:57.266Z |
| Current predeploy attribution | DEPLOYMENT SNAPSHOT proves command; exact DASHBOARD/file origin UNKNOWN | No current predeploy; exact config origin UNKNOWN |
| File used by NEXT deployment | UNKNOWN / NOT VERIFIED | UNKNOWN / NOT VERIFIED |

Live API serviceInstance and environment.config(decryptVariables:false) confirm the stored values. resolvedFileConfig ties the empty file manifest to the same deployed SHA/deployment ID; opaque propertyFileMapping strings do not have a verified public semantic contract. Null/empty is **not proof that code config is disabled**. No current Dashboard/file attribution was invented from matching commands.

At deployed SHA, candidate and entry HEAD, [railway.json](../../railway.json) contains the migration predeploy; [railway.cron.json](../../railway.cron.json) contains worker start and no predeploy. Next web/worker file resolution cannot be certified from the old snapshot. A default file lookup could introduce web config into the worker. The current worker start remains npm run checkout:worker, no cron schedule; no source/selector/predeploy/commerce flag was changed.

## Activation options evaluated

These are documented capabilities or unresolved proposals, **not operations performed or authorization**.

| Option / path | New env loaded | Runs build | Runs predeploy | Code changes | DDL / DB risk | Supported / decision |
|---|---|---|---|---|---|---|
| A — stored variables + restart | NOT PROVEN | NO | Fresh execution not explicitly established | NO, existing image | Activation itself unproved; ordinary runtime writes still possible | Restart supported; no-DDL secret path NOT PROVEN |
| B — stored variables + redeploy | YES, documented | Standard redeploy rebuilds; do not rely on caching | YES if effective command remains | Same source possible; rebuilt image is not identical-artifact proof | DDL/DML possible with unknown history; runtime side effects | SUPPORTED, but NOT SAFE here |
| C — temporary predeploy override + redeploy same artifact | Variable application documented; complete path unproved | Standard redeploy rebuilds | UNKNOWN after override/resolution; code may restore command | Source need not change, but identical image unproved | Migration could still execute | Settings capability exists; no-DDL path NOT PROVEN |
| D — dedicated maintenance/service activation | Does not automatically update existing consumers | Depends on new path | Depends | New resource/config/runtime path may be needed | New resources and effects; not in current scope | No existing applicable safe path proved |
| E — deployment/API skip-predeploy override | UNKNOWN | UNKNOWN | No documented skip guarantee found | UNKNOWN | UNKNOWN | NOT PROVEN; do not invent a flag/API |
| F — skipped build / previous-image mechanism | Runtime variables documented for supported caching | Can skip in supported cases | YES, caching does not skip predeploy | Previous image possible; API flag alone not complete proof | Current migration risk remains | Capability supported; no-DDL path NOT PROVEN |

No examined path was proved to satisfy all required properties: replacements active on every web/worker consumer, approved existing source/runtime, no migrate deploy/DDL/DB effects, unchanged branch/commerce/production, forward-safe recovery and subsequent old-secret retirement.

### Temporary override questions

| Question | Finding |
|---|---|
| Can predeploy be blank/disabled? | Official JSON schema accepts string/array/null and docs describe clearing it. Syntactic acceptance is not effective next-deploy proof. |
| Can config changes be staged? | CLI environment edit --stage uses environmentStageChanges; ordinary edit commits. Neither was executed. |
| Will redeploy use the changed predeploy on the same image? | NOT PROVEN for this existing deployment; default CLI rebuilds, and settings/snapshot resolution remains unresolved. |
| Can code config override it again? | YES under documented precedence if /railway.json is applied. Clearing Dashboard alone is insufficient. |
| Can original stored predeploy be restored without activation? | Schema exposes committing staged patches with skipDeploys. Full restoration/effective-next behavior NOT PROVEN; no automatic restoration was attempted. |

No local fixture can establish an undocumented backend contract. No disposable external resource, clone or paid environment was created. SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN; chosen path NONE.

## Database access / migration history

Dedicated staging PG Postgres-MlyZ: ed0a374e-79da-4aab-9e3a-bb684fb829d1. In-memory credential-free host/port/database identity comparisons confirm web + worker match this PG and differ from production. No production SQL connection was attempted.

Safe alternatives exhausted within existing authority:

1. Local PostgreSQL 16 psql exists, but [CLI connect v5.26.0](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/connect.rs) passes the full credentialed connection URL as client argv and does not impose verified TLS. The preferred interactive flow was not invoked unsanitized; no tunnel-only shortcut was used.
2. DATABASE_PUBLIC_URL was missing. Read-only tcpProxies query found exactly one existing staging PG proxy targeting port 5432. Its endpoint and credentials stayed private in memory; no proxy/domain was created.
3. Existing installed node-postgres client attempted that proxy with explicit ssl.rejectUnauthorized=true and normal hostname verification, no connectionString SSL override. **BLOCKED: SELF_SIGNED_CERT_IN_CHAIN.** No SQL was sent: connection failed before BEGIN READ ONLY.
4. Noninteractive Railway SSH, with explicit staging PG target and a fixed migration-metadata-only read-only command, failed **NO_EXISTING_SSH_KEY** before remote execution. [CLI SSH](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/native.rs) cannot register a key in this noninteractive failure path. No key generated/registered/imported and no tmux/session installation.

READ_ONLY_DB_ACCESS_BLOCKED. Credentials exposed NO; TLS weakened NO. No leaf certificate was promoted to a trusted CA, no sslmode=disable/rejectUnauthorized=false, no migrate status/deploy/dev/reset/resolve/db push. Migration records, version, DB/table sizes, indexes/columns and activity are **UNKNOWN**. Earlier rare_dev state is not evidence for staging.

Future trusted access should run a bounded BEGIN READ ONLY transaction with local statement/lock timeouts and only migration metadata (name, checksum, started_at, finished_at, rolled_back_at), then ROLLBACK. No application rows or migration logs column. Compare checksum to the **deployed Git blob**, not raw Windows worktree bytes: four files have CRLF locally while deployed blobs use LF.

## Repository migrations / conditional risk manifest

Repository has **14 migrations**. Migration tree 11c03eabb2bff269b92304e893bbdabfe6c39d1e and Prisma schema blob 12ff8ba2b3c6898c21de33fc0b0b05c8cf46b82d are identical at deployed source, runtime candidate and entry documentation HEAD. No new migration relative to deployed source does **not** establish database application.

Staging APPLIED=UNKNOWN; PENDING=UNKNOWN; FAILED=UNKNOWN; ROLLED_BACK=UNKNOWN. Each row below has staging state **UNKNOWN**, not asserted PENDING. Exact pending SQL manifest must be narrowed only after trusted history/checksum/schema evidence. SQL summaries are sanitized from the real files; no SQL was executed.

| Migration | Staging state | SQL operations, sanitized | Lock / rewrite / conditional risk |
|---|---|---|---|
| 20260511210000_init | UNKNOWN | public schema, 4 enums, 10 tables, 20 indexes, 12 FKs | Bootstrap/constraint locks; HIGH if existing schema diverges; no automatic baseline |
| 20260512013000_v1_5_customers_orders | UNKNOWN | Customer/CustomerAddress; 7 Order columns, indexes, FKs | ACCESS EXCLUSIVE on ALTER; ordinary Order indexes block writes; HIGH if pending |
| 20260512053542_v1_6_shipping_base | UNKNOWN | Order/Product/StoreSettings columns | ALTER locks; constant-default fast path PG11+ conditional; MEDIUM |
| 20260515120000_v1_7_7_home_banners | UNKNOWN | HomeBannerSlide table + indexes | New-object DDL; LOW/MEDIUM conditional |
| 20260520090000_v1_7_12_featured_sort_order | UNKNOWN | Product nullable column + index | ALTER lock, ordinary index write blocking; MEDIUM |
| 20260524170000_v1_7_14_shipping_quote_snapshot | UNKNOWN | Order nullable JSONB column | ALTER lock; no expected heap rewrite; MEDIUM |
| 20260606182000_operational_evidence | UNKNOWN | OperationalEvidence table + indexes | No evidence-row backfill; LOW/MEDIUM conditional |
| 20260709120000_admin_sale_notifications | UNKNOWN | Admin notification/push tables, indexes, Order/User FKs | Referenced-table FK locks; no provider notification SQL; MEDIUM |
| 20260710120000_first_order_coupon | UNKNOWN | Order nullable coupon / constant-default discount | ALTER locks; PG11+ no expected physical rewrite; MEDIUM |
| 20260907150000_admin_temporary_password | UNKNOWN | User columns + unique index + conditional Admin seed INSERT | **Not DDL-only**: data/auth effect; account/hash literals omitted; HIGH |
| 20260907230000_payment_email_outbox | UNKNOWN | Email enum/outbox table, indexes, Order FK | FK locks; no email enqueue/send SQL; MEDIUM |
| 20260913120000_storefront_media_checkout_deadline | UNKNOWN | Order/settings/banner ALTERs; job/media tables, indexes/FK | Multiple ALTER locks, ordinary banner index; no old-order job backfill; MEDIUM/HIGH |
| 20260920120000_analytics_paid_at_index | UNKNOWN | Two IF NOT EXISTS indexes on Order/OrderItem | Not CONCURRENTLY; blocks writes while building; no heap rewrite/backfill; HIGH if large/busy |
| 20260921120000_session_version | UNKNOWN | User/Customer INTEGER NOT NULL DEFAULT 0 sessionVersion | PG11+ constant default normally avoids rewrite but ACCESS EXCLUSIVE still required; HIGH auth/lock impact |

No explicit BEGIN/COMMIT, CONCURRENTLY, lock_timeout or statement_timeout in these SQL files. Do not infer global atomicity or automatic recovery. IF NOT EXISTS is not proof of an existing index's definition/validity. PostgreSQL references: [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html), [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), [locks](https://www.postgresql.org/docs/current/explicit-locking.html). Actual staging engine version/size/duration remain unknown; no estimate in seconds is defensible.

## Backup inventory / restore status

Read-only live API query resolved the exact **volume instance**, not just volume ID:

| Item | Current evidence |
|---|---|
| PG volume ID | a0b78a5e-0dec-40ab-9d8c-c298be29ca5d |
| Staging PG volume instance ID | c5910985-a38a-479b-9274-e65ec6753c77 |
| Mount / state | /var/lib/postgresql/data / READY; no pending deletion |
| Capacity / current used | 5000 MB / 187.531264 MB; volume allocation, **not pg_database_size** |
| volumeInstanceBackupList | Successful response, **0 existing snapshots** |
| volumeInstanceBackupScheduleList | Successful response, **0 schedules** |
| Latest backup / retention / lock | NONE / no configured schedule retention / NOT APPLICABLE for empty inventory |
| PITR | WAL_ARCHIVE_BUCKET MISSING; functional archive health/window UNKNOWN, no recovery proof; NOT VERIFIED |
| Logical dump | UNKNOWN; no verified staging dump/checkpoint/retention artifact was provided or created |
| BACKUP_AVAILABLE | NO verified adequate staging backup; volume snapshots specifically absent; other types UNKNOWN |
| RESTORE_DRILL_VERIFIED | NO; no historical proof provided, no restore attempted |
| STAGING_BACKUP_VERIFIED | NO; backup suitability/recovery gate remains closed |

[Railway volume API](https://docs.railway.com/integrations/api/manage-volumes) supports listing/creation/restoration. [Backups](https://docs.railway.com/volumes/backups) are scoped to a project/environment; restore changes mounts/staged deployment and ultimately redeploys. [PITR](https://docs.railway.com/volumes/point-in-time-recovery) configuration/capability is not archive health or restore proof. No PITR enable, dump, backup create/lock/delete, schedule change, bucket write or restore occurred. Snapshot existence and tested recovery must remain separate gates.

**MANUAL_BACKUP_AUTHORIZATION_REQUIRED.** Exact proposed future operation: create one manual Railway volume snapshot of instance c5910985-a38a-479b-9274-e65ec6753c77, attached to staging PG ed0a374e-79da-4aab-9e3a-bb684fb829d1 in environment d8399691-dacf-41e9-a9d5-060c97672e39/project 72ed12be-9a2a-4e13-8594-30ffd8ffa565. Public API operation volumeInstanceBackupCreate(volumeInstanceId: ...) or the same PG Backups UI action; **NOT EXECUTED**. Approve cost/window/retention and database-consistent recovery requirements first. After authorized creation, verify backup ID/timestamp/expiry and suitability; it is still not a restore drill. Any restore test needs separate exact target/resource/cost/data-handling authority; Railway same-environment restore must not replace the working PG silently.

## Single executor / residual DB risk

All four staging stored service configs were read: web migration predeploy; worker/PG/Redis NONE. **CURRENT_STORED_MIGRATION_EXECUTOR_COUNT=1**. Effective web/worker snapshots agree. **FUTURE_MIGRATION_EXECUTOR_COUNT=UNKNOWN**, until next config and alternative/manual executors are controlled; configured replicas are not executor election.

Advisory locking is **DISABLED** by the web predeploy command. Required future operational freeze: one explicitly authorized web migration promotion, no second/concurrent deploy, no manual migrate, no worker/alternate executor, verified explicit effective selectors and reviewed recovery window. Worker must stay predeploy NONE. Existing runtime jobs/webhooks can still write data independently of this migration freeze; no processing/commerce pause was performed or inferred from checkout settings.

DDL pending UNKNOWN; zero pending **not proved**. Overall operational risk **HIGH** given history/trust/backup/next-config gaps and the conditional Admin seed DML. If trusted metadata eventually proves PENDING=0 with matching checksums/no failed history/schema drift, a controlled redeploy/no-op migrate proposal may be evaluated separately; no-op expectation is not a current execution permission or identical-image guarantee.

## Phase S resume decision / next authorization

**PHASE_S_CAN_RESUME=NO.** Rotation performed NO; credentials still compromised YES. No current authority to create replacements or mutate staging/production. Release freeze remains active. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO.

| Next decision | Readiness |
|---|---|
| Option A — secret rotation via proved no-DDL path | NOT PROVEN / not ready for authorization: activation/config/same-runtime proof missing |
| Option B — separately authorize Phase M, then Phase S | CONDITIONAL ONLY: requires trusted history, exact pending manifest, adequate checkpoint/recovery and effective single executor |
| Option C — resolve access/backup/config evidence, keep freeze | **RECOMMENDED NOW** |

NEXT_AUTHORIZATION_PROPOSAL: Option C. Owner provides a legitimate CA/hostname trust chain or an explicitly authorized already-registered Railway SSH identity, then repeat metadata-only SQL. No new public DB exposure or TLS bypass. Independently authorize the exact manual backup operation above and a recovery-proof plan. Obtain effective next-deploy config proof for web AND worker, with current source pinned; do not mutate config merely to discover semantics. No Phase S or candidate promotion included in this proposal.

### MIGRATION_AND_ROTATION_COMBINED_GATE — conditional proposal, NOT APPROVED

If no supported no-DDL activation path can be proved, separate the future decisions internally:

1. **Phase M — staging migration:** trusted history/checksums + schema metadata; verified backup/recovery; approve exact pending SQL/lock/data effects and window; confirm effective web-only executor; quiescence/reconciliation explicitly authorized; execute only exact approved staging operation, verify history/schema before continuing. If pending=0, document that exact evidence and evaluate the controlled no-op predeploy risk instead of claiming migrations were run.
2. **Phase S — staging credential rotation:** only after Phase M/gates pass and a new explicit Phase S instruction. Keep existing compatible source, coordinate every consumer/provider overlap/session logout/caller inventory, activate replacements through a reviewed configuration, verify, then retire compromised secrets. No implicit permission to enable commerce, send email, create transactions, change cron or touch production.

Proposed affected services: staging web + worker only; PG touched only in separately authorized Phase M/backup. Config changes NONE in current cycle; any future predeploy/selector/maintenance delta must name exact old/new values and restoration without accidental deploy. Expected downtime UNKNOWN until approved processing/lock/cutover window. Recovery must be forward-safe: preserve orders/session counters/migration history and uncompromised replacements; never restore exposed secrets through native rollback, silently drop columns/indexes or restore over later writes. Verify all consumers, DB history/schema and backup/recovery independently.

Abort: DB target mismatch/production selected, trust bypass or credential output, ambiguous history/backup/config, failed/partial migration, multiple executors, source/image drift, uncontrolled provider/runtime effects or incomplete consumer cutover. Stop before mutation on any unresolved prerequisite.

## Validation / stop

Only documentation is changed in Git. git diff --check PASS. release:guard: 6 OK / 1 unchanged legacy Vercel cron warning / 0 FAIL; 321 source/document files and 43 existing browser-bundle files checked. Four changed docs: 4 configured credential categories checked privately, zero exact/pattern hits, 22 relative links valid, zero unbalanced fences. Bounded repository/history/artifact scan: 508 current versionable files, 209 reachable commits / 1,719 text blobs; zero exact currently configured affected credential matches in current versionable files/reachable text history. Existing fixture/other candidates and local sensitive copies remain triage evidence, not cleared by this scan; binary/encoded/unreachable/external surfaces remain outside coverage. No raw incident record replay or remote log/provider scan added. No full E2E, build, database migration/status, provider transaction or activation experiment. Railway/Postgres guidance informed private allowlisted diagnostics, strict trust, short read-only transaction design and executor/recovery boundaries; storefront guidance kept commercial/provider effects out of scope.

Stop after documentation commit/push and report. This dossier records unresolved gates honestly; it does not assert the missing migration history/recovery proof was obtained and does not authorize a subsequent operation.
