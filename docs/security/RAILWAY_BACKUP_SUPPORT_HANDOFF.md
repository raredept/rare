# Manual volume backup returns INTERNAL_SERVER_ERROR with no snapshot created

Assessment updated: 2026-10-07. **READY / DRAFT ONLY — OWNER_HANDLES_EXTERNALLY; CODEX_SUPPORT_NOT_CONTACTED. BACKUP_PROVIDER_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE.** The owner will handle the ticket separately; no owner ticket/result reference was supplied to this cycle, so no assertion is made about external owner contact. This is a sanitized evidence package for owner-led provider triage, not permission for another backup attempt or any recovery/configuration operation. See the [staging database gate](STAGING_DATABASE_GATE.md) for the cumulative migration/recovery decision.

The title describes the observed lack of a verified, listed snapshot. It does not establish that the backend performed no work or that a snapshot cannot appear later. Only preserved sanitized local evidence and current sanitized documents were inspected for an allowlisted trace ID: **TRACE_ID=NOT AVAILABLE**. No raw response, session transcript, environment file, credential or authentication configuration was opened or reproduced for that search. The initial capture did not cover every possible trace-ID location; raw-response absence is not asserted.

## Current owner diagnostic report / WARP A/B gate — 2026-10-07

The owner reports completion of official Railway Network Diagnostics; **execution timestamp was not supplied**. Sanitized results: HTTP endpoint **PASS/HTTP200**, edge **gru1**, traceroute **COMPLETED**, ping loss **0%**, latency approximately **19ms**, system resolver **connectivity-check.warp-svc / 127.0.2.2** with timeouts before resolution, Cloudflare **1.1.1.1 lookup PASS**, egress **AS13335**. Codex did not independently run/reproduce that diagnostic, download its tool or contact support. This new HTTP/DNS/routing evidence does not prove SSH health, provider failure or an internal WARP cause.

Codex's only current network-client operation was installed `warp-cli --help` and read-only `status`: **CONNECTED**, exit0, at **2026-10-07T15:11:41.592Z**, classification-only output/no configuration change. Historical SSH timeouts below lack a time-aligned verified WARP state. Controlled baseline **UNKNOWN**, without-WARP result **NOT SUPPLIED / NOT EXECUTED BY CODEX / OWNER EXECUTION UNKNOWN**, restoration after test **UNKNOWN**; current CONNECTED does not prove A/B completion/restoration. **WARP_SSH_INTERFERENCE=UNDETERMINED; RAILWAY_SSH_GATEWAY_FAILURE=NOT_PROVEN.** Await the owner's A/B results/target and restoration confirmation rather than repeating SSH. A timeout in both paths would leave local/authentication causes possible; Railway/upstream is only a triage hypothesis. A pass only without WARP would confirm traffic-path interference by A/B, not its internal mechanism.

WARP remains owner-controlled; no permanent WARP/split-tunnel/policy change or McAfee/Firewall/TLS/host-trust bypass is authorized. No new SSH/key/provider/SQL/backup/credential/configuration/deployment/production operation occurred. Historical personal-key cleanup remains verified; no fresh registration was attempted. Metadata audit remains conditional on official SSH PASS and exact current staging/runtime identity plus verified READ ONLY and final ROLLBACK/closure; no migration or later phase. Backup provider blockerYES/no third, rotationNO/freezeACTIVE remain independent.

## Exact staging target

| Field | Verified target / metadata |
|---|---|
| Project | Rare — 72ed12be-9a2a-4e13-8594-30ffd8ffa565 |
| Environment | staging — d8399691-dacf-41e9-a9d5-060c97672e39 |
| PostgreSQL service | Postgres-MlyZ — ed0a374e-79da-4aab-9e3a-bb684fb829d1 |
| PostgreSQL service instance | 3b37cfd9-f315-40df-a8a6-35673912d346 |
| Volume | a0b78a5e-0dec-40ab-9d8c-c298be29ca5d |
| Volume instance | c5910985-a38a-479b-9274-e65ec6753c77 |
| Mount / state | /var/lib/postgresql/data / READY |
| Capacity / dated used | 5000 MB / 187.547648 MB, historical read-only observation at 2026-10-06T20:41:33.034Z; prior attempt-window usage 187.531264 MB; not refreshed in this cycle |
| Region | UNKNOWN |

The volume instance was resolved to this exact project/environment/service/volume; volume ID and volume-instance ID are not interchangeable. Used storage is volume metadata, not `pg_database_size`, logical dump size or a measured snapshot size. No connection URL, credential, authorization header, application data or personal identity is included.

## Attempts and readbacks — UTC

| Time | Operation / observed result |
|---|---|
| 2026-10-06T16:52:38.126Z | Prior first authorized `volumeInstanceBackupCreate` request: HTTP 200 with `INTERNAL_SERVER_ERROR`; no verified workflow ID or backup ID. TRACE_ID=NOT AVAILABLE in the retained sanitized evidence. |
| Prior first-attempt readbacks; last 2026-10-06T16:55:22.004Z | Three successful readbacks observed 0 snapshots and 0 schedules. Earlier two timestamps are not specified in this handoff. |
| 2026-10-06T17:30:27.210Z | Fresh reconciliation before the separately authorized final attempt: 0 snapshots / 0 schedules. |
| 2026-10-06T17:30:46.574Z | Second and final authorized creation request, same exact volume instance: HTTP 200 with `INTERNAL_SERVER_ERROR`; no usable workflow ID verified; TRACE_ID=NOT AVAILABLE in the sanitized evidence. No verified backup ID. |
| 2026-10-06T17:30:48.048Z | Successful readback: 0 snapshots / 0 schedules. |
| 2026-10-06T17:32:38.169Z | Successful bounded readback: 0 snapshots / 0 schedules. |
| 2026-10-06T17:52:44.877Z | Final successful read-only reconciliation after the local audit abort: 0 snapshots / 0 schedules. |
| 2026-10-06T20:43:01.586Z | Historical 2026-10-06 identity cycle's single final read-only backup reconciliation: 0 snapshots / 0 schedules; no late snapshot verified. |
| 2026-10-07T01:57:46.330Z | Master Cycle read-only reconciliation (October 6 local): 0 snapshots / 0 schedules; no late snapshot verified; no creation request. |
| 2026-10-07T11:53:30.918Z | Human-assisted Phase 2 single read-only listing: 0 snapshots / 0 schedules; no late snapshot verified; no creation request or automatic polling. |
| 2026-10-07T13:59:32.490Z | Previous Phase 2 cycle's final read-only listing: 0 snapshots / 0 schedules; no late snapshot verified; no creation request. This is the last verified listing, not a refresh during the later SSH-isolation cycle. |

Exactly **two creation requests across the two authorizations** are recorded. The second request was separately authorized after fresh reconciliation, not an automatic retry of the first. **NO_THIRD_ATTEMPT.** No completed workflow or available snapshot was verified. An empty inventory at these times does not prove that no internal work occurred or that no delayed snapshot can appear later.

## Diagnosis boundaries

| Classification | Current conclusion |
|---|---|
| BACKUP_PROVIDER_BLOCKER | YES — operational failure to obtain the required provider snapshot; not a structural diagnosis |
| BACKUP_AVAILABLE | NO_VERIFIED_BACKUP; listed snapshot count 0 at the recorded readbacks |
| WORKFLOW_COMPLETION | UNKNOWN; no workflow ID for status polling |
| TRACE_ID | NOT AVAILABLE in inspected sanitized local evidence/documents; no correlation ID fabricated. The initial parser did not cover every possible location, so raw-response absence is not asserted. |
| BACKEND_OPERATION_OUTCOME | UNKNOWN |
| AUTHORIZATION / QUOTA / BILLING_CAUSE | UNKNOWN; generic error does not identify a cause |
| COST_INCURRED | UNKNOWN; no zero-cost assertion or invented amount |
| DOCUMENTED_50_PERCENT_LIMIT_NOT_INDICATED | Observed used storage is about 3.75% of capacity; this does not prove all internal eligibility checks passed |
| RESTORE_DRILL_VERIFIED | NO; no restore attempted or recovery proved |

The [Railway API error contract](https://docs.railway.com/integrations/api#errors) describes `INTERNAL_SERVER_ERROR` as an unexpected failure or an authorization denial. HTTP 200 alone is not success. The [mutation retry guidance](https://docs.railway.com/integrations/api#retries) warns that a response does not provide exactly-once guarantees and repeating a write may duplicate effects. No third request is authorized by this record.

[Railway Backups](https://docs.railway.com/volumes/backups) documents a manual-backup limit of 50% of volume capacity. The observed occupancy does not indicate that threshold was exceeded, but does not establish the actual failure cause. Do not resize storage, change a plan or permissions, or enable another backup mechanism to test an unsupported hypothesis.

Public status was checked at **2026-10-06 17:29:35–17:29:50 UTC**: the [official status page](https://status.railway.com/) displayed **Fully Operational**, with no broad backup incident confirmed by that observation. Its scope excludes smaller/isolated issues; this is not proof that this account, volume or backup request was healthy.

A second official status observation around **17:52 UTC** retained the same Fully Operational display and the same isolated-issue limitation. No public status finding changes the failed backup gate or authorizes another request.

## Owner-ready support message — DRAFT / CODEX_NOT_SENT; OWNER_STATUS_NOT_VERIFIED

**Subject: Manual volume backup returns INTERNAL_SERVER_ERROR with no snapshot created**

Hello Railway Support,

Please investigate and reconcile two authorized manual backup requests for our staging PostgreSQL volume instance. Each GraphQL `volumeInstanceBackupCreate` request returned HTTP 200 with `INTERNAL_SERVER_ERROR`. We have not verified a completed workflow or available snapshot. The title refers to this observed result, not proof that no backend work occurred.

Exact resources:

- Project: Rare — 72ed12be-9a2a-4e13-8594-30ffd8ffa565.
- Environment: staging — d8399691-dacf-41e9-a9d5-060c97672e39.
- PostgreSQL service: Postgres-MlyZ — ed0a374e-79da-4aab-9e3a-bb684fb829d1.
- PostgreSQL service instance: 3b37cfd9-f315-40df-a8a6-35673912d346.
- Volume: a0b78a5e-0dec-40ab-9d8c-c298be29ca5d.
- Volume instance: c5910985-a38a-479b-9274-e65ec6753c77.
- Mount/state: /var/lib/postgresql/data / READY.
- Observed capacity/used storage: 5000 MB / 187.547648 MB at 2026-10-06T20:41:33.034Z; prior attempt-window usage 187.531264 MB; region UNKNOWN.

Request timestamps are UTC:

1. 2026-10-06T16:52:38.126Z — first request: HTTP 200, GraphQL `INTERNAL_SERVER_ERROR`; no usable workflow ID or backup ID verified.
2. 2026-10-06T17:30:46.574Z — separately authorized second and final request, after fresh reconciliation: HTTP 200, GraphQL `INTERNAL_SERVER_ERROR`; no usable workflow ID or backup ID verified.

**TRACE_ID=NOT AVAILABLE** in the preserved sanitized local evidence for either request. We are not asserting that the raw responses contained no trace ID, and will not repeat a mutation merely to capture one. Please use the timestamps, operation and exact target identifiers to locate the server-side requests or supply another safe correlation method.

Expected result: one available manual snapshot for the specified staging volume instance. Actual result: none verified. Three readbacks after the first request showed 0 snapshots / 0 schedules, the last at 2026-10-06T16:55:22.004Z. Fresh reconciliation before request two at 2026-10-06T17:30:27.210Z also showed 0 / 0. Readbacks after request two at 2026-10-06T17:30:48.048Z, 2026-10-06T17:32:38.169Z and 2026-10-06T17:52:44.877Z each showed 0 snapshots / 0 schedules. This evidence does not exclude an unlisted/pending workflow or later snapshot.

The subsequent diagnostic reconciliation at 2026-10-06T20:43:01.586Z, Master Cycle listing at 2026-10-07T01:57:46.330Z, human-assisted Phase 2 listing at 2026-10-07T11:53:30.918Z and last verified read-only listing at **2026-10-07T13:59:32.490Z** each returned **0 snapshots / 0 schedules**. The later SSH-isolation cycle did not query backups. No third backup creation request has been sent. No provider reconciliation was supplied to this cycle; internal outcomes and recovery/incident closure remain unverified. Capacity/attachment figures above remain the dated 2026-10-06T20:41:33.034Z observation, not a new Master Cycle metadata verification.

Please answer these questions separately:

1. What was the backend outcome of **each** request: rejected, accepted/enqueued, running, completed, failed or partially completed? Is any workflow or snapshot still pending, delayed or recoverable? Please provide the applicable workflow/snapshot identifiers or read-only reconciliation procedure.
2. What was the actual failure cause? Do any account/project permissions, plan eligibility, quotas, manual-backup limits or other provider constraints apply to this exact volume instance? Our observed occupancy is about 3.75% of capacity; the documented 50% manual-backup limit is not indicated by that measurement, but we are not claiming all eligibility checks passed.
3. After reconciling both requests, would any future retry be safe, or could it duplicate an existing/pending operation? What supported prerequisite or remediation would be required? **Do not perform another creation request on our behalf.** We have a strict **NO_THIRD_ATTEMPT** boundary; any future attempt requires new explicit owner authority, not merely provider advice that retrying is possible.
4. Was any storage, workflow or other usage incurred/charged by either request despite no verified snapshot? Please clarify the billing outcome separately; we currently classify it as UNKNOWN and have not assumed zero cost.

This is a request for diagnosis and reconciliation, not authorization to create another backup, restore data, lock/delete a backup, alter schedules, enable PITR, create a dump, resize storage, change a plan/permissions/configuration, or restart/redeploy any service. We have not performed a restore drill; recoverability and operational closure remain unverified. No secret, database URL, token or application row is included.

Thank you.

If Railway supplies a correlation ID, preserve it in the sanitized incident record. Request IDs/trace IDs from unavailable evidence must not be invented. Share through a legitimate owner-approved support channel; do not attach raw session/tool transcripts, `.env` files, API tokens, database URLs, keys or application rows.

## SSH routing diagnostic evidence — 2026-10-07 UTC

**CASE_B; RAILWAY_SSH_GATEWAY_OR_LOCAL_ROUTE_BLOCKER=YES; OBSERVED_STAGE=NATIVE_SSH_AFTER_TCP_ESTABLISHED; ROOT_CAUSE=UNKNOWN.** This classification identifies the shared blocked post-TCP SSH path, not a proven gateway, server, local-network or authentication cause. Runtime target and remote execution remain unverified; no SQL was executed. The authorized diagnostic used Railway CLI **5.26.0** with native Windows OpenSSH, no caller-supplied `-i`, helper, tunnel or host-trust bypass.

| UTC evidence | Sanitized observation |
|---|---|
| 14:29:25.435Z | Owner's native SSH agent AVAILABLE; one ED25519 identity, expected fingerprint MATCH. This does not prove which identity the relay accepted. |
| 14:30:57.484Z | Only the matching owner-provided existing `.pub` was registered in the PERSONAL Railway bucket: inventory 0 -> 1. No key was generated or imported from another source. |
| 14:31:46.034Z | `Resolve-DnsName` / `Test-NetConnection`: relay DNS PASS and TCP/22 REACHABLE. No IP addresses or raw network output reproduced. |
| 14:32:38.079Z | Railway SSH config dry-run generated `HostName ssh.railway.com` and `User 3b37cfd9-f315-40df-a8a6-35673912d346`, matching the PostgreSQL Service Instance ID. |
| 14:34:30.252Z | Existing owner identity path comparison MATCH; SSH configuration remained unchanged. No private-key body or owner path reproduced. |
| 14:33:51.366Z–14:33:53.157Z | Read-only control-plane routing matched the exact Rare / staging PostgreSQL and web targets listed below. RUNNING is deployment-instance metadata, not proof of an SSH session. |
| 14:39:49.590Z / 14:39:52.008Z | Only this cycle's new PERSONAL registration was removed; readback inventory EMPTY and expected fingerprint ABSENT. Owner files were preserved and the agent remained AVAILABLE / MATCH; no audit native SSH process remained. |

| Target | Service ID | Service Instance ID | Deployment ID | RUNNING Deployment Instance ID |
|---|---|---|---|---|
| Postgres-MlyZ / staging | ed0a374e-79da-4aab-9e3a-bb684fb829d1 | 3b37cfd9-f315-40df-a8a6-35673912d346 | a20b8647-5a81-4a0b-a44f-b096a58996f3 | 371feb81-4709-4070-a96a-d9ad854e254b |
| Web / staging | 3f4b79f6-2819-45a6-986d-584dc7ac803a | d6368ea1-30e4-4593-b35a-65f21537a1ed | 3e4874f3-397c-47fa-be77-73d1b0089ceb | a47838d1-1f83-4127-960a-1ffc8d49d8d3 |

The web control-plane source was `4ea73f5` (`main`); this is not a new deployment or verification of runtime behavior. Project/environment identifiers are the exact staging target above.

Exactly **three** bounded remote `true` diagnostic attempts were made; the command was requested, not verified as executed:

| UTC start / stop | Routing mode | Result |
|---|---|---|
| 14:35:54.368Z / 14:36:22.793Z | PostgreSQL via explicit project/environment/service resolution | TIMEOUT |
| 14:38:17.584Z / 14:38:45.952Z | PostgreSQL via independently matched RUNNING Deployment Instance ID | TIMEOUT |
| 14:38:17.924Z / 14:38:45.955Z | Web via explicit project/environment/service resolution | TIMEOUT |

Each had a **25-second command deadline**, plus scoped termination/cleanup time. Each native child had `TARGET_MATCH=YES` and a TCP/22 connection in ESTABLISHED state; each timed-out child was stopped. The CLI automatically supplied `-i` for the existing owner identity; the caller did not force that flag. There was no additional retry, successful remote-command marker, runtime-target proof or authentication proof. No web fallback, database-binding query, SQL, schema read, migration count or database row was obtained. Database history/counts remain UNKNOWN.

In the [versioned CLI resolution](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/mod.rs#L83-L111), default service routing resolves `serviceInstance(environmentId, serviceId).id`; `--deployment-instance` instead uses the supplied identifier directly and does not validate it through the project/environment/service flags. The explicit-instance test above relied on the separate matched control-plane observation. [Official SSH docs](https://docs.railway.com/cli/ssh) distinguish Service ID from valid Service Instance / Deployment Instance SSH usernames. The [Windows discovery implementation](https://github.com/railwayapp/cli/blob/v5.26.0/src/controllers/ssh/keys.rs#L60-L122) uses Pageant and can fall back to `.pub` files; the [native identity logic](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/native.rs#L147-L160) can consequently add `-i` automatically. These implementation facts do not establish the timeout's cause.

Basic DNS/TCP failure, a mismatched supplied child target and a PostgreSQL-only failure are **not indicated by these observations**; they are not universally ruled out. Server versus local routing, host-key negotiation, authentication and later protocol stages remain UNKNOWN. The historical quarantined custom helper remains ABANDONED / trust UNKNOWN; these official-client timeouts do not prove another endpoint-security quarantine or that endpoint protection was resolved.

Backup availability was **not refreshed** in this cycle: the last verified previous-cycle inventory is 2026-10-07T13:59:32.490Z, 0 snapshots / 0 schedules. Cumulative backup creation requests remain two, with **NO_THIRD_ATTEMPT**. Configuration/activation verification and recovery approval remain independent, NOT VERIFIED; **RELEASE_SECURITY_FREEZE=ACTIVE**.

## Owner-ready SSH addendum — DRAFT / CODEX_NOT_SENT; OWNER_STATUS_NOT_VERIFIED

**Subject: Native Railway SSH times out after TCP/22 establishes for staging PostgreSQL and web**

Hello Railway Support,

Please investigate the shared SSH access path for the exact Rare/staging targets in the preceding diagnostic tables. On 2026-10-07 UTC, Railway CLI 5.26.0 using native Windows OpenSSH timed out on three bounded remote `true` requests: PostgreSQL service routing at 14:35:54.368Z–14:36:22.793Z; its independently matched running deployment instance at 14:38:17.584Z–14:38:45.952Z; and web service routing at 14:38:17.924Z–14:38:45.955Z. Each had a 25-second command deadline followed by scoped cleanup.

DNS resolution and TCP/22 reachability passed at 14:31:46.034Z. Each SSH child's target matched the intended identifier and its TCP connection reached ESTABLISHED. Our native agent reported the expected ED25519 identity; only its matching existing public key was registered temporarily in the PERSONAL bucket. The CLI selected an existing identity with automatic `-i`; the caller did not supply `-i`. Neither authentication, the runtime target nor completion of `true` was verified. No SQL or application-data query was executed. We cannot determine whether the cause is the relay/server path, local route, authentication or another post-TCP SSH stage.

The temporary PERSONAL registration was removed at 14:39:49.590Z; readback at 14:39:52.008Z was empty with that fingerprint absent. Owner key files and agent identity were preserved. No audit SSH process remains. We have stopped further attempts rather than treating a TCP connection as an authenticated session.

Please correlate the UTC windows and exact identifiers with relay-side records, identify the last completed protocol stage and advise a supported, read-only diagnostic that can distinguish provider-side routing from local/network/authentication behavior. Please specify the minimal sanitized fields needed; no raw transcripts, secret, private/public key body, database URL or application row is supplied. The separate backup requests and their UNKNOWN backend/billing outcomes remain in the original message above; please do not conflate their unavailable trace IDs with this SSH evidence.

This addendum requests diagnosis only. It does not authorize another backup, key creation/import, restore, dump, restart/deploy, secret activation/rotation, production operation or configuration change. Please do not perform recovery or infrastructure changes on our behalf. Release security freeze remains ACTIVE.

Thank you.

The [official Railway Network Diagnostics](https://docs.railway.com/networking/troubleshooting/network-diagnostics) are now owner-reported complete; the next evidence is the owner-controlled WARP A/B outcome and restoration confirmation described above, not an instruction to repeat the diagnostic. Codex did not contact support or download/execute a diagnostic tool; owner external contact/result is not inferred. Share only reviewed sanitized evidence through a legitimate owner-approved channel. Do not disable or weaken antivirus, firewall, TLS or SSH host trust, change permanent WARP/SSH/global configuration, reuse the abandoned helper, or resume retries/provider mutations without the current access gate and exact authority.

## Scope and stop

This handoff neither contacts support nor authorizes more provider writes. No restore, backup lock/delete, schedule modification, PITR enable, logical dump, deploy/restart or secret rotation is included. SQL/access evidence is governed separately by the [staging database gate](STAGING_DATABASE_GATE.md), not by snapshot availability inferred from this document. Backup failure does not itself prove a database schema defect, and any later metadata access does not prove backup recoverability.

Stop backup execution after the second authorized request; retain sanitized evidence and the release freeze pending provider/owner resolution.

Last verified previous-cycle backup reconciliation: **2026-10-07T13:59:32.490Z — 0 snapshots / 0 schedules; LATE_SNAPSHOT=NO; BACKUP_AVAILABLE=NO; BACKUP_PROVIDER_BLOCKER=YES.** It was not refreshed in the subsequent SSH-isolation cycle. Current phase/authority is in the [canonical Master status](../cycles/RARE_MASTER_STATUS.md). Prior Master Cycle volume/GitHub **read** failures are not new backup mutations and their trace IDs must not be attributed to either historical creation attempt. No further creation, deletion, restore, Codex support contact or automatic polling follows this handoff; owner support handling remains separate.
