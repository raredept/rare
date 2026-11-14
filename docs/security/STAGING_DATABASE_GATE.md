# RARE — staging database & recovery gate

## Current Phase 2 / DATABASE HISTORY VERIFIED, INDEPENDENT GATES BLOCKED — 2026-10-07

Canonical current state: [RARE_MASTER_STATUS.md](../cycles/RARE_MASTER_STATUS.md); events: [RARE_MASTER_LOG.md](../cycles/RARE_MASTER_LOG.md). **CURRENT_PHASE=2; DATABASE_GATE=PASS; PHASE_RESULT=DATABASE_VISIBILITY_VERIFIED_RECOVERY_BLOCKED; STAGING_MIGRATION_HISTORY_VERIFIED=YES; MIGRATION_HISTORY_CLEAN=YES; MIGRATE_DEPLOY_EXPECTED_NOOP=YES; PHASE_M_REQUIRED=NO; P0_MIGRATION_INTEGRITY_BLOCKER=NO; RELEASE_SECURITY_FREEZE=ACTIVE.** The authorized official PG SSH metadata audit completed at **2026-10-07T19:05:37.743Z–19:05:43.430Z**. The narrow history objective UNKNOWN→KNOWN is achieved; the overall cycle/release is not complete and no Phase 3/4/5 is authorized.

The owner explicitly authorized the temporary without-WARP window. At **2026-10-07T19:05:37.742Z**, WARP was **DISCONNECTED**, the existing native agent **AVAILABLE** and expected fingerprint **MATCH**. Official PG SSH then succeeded. Owner-reported earlier A/B remains **WARP_SSH_INTERFERENCE=CONFIRMED_BY_A_B / SSH_FAILURE_LAYER=CLOUDFLARE_WARP_PATH**; gateway fault **NOT PROVEN**, internal WARP mechanism UNKNOWN. No WARP configuration/disconnect/reconnect was performed automatically. All SSH access has finished: **OWNER_WARP_RECONNECT_REQUIRED=YES**; restoration of this current window remains the owner's action, not inferred from the earlier restoration report.

### Exact target, read-only transaction and closure — UTC

| Evidence | Verified result / boundary |
|---|---|
| 2026-10-07T18:57:52.867Z, control-plane | Rare **72ed12be-9a2a-4e13-8594-30ffd8ffa565** / staging **d8399691-dacf-41e9-a9d5-060c97672e39** / Postgres-MlyZ ServiceID **ed0a374e-79da-4aab-9e3a-bb684fb829d1** / ServiceInstanceID **3b37cfd9-f315-40df-a8a6-35673912d346** / DeploymentID **a20b8647-5a81-4a0b-a44f-b096a58996f3** / DeploymentInstanceID **371feb81-4709-4070-a96a-d9ad854e254b** revalidated. IDs are not interchangeable. |
| 19:05:37.743Z–19:05:43.430Z, official PG SSH | Railway-injected runtime project/environment/service/deployment identifiers all **MATCH** the exact fresh staging target before SQL. SSH/runtime access verified, not merely inferred from control-plane SUCCESS. |
| First SQL / protection | **BEGIN READ ONLY** first; local statement_timeout **5000ms** and lock_timeout **2000ms**; **SHOW transaction_read_only=on**, guarded before metadata. **READ_ONLY_VERIFIED=YES**. |
| Metadata allowlist | PostgreSQL version **18.6 (Debian 18.6-1.pgdg13+2)**; exactly **14** complete history rows using only **migration_name, checksum, started_at, finished_at, rolled_back_at**. One attempt per canonical migration; no extra rows, duplicates or anomalies. No schema catalogs were needed; no migration logs or business/account/seed rows queried. |
| Checksum comparison | All 14 observed checksums exactly matched **CANONICAL** UTF-8 Git blobs at deployed **4ea73f50cafdbf67e16dc71de985052075feca42**. LF/CRLF variants were computed but not needed to obtain matches; never used raw Windows worktree bytes. |
| Explicit closure | Server **ROLLBACK** response received, followed by the exact final completion marker; psql completion verified, CLI exit **0**, remaining audit native processes **0**. **ROLLBACK=EXECUTED / VERIFIED; DATABASE_SESSION_CLOSED=YES**. Not a sentinel/disconnect-only inference. |
| Existing PERSONAL identity | Matching registration was preexisting and **PRESERVED**; no registration or removal this cycle. **RAILWAY_TEMP_PUBLIC_KEY_CLEANUP=NOT_REQUIRED**. Owner local private/.pub files and loaded agent preserved; no key body/passphrase output. |

**APPLIED=14; PENDING=0; FAILED=0; ROLLED_BACK=0; CHECKSUM_MISMATCH=0; EXTRA_HISTORY_ROWS=0; HISTORY_ANOMALIES=0.** These are observed canonical-migration results, not inferred from Git or transport alone. Critical **20260907150000_admin_temporary_password**, **20260920120000_analytics_paid_at_index** and **20260921120000_session_version** are each **APPLIED / CANONICAL CHECKSUM MATCH**. This proves their recorded migration completion, not independent inspection of conditional seed/account values or present index/column drift. No catalog/PII/business-row investigation was required or executed.

**DATABASE_WRITES_PERFORMED=NO; SCHEMA_CHANGED=NO; MIGRATION_EXECUTED=NO.** The read-only audit did not run migrate/resolve, alter history, install/create a remote helper/file, change app/runtime/config/variables, rotate credentials, deploy/redeploy/restart or touch production. Independent application writers were not paused/audited. Clean/no-op is relative to the 14 deployed-SHA references and is an expectation, **not permission to execute migrate deploy or deploy an artifact**.

Entry Git revalidated before documentation: branch **codex/admin-dashboard-reconciled-20261002**, local HEAD = remote branch **44c6fa252bc648bfb32ef83f38005f4c2eb450c8**, main **4ea73f50cafdbf67e16dc71de985052075feca42**, **38 ahead / 0 behind**. Exact all-state head/base PR query at **2026-10-07T19:06:14.456Z** returned **NONE**. This cycle updates authorized documentation locally only: **NO COMMIT / NO PUSH**; the verified entry **38 ahead / 0 behind** is retained, with no forecast publication count, new PR, CI pass or candidate runtime deployment asserted.

### Independent gates / mandatory stop

**BACKUP_AVAILABLE=NO; BACKUP_PROVIDER_BLOCKER=YES; THIRD_BACKUP_ATTEMPT=NO; EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; CREDENTIAL_INCIDENT=P0_OPEN; ROTATION=NO; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO; all release readiness=NO.** No backup inventory was queried or mutated this cycle; the previous **2026-10-07T13:59:32.490Z, 0 snapshots / 0 schedules** checkpoint remains historical, not refreshed recovery proof. All four affected credential categories in staging and production remain COMPROMISED. Database history PASS does not resolve backup, effective configuration, security, rotation or commercial/release gates. Stop after this audit/documentation closure; ask the owner to reconnect WARP manually, without another automatic SSH/access cycle, migration, deploy, rotation or later phase.

The canonical table below now carries the **current APPLIED** state from this completed audit while retaining every hash. Previous dated evidence and UNKNOWN counts below are explicitly historical, not the current database result.

## Historical Phase 2 / OWNER-REPORTED WARP A/B CONFIRMED, DB WINDOW PENDING — 2026-10-07

Canonical current state: [RARE_MASTER_STATUS.md](../cycles/RARE_MASTER_STATUS.md); events: [RARE_MASTER_LOG.md](../cycles/RARE_MASTER_LOG.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; HUMAN_WARP_WINDOW_REQUIRED=YES; STAGING_MIGRATION_HISTORY_VERIFIED=NO; RELEASE_SECURITY_FREEZE=ACTIVE.** The owner supplied the A/B outcome, without an execution timestamp: baseline WARP **CONNECTED**, WITH_WARP **TIMEOUT_HISTORICAL**, WITHOUT_WARP **PASS** for official Railway SSH to the exact staging **WEB rare-staging** service, remote command `true` completed and connection closure expected, then WARP restoration **YES**. The owner also reported the first access added ssh.railway.com to known_hosts. A completed `true` naturally closes immediately; the reported closure is not an SSH error.

**WARP_SSH_INTERFERENCE=CONFIRMED_BY_A_B; SSH_FAILURE_LAYER=CLOUDFLARE_WARP_PATH; RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN.** This is the owner's reported traffic-path behavior, not an independently timestamped repeated experiment or a diagnosis of WARP's internal component. It establishes the reported WEB SSH success without WARP, **not a completed PostgreSQL SSH or metadata audit**. The current fresh local DISCONNECTED status below neither contradicts the earlier reported restoration nor authorizes a new access window.

| Fresh local/control-plane evidence — 2026-10-07 UTC | Result / boundary |
|---|---|
| 17:45:59.275Z, existing native agent | AVAILABLE / expected ED25519 fingerprint MATCH; owner identity preserved. No passphrase or key body collected/output. |
| 17:45:59.865Z, read-only warp-cli status | DISCONNECTED; no WARP state/configuration change by this audit. Owner confirmation of the **current** temporary window remains pending. |
| 17:45:59.956Z, existing known_hosts metadata | Entry exists for the owner-used host; no known_hosts change by this audit. Independent host-fingerprint verification was not obtained. |
| 17:47:50.922Z, PERSONAL key inventory | Existing expected matching registration **PRESERVED**; no creation, import, replacement or removal by this audit. Do not remove a preexisting owner registration as cleanup. |
| 17:48:49.318Z, exact staging control-plane | Rare project **72ed12be-9a2a-4e13-8594-30ffd8ffa565**, staging **d8399691-dacf-41e9-a9d5-060c97672e39**, Postgres-MlyZ ServiceID **ed0a374e-79da-4aab-9e3a-bb684fb829d1**, ServiceInstanceID **3b37cfd9-f315-40df-a8a6-35673912d346**, current DeploymentID **a20b8647-5a81-4a0b-a44f-b096a58996f3** / SUCCESS and DeploymentInstanceID **371feb81-4709-4070-a96a-d9ad854e254b**. Distinct identifiers, not SSH runtime proof. Observed WEB source remains **4ea73f50cafdbf67e16dc71de985052075feca42**; managed PG Git SHA not exposed. |

**No current SSH or SQL was executed; no database session, READ ONLY verification or ROLLBACK occurred.** No new runner/payload was implemented, and the abandoned helper is not reusable. No provider/key mutations, backup queries/creation, WARP/firewall/McAfee/TLS/host-trust/configuration change, app/dev migration, deploy/redeploy/restart, rotation or production action occurred. Owner-reported historical first-access known_hosts addition is not attributed to this current audit.

The existing metadata approval remains valid only for the exact staging target; the missing human action is **explicit confirmation of the current owner-controlled temporary without-WARP window**, followed by restoration confirmation at closure. Current DISCONNECTED alone is not consent. Do not disconnect/reconnect WARP automatically, create split tunnels/policies, weaken another protection or retry SSH while waiting. Revalidate live identifiers and prove the PG runtime/database binding before SQL; the known deployment-instance identifier is not an interchangeable ServiceID/ServiceInstanceID and must not be assumed current solely from older evidence.

Conditional PG-host collection uses only existing official SSH / shell / psql, stdin and no remote helper/file/install: **first SQL BEGIN READ ONLY**, local statement timeout **5000ms** / lock timeout **2000ms**, **SHOW transaction_read_only** must return **on**, with an explicit read-only guard before metadata. Only server version and `_prisma_migrations` **migration_name, checksum, started_at, finished_at, rolled_back_at** are collected; complete history, no silent LIMIT/truncation, logs or business/account/seed rows. Require the server's **ROLLBACK response**, successful guarded completion and confirmed process/session closure before publishing completed history. If read-only is not on, ROLLBACK and ABORT without metadata; timeout/error/missing closure marker keeps verification incomplete. No migration/resolve/history repair is authorized.

The **14 canonical checksum references remain unchanged**; fresh static Git review reconfirmed 14 paths / 14 unique references / 14 SHA-256 matches at deployed **4ea73f50cafdbf67e16dc71de985052075feca42**, with UTF-8 and LF/CRLF variants handled in memory. Classify canonical migrations rather than raw retry rows: prior ROLLED_BACK plus a valid APPLIED retry is not an active failure; rolled-back-only cannot prove no-op; unresolved unfinished attempts, extras/duplicates/inconsistent history or genuine effective-checksum mismatch must not be hidden by a later success or three zero counts. Clean/no-op requires all 14 effectively applied, no unresolved anomaly, complete trusted collection and verified ROLLBACK/closure. This static reference check is not database evidence.

**PostgreSQL version; APPLIED/PENDING/FAILED/ROLLED_BACK/CHECKSUM_MISMATCH; all 14 database states; admin_temporary_password, analytics_paid_at_index and session_version remain UNKNOWN. MIGRATION_HISTORY_CLEAN=UNKNOWN; MIGRATE_DEPLOY_EXPECTED_NOOP=UNKNOWN; PHASE_M_REQUIRED=UNKNOWN; P0_MIGRATION_INTEGRITY_BLOCKER=UNKNOWN.** No corruption/failure or clean/no-op outcome was established. **BACKUP_AVAILABLE=NO verified checkpoint; BACKUP_PROVIDER_BLOCKER=YES; THIRD_BACKUP_ATTEMPT=NO; EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; CREDENTIAL_INCIDENT=P0_OPEN; ROTATION=NO; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO; all release readiness=NO.** Backup inventory remains the dated historical checkpoint below; it was not refreshed here. History UNKNOWN→KNOWN is still NOT ACHIEVED. STOP at Phase 2 pending the owner's current window; no Phase 3/4/5 or release authority follows from WEB SSH PASS.

## Historical Phase 2 / WARP A/B PENDING OWNER — 2026-10-07

Canonical current state: [RARE_MASTER_STATUS.md](../cycles/RARE_MASTER_STATUS.md); events: [RARE_MASTER_LOG.md](../cycles/RARE_MASTER_LOG.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; STAGING_MIGRATION_HISTORY_VERIFIED=NO; RELEASE_SECURITY_FREEZE=ACTIVE.** The owner reported material official Railway Network Diagnostics evidence, without an execution timestamp: Railway HTTP endpoint **PASS / HTTP 200**, edge **gru1**, traceroute **COMPLETED**, ping loss **0%**, latency approximately **19ms**; system resolver **connectivity-check.warp-svc / 127.0.2.2** experienced timeouts before resolution, Cloudflare **1.1.1.1** lookup **PASS**, egress through **AS13335**. This is owner-reported HTTP/network evidence, not proof of an SSH session, an authenticated runtime target or a specific internal WARP defect.

Root's read-only local `warp-cli status` at **2026-10-07T15:11:41.592Z** returned **CONNECTED**; no WARP configuration was changed. The previous three SSH timeouts below remain historical and are not a controlled, time-aligned WITH_WARP baseline. The owner has not supplied the without-WARP result or restoration confirmation.

| A/B gate | Current evidence |
|---|---|
| WARP_STATE_BASELINE | UNKNOWN for a controlled SSH A/B |
| SSH_WITH_WARP | Historical TIMEOUT observations only; controlled baseline NOT VERIFIED |
| SSH_WITHOUT_WARP | NOT REPORTED |
| WARP_RECONNECTED_AFTER_TEST | UNKNOWN |
| WARP_SSH_INTERFERENCE | NOT CONFIRMED; no A/B classification published |

**No SSH, SQL, provider/key operation, backup read or backup mutation occurred in this cycle.** No new runner/payload was implemented and the abandoned helper must not be reused. Static local reference review found **14 deployed-Git migration paths / 14 unique canonical rows / 14 SHA-256 matches**; UTF-8 and LF/CRLF variants were checked in memory without emitting SQL/seed values. This is not database evidence: PostgreSQL version, all five migration counts, all 14 actual migration states and the three critical migrations remain **UNKNOWN**; integrity/clean/no-op/Phase M remain UNKNOWN. No corruption or failed migration was established.

Next gate: obtain the owner's sanitized, comparable WITH_WARP / WITHOUT_WARP SSH result, exact target and timing, plus **WARP restoration confirmation**. Current CONNECTED status alone does not prove that an A/B test or restoration happened. Do not infer WARP causation from HTTP PASS, resolver timeouts or AS13335; do not repeat SSH automatically, alter WARP permanently, weaken McAfee/firewall/TLS/host trust or download/execute another tool. A confirmed A/B may support the owner's requested traffic-path classification, not an internal WARP mechanism or a proven Railway gateway fault.

Only after owner-confirmed trusted official SSH **PASS** and exact staging runtime/database-target MATCH may the already-approved metadata audit proceed: **BEGIN READ ONLY first**, local statement timeout **5000ms** / lock timeout **2000ms**, verify **SHOW transaction_read_only = on before metadata**, then only server version and `_prisma_migrations` **migration_name, checksum, started_at, finished_at, rolled_back_at**, plus minimal authorized catalogs if necessary. No migration logs or business/account/seed rows. Require **ROLLBACK verified and session closure confirmed** before publishing a completed audit; a caught wrapper sentinel or disconnect alone is not ROLLBACK proof. If read-only is not on, ROLLBACK and ABORT without metadata. No audit is executed while A/B/SSH/runtime gates are missing.

Classify the **14 canonical migrations**, not raw attempt-row totals: a historical ROLLED_BACK attempt may be followed by a valid APPLIED attempt; a migration with only rolled-back attempts is not effectively applied and cannot justify no-op. Compare deployed-SHA Git blobs with the documented Prisma LF/CRLF equivalence, never blind Windows worktree bytes. Clean/no-op requires all 14 effectively APPLIED, no unresolved failure/inconsistency or genuine checksum mismatch, complete bounded history and verified transaction closure; PENDING=0 / FAILED=0 / CHECKSUM_MISMATCH=0 alone is insufficient if rolled-back-only or unknown/extra history remains. Prioritize integrity blockers over pending; no automatic repair/migration authority follows.

**BACKUP_PROVIDER_BLOCKER=YES; THIRD_BACKUP_ATTEMPT=NO; CREDENTIAL_INCIDENT=P0_OPEN; ROTATION=NO; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO; all release readiness=NO.** Backup evidence is still the dated previous-cycle checkpoint below, not a fresh listing or verified recoverability. STOP at Phase 2; no deploy/redeploy/restart, migration, rotation or production action is authorized.

## Historical Phase 2 / TCP REACHABLE, THREE SSH TIMEOUTS — 2026-10-07

Canonical current state: [RARE_MASTER_STATUS.md](../cycles/RARE_MASTER_STATUS.md); events: [RARE_MASTER_LOG.md](../cycles/RARE_MASTER_LOG.md). **PHASE_RESULT=BLOCKED; SSH_PATH=BLOCKED; RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES; STAGING_MIGRATION_HISTORY_VERIFIED=NO; RELEASE_SECURITY_FREEZE=ACTIVE.** The existing owner identity is AVAILABLE in Windows OpenSSH Agent / expected ED25519 fingerprint MATCH; the private/.pub files outside E:/rare remain unchanged. DNS and TCP/22 passed, but exactly three bounded, runtime-only `true` probes timed out after establishing the expected native SSH TCP socket: Postgres service instance, its explicit RUNNING deployment instance, and web service instance. This isolates failure to the native SSH path after TCP, not a basic TCP block, target mismatch or proven Postgres-specific defect. Gateway/local-route/authentication root cause remains UNKNOWN; SSH runtime target is NOT VERIFIED. This is Case B, not an unavailable-agent or passphrase-unlock gate. Authorized matching `.pub` PERSONAL registration and scoped cleanup were completed.

### Fresh evidence / actual execution

Entry local/origin documentation HEAD **50b0a78e63f517ef5a27967190a904369ef584cb**, branch **codex/admin-dashboard-reconciled-20261002**, main **4ea73f50cafdbf67e16dc71de985052075feca42**, **35 ahead / 0 behind**, tracked tree clean at entry; two unrelated untracked user documents preserved/excluded. Resolve final publication/counts from canonical status/Git. No new PR or CI query this cycle; the last exact all-state head/base PR query, **2026-10-07 13:47:33 UTC**, returned none in the previous cycle, not a fresh current remote result. No PR creation/retry/merge or runtime deployment of candidate **7a820b62bb1515f7b30ccf31badf1f0881a6bd84**.

| Time / boundary | Verified result |
|---|---|
| 2026-10-07T14:29:25.435Z, native agent | ssh-add -l exit 0 / AVAILABLE; 1 loaded identity, ED25519 fingerprint **SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw** MATCH. No comment/body output, passphrase request/read/store, agent/service change or unload. |
| 2026-10-07T14:29:25.891Z, supplied files/public metadata | Existing private/.pub files outside repository verified unchanged; public fingerprint MATCH / ED25519. No new key, private derivation, file change/copy/delete. Private encryption and successful remote signing/authentication remain unverified. |
| 2026-10-07T14:30:57.484Z, official PERSONAL registration | Inventory 0→1; only the supplied matching .pub added as rare-staging-db-audit-20261007. PERSONAL account registration is not environment-isolated; every attempted connection was restricted to the exact staging target. No workspace key or production target selected; no private key transmitted. |
| 2026-10-07T14:31:46.034Z, DNS / TCP preflight | DNS PASS / TCP 22 REACHABLE for ssh.railway.com. This proves basic transport reachability, not completed SSH negotiation/authentication or runtime access. |
| 2026-10-07T14:32:38.079Z, Postgres config dry-run | Generated User **3b37cfd9-f315-40df-a8a6-35673912d346** is the ServiceInstanceID, not the ServiceID; HostName **ssh.railway.com**. Identity path matched the existing owner private path at **14:34:30.252Z**; configuration unchanged. No key body or passphrase output. |
| 2026-10-07T14:33:51.366–14:33:53.157Z, official control-plane metadata | CLI **5.26.0**, explicit Rare **72ed12be-9a2a-4e13-8594-30ffd8ffa565** / staging **d8399691-dacf-41e9-a9d5-060c97672e39** IDs/names MATCH. Both Postgres/web have one active deployment equal to latest, SUCCESS / stopped=false; exact distinct IDs below. This is not SSH runtime or DB binding proof. |
| 2026-10-07T14:35:54.368–14:36:22.793Z, Postgres service probe | Exactly `true`, 25-second deadline: TIMEOUT. Native expected ServiceInstanceID target MATCH; TCP 22 socket Established. No SQL payload or runtime metadata query. |
| 2026-10-07T14:38:17.584–14:38:45.952Z, Postgres deployment-instance probe | Exactly `true`, explicit RUNNING deployment instance **371feb81-4709-4070-a96a-d9ad854e254b**, 25-second deadline: TIMEOUT. Native expected target MATCH; TCP 22 socket Established. No SQL payload. |
| 2026-10-07T14:38:17.924–14:38:45.955Z, web service probe | Exactly `true`, ServiceInstanceID **d6368ea1-30e4-4593-b35a-65f21537a1ed**, 25-second deadline: TIMEOUT. Native expected target MATCH; TCP 22 socket Established. WEB SSH PASS gate failed; no web fallback, Prisma/module inspection or DB binding check. |
| Native process boundary / closure | Official CLI automatically supplied -i in the native invocation; no caller-forced -i, helper, tunnel/session or host-trust bypass. Only positively scoped audit child processes were terminated after deadlines; no audit process remained. No successful SSH session was verified. |
| 2026-10-07T14:39:49.590–14:39:52.008Z, official cleanup | Newly added matching PERSONAL registration removed; empty readback / expected fingerprint absent, 1→0, no 2FA requirement. Owner pair unchanged and loaded agent preserved AVAILABLE/MATCH; no preexisting registration removed. |
| Canonical Git reference, unchanged | 14 deployed-SHA migration references/checksums retained below. Prior verification: 14 blobs / 14 unique rows / 14 SHA-256 matches / valid UTF-8; LF/CRLF variants computed in memory. Reference evidence only, not a fresh DB collection. |
| Historical backup checkpoint, 2026-10-07T13:59:32.490Z | Prior exact volume instance **c5910985-a38a-479b-9274-e65ec6753c77** read: 0 snapshots / 0 schedules, no late snapshot then visible. **No backup read or create this cycle.** BACKUP_AVAILABLE=NO verified checkpoint / BACKUP_PROVIDER_BLOCKER=YES; cumulative create attempts 2, third NO. Current backend workflow/cause/cost/restore UNKNOWN. |

| Distinct control-plane identifier | Postgres-MlyZ | rare-staging |
|---|---|---|
| ServiceID | ed0a374e-79da-4aab-9e3a-bb684fb829d1 | 3f4b79f6-2819-45a6-986d-584dc7ac803a |
| ServiceInstanceID | 3b37cfd9-f315-40df-a8a6-35673912d346 | d6368ea1-30e4-4593-b35a-65f21537a1ed |
| Current active DeploymentID | a20b8647-5a81-4a0b-a44f-b096a58996f3 | 3e4874f3-397c-47fa-be77-73d1b0089ceb |
| DeploymentInstanceID / state | 371feb81-4709-4070-a96a-d9ad854e254b / RUNNING | a47838d1-1f83-4127-960a-1ffc8d49d8d3 / RUNNING |
| Safe source SHA | Not exposed | 4ea73f50cafdbf67e16dc71de985052075feca42 |

The web deployment also lists **b7ec08ad-60c0-41e0-a916-3a8027f4f97b / REMOVED**, not a valid active target. ServiceID, ServiceInstanceID, DeploymentID and DeploymentInstanceID are not interchangeable. Current means the sole active deployment returned by the exact staging control-plane read; SUCCESS/RUNNING does not prove SSH or database accessibility.

**SSH_ATTEMPTED=YES; SSH_SUCCESS=NOT VERIFIED; SQL_EXECUTED=NO; READ_ONLY_VERIFIED=NO; ROLLBACK=NOT EXECUTED; SSH_KEY_REGISTRATION=TEMPORARY; KEY_CLEANUP=VERIFIED_REMOVED; SSH_KEY_REMOVAL_REQUIRES_HUMAN_2FA=NO; CREDENTIALS_PRINTED=NO.** No database session or DB/schema writes by this cycle, new local key/helper/executable, owner-key copy/move/delete, agent unload, AV/host-trust/TLS bypass, import, public DB exposure, backup/restore, rotation, deploy/restart/migration, source/config/variable or production change. Only provider writes were the authorized personal public-key add/remove. Independent application writers were not paused/audited. The abandoned quarantined helper was not restored/trusted/executed/recompiled/renamed/replaced; no antivirus setting changed, and no general SSH antivirus cause was established.

### Human connectivity triage / metadata continuation not executed

The [owner-led support draft](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) was materially expanded with sanitized DNS/TCP, target, bounded probes and cleanup evidence: **CODEX_NOT_SENT; OWNER_STATUS_NOT_VERIFIED**. Next action is owner-led official Railway Network Diagnostics or an approved other-network check, followed by explicit resume with sanitized findings. No Network Diagnostics tool was downloaded/executed here, no automatic SSH retry follows, and no passphrase-unlock action is the present prerequisite. Do not disable firewall/McAfee, add exclusions, restore the helper, bypass TLS/host trust, expose Postgres publicly or create a third backup.

Any explicitly resumed metadata collection still requires successful trusted SSH and runtime target proof. A WEB fallback additionally requires WEB SSH PASS and same staging DB binding MATCH; neither was achieved. Only then may the existing runtime Node/Prisma path use a read-only transaction, prove `transaction_read_only=on` before metadata, collect server version and only `migration_name, checksum, started_at, finished_at, rolled_back_at`, end the transaction and disconnect. No migration logs, business rows, server/package install, repository runtime file or app change. Catalog checks are limited to authorized schema metadata, never account/seed values. No Prisma/module/DB binding collection, SQL, read-only verification, ROLLBACK or database closure check occurred this cycle because the SSH gate failed.

The 14 deployed-SHA checksum references and LF/CRLF handling remain unchanged. Prioritize any actual failed/incomplete/inconsistent record or true checksum mismatch as a **P0 stop**, with no repair/migration authority. A pending/no-op conclusion is relative to these references, not next-deploy safety; it cannot be inferred from static Git evidence or SSH timeouts.

**PostgreSQL version, APPLIED/PENDING/FAILED/ROLLED_BACK/CHECKSUM_MISMATCH and all 14 real migration states remain UNKNOWN.** Critical `20260907150000_admin_temporary_password`, `20260920120000_analytics_paid_at_index`, `20260921120000_session_version`: each UNKNOWN. **MIGRATION_HISTORY_CLEAN=UNKNOWN; MIGRATE_DEPLOY_EXPECTED_NOOP=UNKNOWN; PHASE_M_REQUIRED=UNKNOWN; P0_MIGRATION_INTEGRITY_BLOCKER=UNKNOWN.** No corruption or integrity defect was established. History UNKNOWN→KNOWN remains NOT ACHIEVED; this is an incomplete safety stop. DATABASE/BACKUP/CONFIG/SECURITY gates remain blocked; effective next-deploy config independently **NOT VERIFIED**. Four affected credential categories across staging/production remain COMPROMISED / rotation NO / freeze ACTIVE; Phase S NO, all release readiness NO. STOP at Phase 2; no Phase 3/4/5, migration, deploy or rotation authority follows.

## Historical official identity gate / HUMAN ACTION REQUIRED — 2026-10-06

The following original evidence/authority is historical and superseded by the current owner-provided-identity route above; previous Git/backup/support/SSH observations must not be reported as fresh.

**SSH_PATH=BLOCKED; SSH_IDENTITY_HUMAN_ACTION_REQUIRED=YES; BACKUP_PROVIDER_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The quarantined helper was abandoned, not restored/retried/replaced. Official identity discovery did not yield a usable existing key. No import, key creation/registration, SSH or SQL occurred. The objective of converting migration history UNKNOWN to KNOWN remains **NOT ACHIEVED**.

[Activation gate](SECRET_ACTIVATION_GATE.md), [incident record](CREDENTIAL_INCIDENT_202610.md), [owner-ready Railway support draft](RAILWAY_BACKUP_SUPPORT_HANDOFF.md), [release readiness](../PRODUCTION_READINESS.md).

### Authority / Git / exact target

This cycle permits official existing personal Railway SSH identity use or import of **one existing GitHub public key** with a legitimately available corresponding Windows private identity, metadata-only read-only SQL, cleanup of only a key added this cycle, read-only backup reconciliation and documentation. It does not permit a new key/helper/executable, an automatic unencrypted key, quarantined-helper restoration/trust/repackaging/re-execution, endpoint-security settings changes, a third backup or Phase M/S/P. All production, deploy/redeploy/restart, migration/DDL/DML, application/provider credential changes, variable/source/config-selector changes, restore/PITR/dump/schedule/resize/new resource and commerce/provider actions remain prohibited. Provider writes this cycle: **0**.

Fresh Git entry local/origin HEAD **b9d7cbf5a47648fa0486414d0392b043b04efd29**, branch codex/admin-dashboard-reconciled-20261002, main/deployed web/worker source **4ea73f50cafdbf67e16dc71de985052075feca42**, **30 ahead / 0 behind**. Final documentation SHA/count/remote equality are reported after normal push. Runtime candidate 7a820b62bb1515f7b30ccf31badf1f0881a6bd84 and checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518 remain frozen/not deployed; both preexisting untracked user documents are preserved/excluded. Exactly one all-state exact head/base PR query returned none; prior PR_CREATION_BLOCKED_BY_PERMISSION retained, no creation attempt or merge.

Read-only control-plane verification at **2026-10-06T20:41:33.034Z** matched every project/environment/PG/volume/instance ID and mount in the historical target table below. SSH service instance remains **3b37cfd9-f315-40df-a8a6-35673912d346**, belonging to staging / Postgres-MlyZ. Volume READY, no pending deletion; capacity **5000 MB**, current usage **187.547648 MB** (prior attempt-window observation 187.531264 MB), region UNKNOWN. The four latest staging deployment IDs below remain unchanged/SUCCESS. These are control-plane observations, not a database session or zero-independent-write proof.

### ENDPOINT SECURITY

Read-only McAfee forensic metadata corroborated five prior events for RareAuditAskPass.exe, detection family **Real Protect-LS**, action recorded as infection quarantined and normalized **QUARANTINED**. Recorded date 10/06/2026 is correlated to October 6; recorded clocks **17:42:00, 17:47:08, 17:47:44, 17:48:03, 17:52:25** have **no explicit timezone offset** and are not relabeled UTC. Sanitized original path: AppData/Local/Temp/rare-staging-db-audit-20261006-plumbing/RareAuditAskPass.exe. The original executable is absent. Hashes present in the log are event metadata, not a newly measured or independently verified artifact hash; unnecessary hashes/detection suffixes are not published.

**QUARANTINED_HELPER_TRUST=UNKNOWN; FALSE_POSITIVE=UNKNOWN; HELPER_ABANDONED=YES.** No restore, trust, execution, recompilation, rename/repackage/obfuscation, exclusion, protection disablement or new custom passphrase helper was performed. No private/public key body or secret was emitted. This confirms the historical helper barrier only; it does not prove that official SSH is generally blocked by McAfee. The official path removes the helper dependency conceptually, but no successful SSH session is claimed: the actual current access blocker is missing usable identity.

### Official identity discovery / no import

| Check | Actual result |
|---|---|
| Official CLI | Railway 5.26.0; installed native executable, not the quarantined helper/shim |
| railway ssh keys list | 2026-10-06T20:39:30.516Z, exit 0, personal registered inventory empty; no workspace selected |
| Permitted Windows .ssh inventory | 1 existing file; 0 public-key candidates, 0 private-key candidates/pairs; no private body read |
| Native OpenSSH configuration discovery | 2026-10-06T20:41:35.258Z, ssh -G exit 0, 7 configured identity paths and 0 existing private files; no network session |
| Existing native agent | ssh-add -l exit 2, unavailable; ssh-agent service STOPPED and not started; no SSH_AUTH_SOCK; no Pageant process |
| Authentication scope | RAILWAY_API_TOKEN / RAILWAY_TOKEN environment absent; existing personal CLI authentication used privately, no token hunt/new login |
| Official linked GitHub public-key discovery | 2026-10-06T20:42:26.595Z, query gitHubSshKeys, HTTP 200 / GraphQL INTERNAL_SERVER_ERROR; availability/algorithm/fingerprint **UNKNOWN**, not zero keys or a proven permission cause |
| railway ssh keys github | Help/versioned implementation evaluated; import command **NOT EXECUTED** because no matching private identity/candidate was verified |
| SSH_KEY_SOURCE / SSH_KEY_SCOPE | BLOCKED / NOT APPLICABLE; PERSONAL would be required |
| Key added/imported/created/removed this cycle | **NO / NO / NO / NOT APPLICABLE**; preexisting identities untouched |
| SSH / SQL / READ ONLY verification / ROLLBACK | **NO / NO / NO / NOT EXECUTED**; no database transaction/session established |
| Credentials printed / new local private key | **NO / NO** |

The official import operates on one personal public key, does not supply its private key, and may select the first candidate noninteractively. Do not invoke it as a discovery command or import an arbitrary candidate merely to try access. [Railway SSH identity documentation](https://docs.railway.com/cli/ssh), [versioned import implementation](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/keys.rs#L404), [official read-only discovery query](https://github.com/railwayapp/cli/blob/v5.26.0/src/gql/queries/strings/GitHubSshKeys.graphql).

SQL execution stopped under the owner's human-action-required rule. The narrow plan remains BEGIN READ ONLY first, local statement_timeout 5000ms/lock_timeout 2000ms, verify transaction_read_only=on, select only the five approved migration columns/minimal necessary catalogs, then ROLLBACK and close. No application rows, migration logs, SQL seed/DML, tunnel, tmux setup or credentialed URL command was used.

### Backup / migration / release outcome

This cycle's **single final read-only backup listing**, **2026-10-06T20:43:01.586Z**, returned **0 snapshots / 0 schedules**. LATE_SNAPSHOT=NO; BACKUP_AVAILABLE=NO; BACKUP_PROVIDER_BLOCKER=YES; RESTORE_DRILL_VERIFIED=NO. Cumulative creation requests remain **2; THIRD_ATTEMPT=NO**. No backup write, restore, PITR, dump, schedule/resize or alternate paid resource was attempted. Only the preserved sanitized ledger/docs were searched for the two attempts' trace IDs: **TRACE_ID=NOT AVAILABLE**, not proof of absence in raw responses. No raw transcripts/configuration/headers/variables were reopened for that trace search. Backend outcomes/cost/cause remain UNKNOWN.

The [support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) is **READY / DRAFT / SUPPORT_NOT_CONTACTED**, including the exact resources, timestamps, failure classification, listings and owner-ready message. It asks Railway to reconcile both requests, identify any internal snapshot/workflow and cause/account limits, and clarify future retry safety/cost; it grants no further operation. The documentation handoff is finalized, **not operational recovery or incident closure**.

| Current field / gate | Result |
|---|---|
| PostgreSQL version | UNKNOWN |
| Repository migrations / canonical source | **14** / Git blobs at 4ea73f50cafdbf67e16dc71de985052075feca42; reference table below, not worktree CRLF |
| APPLIED / PENDING / FAILED / ROLLED_BACK / CHECKSUM_MISMATCH | **UNKNOWN / UNKNOWN / UNKNOWN / UNKNOWN / UNKNOWN** |
| STAGING_MIGRATION_HISTORY_VERIFIED / MIGRATION_HISTORY_CLEAN | **NO / UNKNOWN** |
| admin_temporary_password / analytics_paid_at_index / session_version | **UNKNOWN / UNKNOWN / UNKNOWN**; no seed execution or application-row inspection |
| MIGRATE_DEPLOY_EXPECTED_NOOP / PHASE_M_REQUIRED | **UNKNOWN / UNKNOWN** |
| Backup / migration / config-resolution blockers | **YES / YES / YES**; migration blocker is missing history, not a corruption finding |
| Official SSH identity blocker / historical endpoint barrier | **YES / helper QUARANTINED and abandoned**; official SSH runtime not tested, no general AV-block assertion |
| EFFECTIVE_NEXT_DEPLOY_CONFIG / SAFE_SECRET_ACTIVATION_PATH | **NOT VERIFIED / NOT PROVEN**, independent of DB/identity; no selector change |
| Credentials compromised / rotation / release freeze | **YES / NO / ACTIVE** |
| PHASE_S_CAN_RESUME / READY FOR MERGE / STAGING BOOTSTRAP / PRODUCTION | **NO / NO / NO / NO** |

No live migration/column/index/checksum count can be inferred from deployed source, local rare_dev or partial schema. Prisma original/LF/CRLF/historical checksum semantics remain accounted for in the unexecuted comparison plan. Any later failed/partial/inconsistent history or genuine mismatch requires P0_MIGRATION_INTEGRITY_BLOCKER=YES and no repair; no such defect was established here. Backup and next-config gates remain independent even if a future audit proves zero pending.

Next: the owner establishes a legitimate official personal SSH identity with the corresponding Windows private identity/approved agent and resolves linked-GitHub discovery if that import route is chosen. No automatic keygen, unencrypted key or antivirus modification. Then explicitly authorize resuming the same narrow staging metadata audit; preserve all preexisting identities and remove only a new authorized import afterward. Independently the owner can send the ready support draft through an approved channel. No support message was sent here. No third backup or Phase S continuation follows.

Only the five requested documents are updated; the prior rotation approval is unchanged. Current documentation validation: git diff --check PASS; release:guard **6 OK / 1 unchanged legacy Vercel-cron WARNING / 0 FAIL**. The scoped secret/link check read six gate documents (including the unchanged approval) and their working/staged diffs: **0 exact configured-secret hits / 0 credential-pattern hits**, including private comparison against the existing Railway authentication token, staging DB URL/password and four affected credential categories. **66 relative links / 0 broken; 14 canonical checksum references / 0 incorrect**; no production configuration read. This validates documentation, not runtime, secrets rotation, database history or release readiness. Final pushed SHA/equality are reported at closure; no E2E/build/runtime suite. The Railway skill guided official discovery/personal scope/readbacks and the Postgres skill kept the deferred audit bounded/read-only. **STOP after documentation commit/push and report.** Everything below is historical evidence/conditional analysis and supplies no current execution authority.

## Historical reconciliation / trusted audit ABORT — 2026-10-06

**BACKUP_PROVIDER_BLOCKER=YES; ENDPOINT_SECURITY_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Backup reconciliation and the separately authorized second/final request are complete. The metadata audit was safely aborted before registration, SSH or SQL because McAfee quarantined the local passphrase helper. **MIGRATION HISTORY = KNOWN was NOT achieved.** History remains UNKNOWN; neither clean history nor corruption is inferred.

[Secret activation gate](SECRET_ACTIVATION_GATE.md), [incident timeline](CREDENTIAL_INCIDENT_202610.md), [rotation approval](CREDENTIAL_ROTATION_APPROVAL.md), [support handoff — draft only](RAILWAY_BACKUP_SUPPORT_HANDOFF.md), [release readiness](../PRODUCTION_READINESS.md).

### Current authority / Git / target

The current owner instruction authorizes metadata-only SQL **independently of backup availability**, superseding the previous backup-before-SSH requirement only for observational access. Backup still gates migration execution, risky redeploy and Phase S. Exactly one second/final backup request was authorized after reconciliation; no third request. A temporary personal ED25519 key, exact staging PG access, cleanup and documentation commit/push were authorized, not Phase M/S/P. The only provider write reached this cycle was that backup request; no SSH-key mutation was reached.

Production selection/access/change, deploy/redeploy/restart, migrations/DDL/DML, restore/PITR/dump/schedule/resize/new database, application/provider credential creation/rotation/revocation, Railway variable/source/config-selector changes, commerce/commercial-provider/webhook/cron/email actions and main merge remain prohibited. The sole authorized access-credential exception is the dedicated temporary personal SSH key and its cleanup; no registration/removal mutation was reached. No endpoint-protection or access-control workaround occurred.

Entry local/remote HEAD after fetch: **30104ad071bac4df6c0b31524358c262f5b33b25**; branch codex/admin-dashboard-reconciled-20261002; main/deployed web/worker source **4ea73f50cafdbf67e16dc71de985052075feca42**; **29 ahead / 0 behind**. Final documentation SHA/count/equality are reported after push, not embedded self-referentially. Runtime candidate 7a820b62bb1515f7b30ccf31badf1f0881a6bd84 and checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518 stay frozen/not deployed. Both preexisting untracked user documents are preserved/excluded. A fresh exact all-state head/base PR search returned none; no PR retry/CI trigger/merge.

All IDs/names/attachment/mount in the target table below were matched again before the second request. Read-only SSH resolution additionally verified staging PG service-instance ID **3b37cfd9-f315-40df-a8a6-35673912d346**. This is control-plane target proof, not an SSH runtime connection. Volume remains READY, no pending deletion, 5000 MB capacity / 187.531264 MB used; region UNKNOWN. Usage about 3.75% gives **DOCUMENTED_50_PERCENT_LIMIT_NOT_INDICATED**, not a cause diagnosis. Latest staging deployment IDs below remain unchanged/SUCCESS; web/worker still deploy 4ea73f50cafdbf67e16dc71de985052075feca42. Independent application writers were not paused/audited.

### Backup reconciliation — UTC

| Evidence | Actual result |
|---|---|
| Prior first request | 2026-10-06T16:52:38.126Z; HTTP 200 / INTERNAL_SERVER_ERROR; no workflow ID; three later inventories 0/0 through 16:55:22.004Z |
| Fresh reconciliation | 2026-10-06T17:30:27.210Z; 0 snapshots / 0 schedules; LATE_BACKUP_FOUND=NO |
| Second/final request | 2026-10-06T17:30:46.574Z; same exact volumeInstanceBackupCreate target; HTTP 200 / INTERNAL_SERVER_ERROR; no workflow ID |
| Post-second inventories | 17:30:48.048Z, 17:32:38.169Z and 17:52:44.877Z; each 0 snapshots / 0 schedules |
| Requests this cycle / cumulative | 1 / **2**; no automatic retry; **NO_THIRD_ATTEMPT** |
| Backup ID / status / created / expiry | NONE LISTED / no available snapshot verified / NOT AVAILABLE / NOT AVAILABLE |
| Workflow completion / backend outcome / cost | UNKNOWN / UNKNOWN / UNKNOWN |
| Trace ID | NOT_CAPTURED; none available in sanitized evidence, not proof of absence in the raw response |
| BACKUP_AVAILABLE / STAGING_BACKUP_VERIFIED / RESTORE_DRILL_VERIFIED | **NO / NO / NO** |
| BACKUP_PROVIDER_BLOCKER | **YES**, operational blocker, not structural/root-cause diagnosis |

HTTP 200 does not prove mutation success; the [Railway API contract](https://docs.railway.com/integrations/api#errors) permits generic internal errors for unexpected failure or authorization denial, and an errored write may have side effects. No damage/quota/billing/permission cause or zero-cost outcome is established. Empty inventories do not preclude a delayed snapshot; never repeat creation to obtain a trace ID. [Manual-backup limit](https://docs.railway.com/volumes/backups).

The [support handoff](RAILWAY_BACKUP_SUPPORT_HANDOFF.md) is **DRAFT ONLY / SUPPORT_NOT_CONTACTED**. Official status observations at 17:29 UTC and again around 17:52 UTC displayed [Fully Operational](https://status.railway.com/), without a broad backup-specific incident confirmed. The page excludes smaller/isolated issues; it does not certify this request healthy. No backup deletion/lock, schedule, resize, PITR, logical dump, restore or paid recovery resource was attempted.

### SSH / endpoint-security abort / cleanup

Complete personal Railway key inventories before preparation and after abort both showed **0 registered personal keys**. Workspace inventory was not separately queried and no claim is made about workspace-owned keys. Dedicated owner-only-ACL temporary directories outside Git were used for ED25519 generation; passphrases stayed in process memory, never argv, secret environment, files or tool output. No system ssh-agent was started. Generation required verified OpenSSH encryption, two authorized ASKPASS responses and a corresponding public key. Exit zero alone did not pass: no responses/encryption were verified, so every transient pair was rejected and removed before registration. A revised installed Git OpenSSH path also failed; no unencrypted fallback was accepted.

The helper disappeared after launch. Read-only endpoint diagnosis confirmed **five McAfee records for this exact helper with QUARANTINED status**. A bounded no-key/no-network/no-credential launch diagnostic also failed and left it absent. This confirms a local helper execution barrier; false-positive status and a general SSH/Railway block remain NOT PROVEN. Retries stopped. No quarantine restoration, antivirus exclusion/disablement, permission change or replacement transport was used to escape the barrier.

| SSH / SQL field | Actual outcome |
|---|---|
| Temporary key created | YES locally, transient/rejected; no usable encrypted audit key verified |
| Registered / registration mutation / scope | **NO / NOT EXECUTED / NOT APPLICABLE**; intended PERSONAL, not workspace-wide |
| Target verified | YES via explicit staging control-plane IDs; SSH runtime target NOT VERIFIED |
| Credentials printed | **NO**; no private/public key content, passphrase or credentialed connection detail |
| SSH / SQL / read-only mode verified | **NO / NO / NO**; no transaction established |
| ROLLBACK / database session closed | NOT EXECUTED / NOT APPLICABLE; no DB session existed |
| Remote key deletion | NOT APPLICABLE, never registered; new-key absence verified in empty inventory |
| Local dedicated pairs removed / preexisting keys deleted | **YES / NO**; private/public file absence confirmed after each rejected attempt |
| ENDPOINT_SECURITY_BLOCKER | **YES**; legitimate owner review of quarantine required |

The prepared/reviewed SQL was never executed: first BEGIN READ ONLY; local statement_timeout 5000ms / lock_timeout 2000ms; verify transaction_read_only=on before main SELECTs; bounded history using only migration_name/checksum/started_at/finished_at/rolled_back_at, minimal catalogs, final ROLLBACK and close. No application rows or migration logs. Proposed task-private accept-new TOFU would reject changed host keys but is not independent fingerprint trust; no host pin/connection was established. No tunnel-only, tmux/session setup, TLS weakening or new public database exposure.

### Database / configuration / release decision

| Field / gate | Current result |
|---|---|
| PostgreSQL version | UNKNOWN |
| Repository migrations | **14**, deployed Git blobs; canonical reference table below remains valid, DB comparison NOT EXECUTED |
| APPLIED / PENDING / FAILED / ROLLED_BACK / CHECKSUM_MISMATCH | **UNKNOWN / UNKNOWN / UNKNOWN / UNKNOWN / UNKNOWN** |
| STAGING_MIGRATION_HISTORY_VERIFIED / MIGRATION_HISTORY_CLEAN | **NO / NOT VERIFIED** |
| analytics_paid_at_index / session_version | **UNKNOWN / UNKNOWN**; no actual index/column metadata retrieved |
| MIGRATE_DEPLOY_EXPECTED_NOOP / PHASE_M_REQUIRED | **UNKNOWN / UNKNOWN** |
| Backup / migration / config-resolution blockers | **YES / YES / YES**; migration blocker is unknown history, not a discovered integrity defect |
| EFFECTIVE_NEXT_DEPLOY_CONFIG / SAFE_SECRET_ACTIVATION_PATH | **NOT VERIFIED / NOT PROVEN** |
| Credentials compromised / rotation performed / release freeze | **YES / NO / ACTIVE** |
| PHASE_S_CAN_RESUME | **NO** |
| READY FOR MERGE / STAGING BOOTSTRAP / EXTERNAL HOMOLOGATION / PRODUCTION | **NO / NO / NO / NO** |

Prisma original/LF/CRLF and historical checksum-format semantics were accounted for in the prepared comparator, but no DB checksum was obtained. Any later failed/partial/inconsistent history or genuine mismatch requires P0_MIGRATION_INTEGRITY_BLOCKER=YES, stop and no repair. The conditional manifest below remains relevant until trusted history narrows pending operations; no no-DDL/no-op conclusion is supported. No migration/schema/application-data change was made.

Fresh staging-only serviceInstance/environment.config(decryptVariables:false)/deployment reads retain stored source integration/pre-go-live, web migrate predeploy with advisory locking disabled and worker/PG/Redis predeploy NONE. **CURRENT_STORED_MIGRATION_EXECUTOR_COUNT=1; FUTURE_MIGRATION_EXECUTOR_COUNT=UNKNOWN.** Web/worker selectors/root remain null, resolved configFile null, fileManifest empty and resolution timestamps 2026-09-25. Old snapshots are not next-deploy proof; no config/source/variable change. Redeploy/image reuse retains predeploy risk; restart fresh-secret loading is unproved. Activation was evaluated only theoretically.

Recommended: owner reviews the endpoint detection through the legitimate antivirus channel; no automatic restoration/exclusion or protection disablement. Obtain an approved trusted SSH transport before a fresh observational audit. Independently use the draft handoff for owner/provider triage of both ambiguous backup requests. No third create or support contact here. Prove effective next web/worker config separately; decide Phase M only after known history and adequate recovery, and Phase S only under new explicit authority.

Only the five requested Markdown files plus the new authorized support handoff change. Current documentation checks: git diff --check PASS; release:guard **6 OK / 1 unchanged legacy Vercel cron WARNING / 0 FAIL**, 323 source/document files and 43 existing browser-bundle files. Scoped six-doc/working-and-staged Git-diff scan privately checks four affected staging categories plus staging DB URL/password: **0 exact credential hits / 0 credential-pattern hits**. All **52 relative file links** resolve, fences balance and all **14 canonical checksum references** match deployed Git blobs. No production configuration is read by the scanner. Final staged recheck, pushed SHA and remote equality are reported at closure. Historical validation counts below are not current checks or new compromise-closure evidence. No E2E/build/runtime suite is run. Railway guidance informed exact target/readbacks/no retry; Postgres guidance bounded the prepared observational SQL, which did not execute. **STOP after docs commit/push and report.**

## Historical first recovery attempt — superseded

Everything below records the previous cycle and its backup-before-SSH prerequisite, one-request limit, unknown history and validation counts. It is historical evidence, not current execution authority or the current cycle result. The reconciliation section above takes precedence; canonical deployed checksum/target references are retained for audit continuity.

Assessment: 2026-10-06. **MANUAL_BACKUP_FAILED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The authorized success criterion was not achieved. One backup creation request was sent; no available snapshot was verified. The prerequisite for SSH was not met, so no key was generated/registered and no SSH/SQL was executed. No creation retry is authorized by this record.

[Secret activation gate](SECRET_ACTIVATION_GATE.md), [incident timeline](CREDENTIAL_INCIDENT_202610.md), [rotation approval](CREDENTIAL_ROTATION_APPROVAL.md), [release readiness](../PRODUCTION_READINESS.md).

## Authority / Git

Owner authorized exactly one manual staging PG backup, followed only after availability by one personal temporary ED25519 key and metadata-only READ ONLY SQL. No production selection/access/change, deploy/restart/redeploy, source/config/variable change, credential rotation, migration, DDL/DML, restore, backup deletion/schedule, commerce/commercial-provider/webhook/cron/email action or main merge was authorized. Existing authentication was used privately; no new token/access workaround was created.

Repository raredept/rare, E:/rare; branch codex/admin-dashboard-reconciled-20261002. Entry local/remote HEAD b781aa0287a8a676792a8ef6c60671fd4e2b2489; main/deployed source 4ea73f50cafdbf67e16dc71de985052075feca42; **28 ahead / 0 behind** after fetch. Final documentation HEAD/count and remote equality are reported after push, not embedded self-referentially. Runtime candidate 7a820b62bb1515f7b30ccf31badf1f0881a6bd84 and future checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518 remain frozen/not deployed. Two preexisting untracked user documents are preserved and excluded from this commit.

One all-state exact head/base PR search returned no PR. PR_CREATION_BLOCKED_BY_PERMISSION remains the prior integration failure, not a new attempt. No creation retry, CI trigger or merge was performed.

## Exact staging target / before and after

All IDs, names, attachment and mount were matched before the one mutation. Explicit project/environment CLI status was cross-checked against the API volume attachment; a reduced inventory query succeeded after a broader metadata query returned an internal error. No mismatch was observed and no production environment was selected.

| Target | Verified identity |
|---|---|
| Project | Rare / 72ed12be-9a2a-4e13-8594-30ffd8ffa565 |
| Environment | staging / d8399691-dacf-41e9-a9d5-060c97672e39 |
| PostgreSQL service | Postgres-MlyZ / ed0a374e-79da-4aab-9e3a-bb684fb829d1 |
| Volume | a0b78a5e-0dec-40ab-9d8c-c298be29ca5d |
| Volume instance | c5910985-a38a-479b-9274-e65ec6753c77 |
| Mount | /var/lib/postgresql/data |
| State / deletion | READY / no pending deletion / deletedAt null |
| Capacity / used | 5000 MB / 187.531264 MB; provider volume metadata, not SQL database size |

Read-only post-attempt inventory retained the same attachment/mount/READY state and these same latest deployments, all SUCCESS: PG a20b8647-5a81-4a0b-a44f-b096a58996f3; web 3e4874f3-397c-47fa-be77-73d1b0089ceb; worker d254cbc1-5f91-49ba-a866-1f596ae5151a; Redis 2bdaeb1f-cf82-4470-84a7-539ec337fb18. This is observed control-plane stability, not proof of zero backend work or zero independent application writes.

## Exactly one backup attempt / availability

Baseline successful listing: 0 snapshots, 0 schedules. The live GraphQL schema returned volumeInstanceBackupCreate(volumeInstanceId: String!, name: String): WorkflowId!, and workflowStatus(workflowId: String!): WorkflowResult. Provider-supported creation was used, not a direct volume-file copy. Completion would require workflow status Complete **and** a newly listed unexpired snapshot; a returned ID alone is insufficient.

| Evidence | Result |
|---|---|
| BACKUP_CREATE_ATTEMPTS | **1**, no automatic/manual retry |
| Request time | 2026-10-06T16:52:38.126Z |
| Mutation | volumeInstanceBackupCreate; exact instance c5910985-a38a-479b-9274-e65ec6753c77 only |
| Response | HTTP 200 with GraphQL INTERNAL_SERVER_ERROR at volumeInstanceBackupCreate |
| workflowId / backup ID | NOT RETURNED / NONE LISTED |
| Bounded post-attempt readbacks | 3 successful listings; all 0 snapshots / 0 schedules |
| Last backup readback | 2026-10-06T16:55:22.004Z |
| Creation outcome / backend work | UNKNOWN; creation success not verified |
| Provider status | No Complete workflow or AVAILABLE snapshot verified |
| Created-at / expiry / retention / size of backup | NOT AVAILABLE; no snapshot metadata returned |
| Structural cause / billing cause / cost incurred | UNKNOWN; no estimate or zero-cost assertion |
| STAGING_BACKUP_VERIFIED / BACKUP_AVAILABLE | **NO / NO**, no verified checkpoint |
| RESTORE_DRILL_VERIFIED | **NO**; no restore or new recovery resource attempted |

**MANUAL_BACKUP_FAILED** is the operational gate result, not proof that the backend could never create a snapshot later. [Railway API errors/retries](https://docs.railway.com/integrations/api#errors) state that INTERNAL_SERVER_ERROR can cover unexpected errors or authorization denial, and a mutation response can have side effects despite an error. No diagnosis of a damaged volume, billing limit or ACL failure is established by this generic response. No traceId was retained by the sanitized response capture; do not repeat the mutation to obtain one. The timestamp/operation/target can support owner-led private triage.

No second create, volume resize, schedule, lock/unlock, deletion, PITR enable, dump, restore or deployment was performed. If a delayed snapshot later appears, retain it and reconcile its identity/status through read-only checks; do not delete it or assume it proves a restore drill. [Railway backup semantics](https://docs.railway.com/volumes/backups).

## SSH / SQL disposition

Temporary personal key would be required for the previously unavailable SSH path, but the backup prerequisite failed. **KEY_GENERATED=NO; KEY_REGISTERED=NO; SSH_EXECUTED=NO; SQL_EXECUTED=NO.** No workspace-owned key, public key registration, tmux/session setup, tunnel-only, secret output, system ssh-agent start, host-key override or TLS weakening occurred. Temporary key removal/local keypair deletion: NOT APPLICABLE; none created. No human 2FA cleanup is required by this cycle.

Future authorized SQL must use only the exact staging PG target, BEGIN READ ONLY, SET LOCAL statement_timeout='5s', SET LOCAL lock_timeout='2s', and ROLLBACK. Query only migration_name, checksum, started_at, finished_at, rolled_back_at plus needed catalog metadata. No application rows or migration logs. This is a plan, **not a transaction executed this cycle**.

## Database history / checksum reference

**Current audited reference — 2026-10-07T19:05:37.743Z–19:05:43.430Z:** PostgreSQL **18.6 (Debian 18.6-1.pgdg13+2)**; **APPLIED=14; PENDING=0; FAILED=0; ROLLED_BACK=0; CHECKSUM_MISMATCH=0**; history **VERIFIED / CLEAN**, all 14 current table rows **APPLIED** with exact deployed-Git canonical checksums. No schema catalogs were needed or queried; current index/column/seed values were not independently inspected. The hashes are unchanged; the current state column supersedes the pre-audit UNKNOWN state.

**Historical pre-audit visibility record; superseded by the current audit above:** PostgreSQL version, schema/index/column metadata and all staging migration counts remain UNKNOWN. Repository contains **14 migrations**, freshly counted from deployed Git source. No failed/partial migration or mismatch was discovered; absence was also not established. **STAGING_MIGRATION_HISTORY_VERIFIED=NO; MIGRATE_DEPLOY_EXPECTED_NOOP=NOT PROVEN.**

**Historical checksum preparation; hash values retained:** Canonical SHA-256 values below were recomputed privately from SQL UTF-8 Git blobs at 4ea73f50cafdbf67e16dc71de985052075feca42, never from unnormalized Windows worktree bytes. They are migration-file checksums, not credential hashes. SQL/seed literals were not emitted. Installed Prisma 7.9.1 engine checksum matching accepts original/LF/CRLF equivalents; those variants were computed in memory. [Prisma checksum implementation](https://github.com/prisma/prisma-engines/blob/e922089b7d7502aff4249d5da3420f6fa55fc6ad/schema-engine/connectors/schema-connector/src/checksum.rs). Database comparison was **NOT EXECUTED** at that historical checkpoint; the current comparison completed at **2026-10-07T19:05:37.743Z–19:05:43.430Z**, with all 14 exact CANONICAL matches.

| Migration | Deployed Git canonical SHA-256 | Current staging state — 2026-10-07 audit |
|---|---|---|
| 20260511210000_init | c1c6b627ed850a3a627629a7cfd5a13b54023fca8829b747e21457c3fa1d4fae | APPLIED |
| 20260512013000_v1_5_customers_orders | 1407f307dea67e4d1da4c6a6762a4e5348b7bd35f3ed2d8f520937d7af1de30b | APPLIED |
| 20260512053542_v1_6_shipping_base | c17f536e9e14a96174b97178305ec2120151723ed839444a0a81ff0a09f4bbc9 | APPLIED |
| 20260515120000_v1_7_7_home_banners | 39a1fa5d5904f3d45b6cdcd6aaf191112c6d689ea291ac55ee55e35dfa498f34 | APPLIED |
| 20260520090000_v1_7_12_featured_sort_order | 1ab32731020e9905df44d1a989e890d50cfc28459e60048dbf71ef599c0afe0b | APPLIED |
| 20260524170000_v1_7_14_shipping_quote_snapshot | b5399d78493ffa2c331edb4f2fd751f4b90d6f78832569c444ca8431768ba954 | APPLIED |
| 20260606182000_operational_evidence | 410a0d66f54ffe6936b5c8ba52cc6d44671fd8b6a33bcadf355225a629440773 | APPLIED |
| 20260709120000_admin_sale_notifications | 355aef77a586aead7062bfedf6d57d4af35234ae68de73789a5a3c7d5e93a19d | APPLIED |
| 20260710120000_first_order_coupon | 333b79361a8a848a0d723511d5f398debd2d36ed99b12149f1624a85711b311e | APPLIED |
| 20260907150000_admin_temporary_password | bdc0a2739b2c00ffb5eec9b0b014bfddb3949bf25dfbf112d54bfd97e814d3ff | APPLIED |
| 20260907230000_payment_email_outbox | 5ecdca2155702386ad136edeab699f6e9ef706a46e02262304a5913b7c320fdc | APPLIED |
| 20260913120000_storefront_media_checkout_deadline | c3ca40d2e71f1391cba46fda8f3a6e5cdfe3ea9697ac50e6d28dac2ab3fec086 | APPLIED |
| 20260920120000_analytics_paid_at_index | a6059495a00e658d8ac1dd77875dbc215e654fd47713fb1b3e66eed45862e197 | APPLIED |
| 20260921120000_session_version | 63a12bf3b7df20b3fff1a90fed232cc43f9d721fed60a6bbc39ebcd6d470e076 | APPLIED |

**Historical pre-audit counts/risk assessment, retained rather than overwritten:** APPLIED=UNKNOWN; PENDING=UNKNOWN; FAILED=UNKNOWN; ROLLED_BACK=UNKNOWN; CHECKSUM_MISMATCH=UNKNOWN. No particular file is asserted pending. [Existing conditional risk manifest](SECRET_ACTIVATION_GATE.md#repository-migrations--conditional-risk-manifest) records operations/locks/data effects for all 14; narrow it only after trusted history. It includes blocking ordinary indexes, ALTER locks, auth/session effects and conditional Admin seed DML, not a DDL-only/no-risk manifest. Overall risk remains HIGH / unresolved; duration unknown. On failed/partial migration or genuine checksum mismatch: **P0 DATABASE MIGRATION INTEGRITY BLOCKER**, stop with no repair.

Migration executed NO; schema changed by this cycle NO; application data changed by this cycle NO. Existing independent runtime writers were neither paused nor inspected.

## Effective next configuration / activation analysis only

Fresh serviceInstance, environment.config(decryptVariables:false) and deployment metadata were rechecked without changes. Web and worker remain deployed at 4ea73f50cafdbf67e16dc71de985052075feca42, stored source branch integration/pre-go-live. Web stored/snapshot predeploy remains PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy; worker/PG/Redis predeploy NONE. **CURRENT_STORED_MIGRATION_EXECUTOR_COUNT=1; FUTURE_MIGRATION_EXECUTOR_COUNT=UNKNOWN.** Advisory locking remains disabled.

Both web/worker railwayConfigFile and rootDirectory remain null; resolved configFile null, fileManifest empty, resolution timestamps still 2026-09-25. The old snapshot does not prove next deployment resolution. EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED; no selector/config/source override was applied. Worker must not inherit the default web migration file in a future deployment.

| Path | Evidence / decision |
|---|---|
| Restart | Image reuse supported; newly stored secret refresh NOT PROVEN; NOT EXECUTED |
| Redeploy | Variable activation documented; current predeploy still runs, actual history unknown; NOT EXECUTED |
| Skipped build / previous image | Does not suppress predeploy; not a no-DDL guarantee |
| Temporary predeploy override | Separate config authority and effective-resolution proof needed; NOT EXECUTED |
| SAFE_SECRET_ACTIVATION_PATH | **NOT PROVEN**; no chosen safe path |

No reduced/no-op migration-risk conclusion is supported without actual history/checksum results and backup availability. [Restart](https://docs.railway.com/cli/restart), [redeploy](https://docs.railway.com/cli/redeploy), [predeploy](https://docs.railway.com/deployments/pre-deploy-command), [config precedence](https://docs.railway.com/config-as-code/reference). Existing detailed option analysis remains in the historical activation dossier; no operation is authorized by it.

## Final decision / next exact gate

| Gate | Decision |
|---|---|
| STAGING_MIGRATION_HISTORY_VERIFIED | NO |
| STAGING_BACKUP_VERIFIED | NO |
| BACKUP_AVAILABLE | NO |
| RESTORE_DRILL_VERIFIED | NO |
| PENDING_MIGRATIONS / FAILED_MIGRATIONS | UNKNOWN / UNKNOWN |
| SAFE_SECRET_ACTIVATION_PATH | NOT PROVEN |
| PHASE_M_REQUIRED | UNKNOWN until trusted history; no execution authorized |
| PHASE_S_CAN_RESUME | NO |

Credentials still compromised YES; rotated NO; RELEASE_SECURITY_FREEZE=ACTIVE. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. One backup attempt did not accomplish the known-history + verified-checkpoint objective.

Recommended next step: owner privately triages the one failed/ambiguous Railway request and confirms whether it produced an eventual snapshot; no additional backup is attempted under the exhausted one-request authorization. Any new creation attempt needs fresh explicit authority after outcome reconciliation. Only after a verified available checkpoint may the remaining temporary personal SSH metadata-only audit be considered under explicit renewed direction. Prove effective next web/worker configuration separately, then decide Phase M and readiness for a separately authorized Phase S. No access-control workaround, TLS bypass, production action, migration or rotation is implied. No support contact was sent.

## Documentation validation / stop

Only the five requested Markdown files change in Git. git diff --check PASS. release:guard: **6 OK / 1 unchanged legacy Vercel cron warning / 0 FAIL**, 322 source/document files and 43 existing browser-bundle files checked. Scoped five-doc plus working/staged Git-diff scan privately checked four configured affected staging categories and staging DB URL/password: **zero exact/pattern hits**, 33 relative file links / zero broken, balanced fences. All 14 canonical checksum references match deployed Git blobs. No production configuration was read by this scan; no raw credentials/output retained. Final staged validation and pushed SHA are reported at closure. No E2E/build/full application suite is required or run. The scoped scan is not a rerun of prior containment/history/artifact scans and does not close credential compromise.

Railway guidance informed live schema/readback verification, explicit target checking and no mutation retry; Postgres guidance kept SQL bounded/read-only and deferred until the backup gate. No keypair exists to clean up and no snapshot was deleted. STOP after sanitized docs commit/push and report; no Phase S, migration, restart/redeploy, bootstrap, provider homologation or automatic continuation.
