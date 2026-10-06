# RARE — Railway staging backup support handoff

Assessment: 2026-10-06. **DRAFT ONLY — SUPPORT_NOT_CONTACTED. BACKUP_PROVIDER_BLOCKER=YES; RELEASE_SECURITY_FREEZE=ACTIVE.** This is a sanitized evidence package for owner-led provider triage, not permission for another backup attempt or any recovery/configuration operation. See the [staging database gate](STAGING_DATABASE_GATE.md) for the cumulative migration/recovery decision.

## Exact staging target

| Field | Verified target / metadata |
|---|---|
| Project | Rare — 72ed12be-9a2a-4e13-8594-30ffd8ffa565 |
| Environment | staging — d8399691-dacf-41e9-a9d5-060c97672e39 |
| PostgreSQL service | Postgres-MlyZ — ed0a374e-79da-4aab-9e3a-bb684fb829d1 |
| Volume | a0b78a5e-0dec-40ab-9d8c-c298be29ca5d |
| Volume instance | c5910985-a38a-479b-9274-e65ec6753c77 |
| Mount / state | /var/lib/postgresql/data / READY |
| Capacity / current used | 5000 MB / 187.531264 MB |
| Region | UNKNOWN |

The volume instance was resolved to this exact project/environment/service/volume; volume ID and volume-instance ID are not interchangeable. Used storage is volume metadata, not `pg_database_size`, logical dump size or a measured snapshot size. No connection URL, credential, authorization header, application data or personal identity is included.

## Attempts and readbacks — UTC

| Time | Operation / observed result |
|---|---|
| 2026-10-06T16:52:38.126Z | Prior first authorized `volumeInstanceBackupCreate` request: HTTP 200 with `INTERNAL_SERVER_ERROR`; no verified workflow ID or backup ID. TRACE_ID=NOT_CAPTURED in the retained sanitized evidence. |
| Prior first-attempt readbacks; last 2026-10-06T16:55:22.004Z | Three successful readbacks observed 0 snapshots and 0 schedules. Earlier two timestamps are not specified in this handoff. |
| 2026-10-06T17:30:27.210Z | Fresh reconciliation before the separately authorized final attempt: 0 snapshots / 0 schedules. |
| 2026-10-06T17:30:46.574Z | Second and final authorized creation request, same exact volume instance: HTTP 200 with `INTERNAL_SERVER_ERROR`; no workflow ID returned; TRACE_ID=NOT_CAPTURED in the sanitized evidence. No verified backup ID. |
| 2026-10-06T17:30:48.048Z | Successful readback: 0 snapshots / 0 schedules. |
| 2026-10-06T17:32:38.169Z | Successful bounded readback: 0 snapshots / 0 schedules. |
| 2026-10-06T17:52:44.877Z | Final successful read-only reconciliation after the local audit abort: 0 snapshots / 0 schedules. |

Exactly **two creation requests across the two authorizations** are recorded. The second request was separately authorized after fresh reconciliation, not an automatic retry of the first. **NO_THIRD_ATTEMPT.** No completed workflow or available snapshot was verified. An empty inventory at these times does not prove that no internal work occurred or that no delayed snapshot can appear later.

## Diagnosis boundaries

| Classification | Current conclusion |
|---|---|
| BACKUP_PROVIDER_BLOCKER | YES — operational failure to obtain the required provider snapshot; not a structural diagnosis |
| BACKUP_AVAILABLE | NO_VERIFIED_BACKUP; listed snapshot count 0 at the recorded readbacks |
| WORKFLOW_COMPLETION | UNKNOWN; no workflow ID for status polling |
| TRACE_ID | NOT_CAPTURED; no correlation ID is available in the sanitized evidence. The initial parser did not cover every possible location, so raw-response absence is not asserted. |
| BACKEND_OPERATION_OUTCOME | UNKNOWN |
| AUTHORIZATION / QUOTA / BILLING_CAUSE | UNKNOWN; generic error does not identify a cause |
| COST_INCURRED | UNKNOWN; no zero-cost assertion or invented amount |
| DOCUMENTED_50_PERCENT_LIMIT_NOT_INDICATED | Observed used storage is about 3.75% of capacity; this does not prove all internal eligibility checks passed |
| RESTORE_DRILL_VERIFIED | NO; no restore attempted or recovery proved |

The [Railway API error contract](https://docs.railway.com/integrations/api#errors) describes `INTERNAL_SERVER_ERROR` as an unexpected failure or an authorization denial. HTTP 200 alone is not success. The [mutation retry guidance](https://docs.railway.com/integrations/api#retries) warns that a response does not provide exactly-once guarantees and repeating a write may duplicate effects. No third request is authorized by this record.

[Railway Backups](https://docs.railway.com/volumes/backups) documents a manual-backup limit of 50% of volume capacity. The observed occupancy does not indicate that threshold was exceeded, but does not establish the actual failure cause. Do not resize storage, change a plan or permissions, or enable another backup mechanism to test an unsupported hypothesis.

Public status was checked at **2026-10-06 17:29:35–17:29:50 UTC**: the [official status page](https://status.railway.com/) displayed **Fully Operational**, with no broad backup incident confirmed by that observation. Its scope excludes smaller/isolated issues; this is not proof that this account, volume or backup request was healthy.

A second official status observation around **17:52 UTC** retained the same Fully Operational display and the same isolated-issue limitation. No public status finding changes the failed backup gate or authorizes another request.

## Proposed private support request — not sent

> Please investigate the two manual backup requests for the exact staging PostgreSQL volume instance above using their UTC timestamps and resource IDs. Both returned HTTP 200 with `INTERNAL_SERVER_ERROR`; no workflow ID or available snapshot was verified, and the latest recorded inventory remained empty. Please identify the internal request/workflow outcome, any pending operation or delayed snapshot, and the actual permission, quota, billing or backend condition involved. Confirm any charged usage separately. Do not create another backup, restore data, restart/redeploy a service, or change configuration without separate owner approval.

If Railway supplies a correlation ID, preserve it in the sanitized incident record. Request IDs/trace IDs from unavailable evidence must not be invented. Share through a legitimate owner-approved support channel; do not attach raw session/tool transcripts, `.env` files, API tokens, database URLs, keys or application rows.

## Scope and stop

This handoff neither contacts support nor authorizes more provider writes. No restore, backup lock/delete, schedule modification, PITR enable, logical dump, deploy/restart or secret rotation is included. SQL/access evidence is governed separately by the [staging database gate](STAGING_DATABASE_GATE.md), not by snapshot availability inferred from this document. Backup failure does not itself prove a database schema defect, and any later metadata access does not prove backup recoverability.

Stop backup execution after the second authorized request; retain sanitized evidence and the release freeze pending provider/owner resolution.
