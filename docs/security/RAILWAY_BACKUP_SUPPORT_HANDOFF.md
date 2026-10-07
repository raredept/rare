# Manual volume backup returns INTERNAL_SERVER_ERROR with no snapshot created

Assessment updated: 2026-10-07. **READY / DRAFT ONLY — OWNER_HANDLES_EXTERNALLY; CODEX_SUPPORT_NOT_CONTACTED. BACKUP_PROVIDER_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE.** The owner will handle the ticket separately; no owner ticket/result reference was supplied to this cycle, so no assertion is made about external owner contact. This is a sanitized evidence package for owner-led provider triage, not permission for another backup attempt or any recovery/configuration operation. See the [staging database gate](STAGING_DATABASE_GATE.md) for the cumulative migration/recovery decision.

The title describes the observed lack of a verified, listed snapshot. It does not establish that the backend performed no work or that a snapshot cannot appear later. Only preserved sanitized local evidence and current sanitized documents were inspected for an allowlisted trace ID: **TRACE_ID=NOT AVAILABLE**. No raw response, session transcript, environment file, credential or authentication configuration was opened or reproduced for that search. The initial capture did not cover every possible trace-ID location; raw-response absence is not asserted.

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
| 2026-10-06T20:43:01.586Z | This cycle's single final read-only backup reconciliation: 0 snapshots / 0 schedules; no late snapshot verified. |
| 2026-10-07T01:57:46.330Z | Master Cycle read-only reconciliation (October 6 local): 0 snapshots / 0 schedules; no late snapshot verified; no creation request. |
| 2026-10-07T11:53:30.918Z | Human-assisted Phase 2 single read-only listing: 0 snapshots / 0 schedules; no late snapshot verified; no creation request or automatic polling. |

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

The subsequent diagnostic reconciliation at 2026-10-06T20:43:01.586Z, Master Cycle listing at 2026-10-07T01:57:46.330Z and latest human-assisted Phase 2 read-only listing at **2026-10-07T11:53:30.918Z** each returned **0 snapshots / 0 schedules**. No third backup creation request has been sent. No provider reconciliation was supplied to this cycle; internal outcomes and recovery/incident closure remain unverified. Capacity/attachment figures above remain the dated 2026-10-06T20:41:33.034Z observation, not a new Master Cycle metadata verification.

Please answer these questions separately:

1. What was the backend outcome of **each** request: rejected, accepted/enqueued, running, completed, failed or partially completed? Is any workflow or snapshot still pending, delayed or recoverable? Please provide the applicable workflow/snapshot identifiers or read-only reconciliation procedure.
2. What was the actual failure cause? Do any account/project permissions, plan eligibility, quotas, manual-backup limits or other provider constraints apply to this exact volume instance? Our observed occupancy is about 3.75% of capacity; the documented 50% manual-backup limit is not indicated by that measurement, but we are not claiming all eligibility checks passed.
3. After reconciling both requests, would any future retry be safe, or could it duplicate an existing/pending operation? What supported prerequisite or remediation would be required? **Do not perform another creation request on our behalf.** We have a strict **NO_THIRD_ATTEMPT** boundary; any future attempt requires new explicit owner authority, not merely provider advice that retrying is possible.
4. Was any storage, workflow or other usage incurred/charged by either request despite no verified snapshot? Please clarify the billing outcome separately; we currently classify it as UNKNOWN and have not assumed zero cost.

This is a request for diagnosis and reconciliation, not authorization to create another backup, restore data, lock/delete a backup, alter schedules, enable PITR, create a dump, resize storage, change a plan/permissions/configuration, or restart/redeploy any service. We have not performed a restore drill; recoverability and operational closure remain unverified. No secret, database URL, token or application row is included.

Thank you.

If Railway supplies a correlation ID, preserve it in the sanitized incident record. Request IDs/trace IDs from unavailable evidence must not be invented. Share through a legitimate owner-approved support channel; do not attach raw session/tool transcripts, `.env` files, API tokens, database URLs, keys or application rows.

## Scope and stop

This handoff neither contacts support nor authorizes more provider writes. No restore, backup lock/delete, schedule modification, PITR enable, logical dump, deploy/restart or secret rotation is included. SQL/access evidence is governed separately by the [staging database gate](STAGING_DATABASE_GATE.md), not by snapshot availability inferred from this document. Backup failure does not itself prove a database schema defect, and any later metadata access does not prove backup recoverability.

Stop backup execution after the second authorized request; retain sanitized evidence and the release freeze pending provider/owner resolution.

Latest read-only reconciliation: **2026-10-07T11:53:30.918Z — 0 snapshots / 0 schedules; LATE_SNAPSHOT=NO; BACKUP_AVAILABLE=NO; BACKUP_PROVIDER_BLOCKER=YES.** Current phase/authority is in the [canonical Master status](../cycles/RARE_MASTER_STATUS.md). Prior Master Cycle volume/GitHub **read** failures are not new backup mutations and their trace IDs must not be attributed to either historical creation attempt. No further creation, deletion, restore, Codex support contact or automatic polling follows this handoff; owner support handling remains separate.
