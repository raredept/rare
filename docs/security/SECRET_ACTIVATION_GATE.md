# RARE — secret activation & migration gate

## Current recovery-gate attempt — 2026-10-06

**MANUAL_BACKUP_FAILED; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Current execution record: [STAGING_DATABASE_GATE.md](STAGING_DATABASE_GATE.md). Owner authorized exactly one staging PG backup and conditional temporary personal SSH/metadata access after availability, not Phase M/S/P. All target IDs were matched. One volumeInstanceBackupCreate request at 2026-10-06T16:52:38.126Z returned HTTP 200 / INTERNAL_SERVER_ERROR without workflowId; three subsequent listings showed 0 snapshots / 0 schedules, last at 16:55:22.004Z. BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; backend outcome/cost UNKNOWN. No second create or retry.

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
