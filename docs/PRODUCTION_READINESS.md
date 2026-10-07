# RARE — production readiness

## Current Master Cycle — 2026-10-07

Canonical current state: [RARE_MASTER_STATUS.md](cycles/RARE_MASTER_STATUS.md); relevant events: [RARE_MASTER_LOG.md](cycles/RARE_MASTER_LOG.md). **CURRENT_PHASE=2; PHASE_RESULT=BLOCKED; RELEASE_SECURITY_FREEZE=ACTIVE.** The Master Cycle supersedes earlier execution authority; specialized runbooks below retain dated evidence, not current approvals.

Fresh agent-ready resume baseline on October 7 local (13:46–13:59 UTC): entry local/remote docs HEAD 192fa74ba1535648c68d50254959921b4896ff3d, 34 ahead / 0 behind; final publication counts/equality will be verified at publication closure in canonical status/Git. Main remains 4ea73f50cafdbf67e16dc71de985052075feca42. Exact Rare/staging/Postgres-MlyZ control-plane IDs/names matched at 13:50:29.234Z; four deployments unchanged/SUCCESS, staging web/worker source main SHA. Not SSH runtime/health proof; no runtime candidate 7a820b62bb1515f7b30ccf31badf1f0881a6bd84 deployment here. The single exact PR query at 13:47:33 UTC returned none. No fresh CI query; earlier zero-context/check-run/Actions observations remain NO_EVIDENCE, not PASS. Required gates UNKNOWN; no PR creation/retry/merge or Phase 3 advancement.

Owner-loaded Windows OpenSSH Agent verified AVAILABLE at 13:46:32.618Z: one ED25519 identity, expected SHA256:/zRd8vyuiyuw1Fw6j8FwvblSntw8+kdoM/Py4aOeGtw MATCH. Existing supplied private/.pub remain outside repository/not reparse points/unchanged; public fingerprint reconfirmed 13:49:26.581Z. Personal Railway inventory 0→1 at 13:51:18.162Z with only authorized .pub/name; no private transmission. Normal official SSH with explicit three IDs and no caller-forced -i/helper/tunnel/session timed out before runtime proof; scoped audit child stopped at 13:56:20 UTC, no SQL or DB session. Only new PERSONAL registration removed at 13:57:11.794Z; empty readback 13:57:14.714Z, no 2FA needed. Owner pair/agent preserved. Current stop: SSH_ATTEMPT_TIMEOUT / SSH_RUNTIME_TARGET_NOT_VERIFIED, not unavailable agent or passphrase request; remote authentication/cause/private encryption unverified. No helper/AV/host-trust/agent-service change or key-body/passphrase output. Fourteen canonical Git references match, but DB version/five counts/all states and three critical migrations remain UNKNOWN; history verified NO / clean UNKNOWN / no-op UNKNOWN / Phase M UNKNOWN. Single current backup read 2026-10-07T13:59:32.490Z: 0 snapshots/0 schedules, no late snapshot visible; two cumulative creates/no third. Backup available NO verified checkpoint/provider blocker YES; workflow/cause/cost/restore unproved, capacity historical. Support READY DRAFT / OWNER_HANDLES_EXTERNALLY unchanged; no Codex message or owner result supplied. Effective next-deploy config independently NOT VERIFIED.

Historical stored staging classification at 2026-10-07T01:57:45.893Z did not match all mandatory closed-bootstrap expectations: web checkout/shipping/email DIFFERENT; worker email DIFFERENT; storage r2 expectation web DIFFERENT / worker MISSING. APP_ENV staging MATCH and Stripe TEST on both. Not refreshed this cycle; classifications are not runtime behavior or authority to change config. Only provider writes were authorized personal public-key add/remove; no commerce call/business-data query. All four affected categories (Stripe API/webhook, ADMIN_SESSION_SECRET, CRON_SECRET) in both environments remain COMPROMISED; rotation/revocation NO. No DB/schema writes by this audit, not proof of absent independent writers. READY FOR MERGE / STAGING / EXTERNAL HOMOLOGATION / PRODUCTION = NO; AUTHORIZED FOR PRODUCTION = NO. No refactor, deploy/redeploy/restart, migration, rotation, endpoint-security bypass or production action. Next: owner diagnosis of official staging SSH connectivity, sanitized evidence and explicit Phase 2 resume; never share a passphrase/key body or bypass host trust/AV. Backup support remains separate/owner-led. STOP, no automatic retry, later phase, full E2E or build.

## Historical official identity cycle — 2026-10-06

This prior cycle and all sections below retain their original dated observations. Current Master Cycle state and authority are exclusively above/in the canonical status; historical validation/readbacks must not be presented as fresh evidence.

**INCOMPLETE — SAFE STOP; SSH_PATH=BLOCKED; SSH_IDENTITY_HUMAN_ACTION_REQUIRED=YES; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** The real staging migration-history goal remains UNKNOWN, not achieved. The intended official path no longer depends on the abandoned helper, but no usable official identity or SSH/SQL access was established. Current [staging database gate](security/STAGING_DATABASE_GATE.md), [incident record](security/CREDENTIAL_INCIDENT_202610.md) and [owner-ready support handoff](security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) retain the evidence boundary. Support is READY DRAFT / NOT SENT.

Entry local/origin documentation HEAD b9d7cbf5a47648fa0486414d0392b043b04efd29; origin/main and web/worker deployed source 4ea73f50cafdbf67e16dc71de985052075feca42; **30 ahead / 0 behind**. Final documentation SHA/count/remote equality are reported at closure. One fresh exact head/base PR query returned `issues: []`; no PR creation/retry or merge, and PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved. No absent check/PR is treated as PASS.

### Identity / helper / SQL outcome

Railway CLI 5.26.0 personal-key listing at 2026-10-06T20:39:30.516Z exited 0 with verified empty inventory. Local `.ssh` contains 1 file / 0 public-key and 0 private-key candidates. Native `ssh -G` at 2026-10-06T20:41:35.258Z identified 7 configured paths / 0 existing private identities, without connecting. `ssh-add -l` exited 2 / agent unavailable / 0 returned keys; native agent remains Stopped (not started), SSH_AUTH_SOCK absent and Pageant not running. RAILWAY_API_TOKEN / RAILWAY_TOKEN environment variables are absent; existing personal login/default context was used.

The official `gitHubSshKeys` read at 2026-10-06T20:42:26.595Z returned HTTP 200 / GraphQL INTERNAL_SERVER_ERROR without key metadata. Availability remains **UNKNOWN**, not zero; no ACL or other root cause is proved. `ssh keys github` was **NOT EXECUTED**: [v5.26.0](https://github.com/railwayapp/cli/blob/v5.26.0/src/commands/ssh/keys.rs#L404) can automatically import one key, or the first without a TTY, without proving possession of the private half. No token hunt, key import/add/delete/create/copy/move or change to preexisting keys occurred; removals NOT APPLICABLE.

QUARANTINED_HELPER=ABANDONED; trust UNKNOWN. Five recorded Real Protect-LS McAfee events concern that exact ASKPASS helper and quarantine; timestamps lack timezone offsets and no file hash was measured. False-positive or maliciousness conclusions are not proved. No restore/trust/execute/recompile/rename/new helper or executable, AV configuration/exclusion change or unencrypted-key generation occurred. The helper-specific quarantine persists; no general native SSH/Railway antivirus block is established. Current access blocker: official identity availability, not an asserted resolution of endpoint security. **No SSH, SQL or DB session; READ ONLY enforcement NOT VERIFIED; explicit ROLLBACK NOT EXECUTED.**

### Fresh target / remaining release gates

At 2026-10-06T20:41:33.034Z the same API target was verified: project 72ed12be-9a2a-4e13-8594-30ffd8ffa565; staging d8399691-dacf-41e9-a9d5-060c97672e39; PG service ed0a374e-79da-4aab-9e3a-bb684fb829d1; intended SSH instance 3b37cfd9-f315-40df-a8a6-35673912d346; volume a0b78a5e-0dec-40ab-9d8c-c298be29ca5d; volume instance c5910985-a38a-479b-9274-e65ec6753c77. SSH runtime target not verified; no production selection. PG volume READY / 5000 MB capacity / **187.547648 MB used**, versus prior 187.531264 MB; region UNKNOWN. Volume occupancy is not DB size. All four staging deployments remain unchanged SUCCESS; web/worker remain on 4ea73f50cafdbf67e16dc71de985052075feca42.

Final backup read at 2026-10-06T20:43:01.586Z: **0 snapshots / 0 schedules**, no late snapshot visible. Cumulative create requests **2; NO_THIRD_ATTEMPT**; this cycle's provider writes **0**. BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; RESTORE_DRILL_VERIFIED=NO; BACKUP_PROVIDER_BLOCKER=YES; TRACE_ID=NOT_AVAILABLE in retained evidence. Backend outcome/cause/cost UNKNOWN; no delayed-effect or zero-cost guarantee. Support has not been sent and no backup/create/restore/schedule/delete/resize occurred here.

| Gate | Current decision / boundary |
|---|---|
| PG version; applied/pending/failed/rolled-back counts; DB checksums/schema | UNKNOWN |
| All 14 repository migration states, including admin_temporary_password / analytics / session-version effects | UNKNOWN; no known applied, clean or pending result |
| Migration history verified / clean / migrate-deploy no-op / PHASE_M_REQUIRED | NO / UNKNOWN / UNKNOWN / UNKNOWN |
| MIGRATION_BLOCKER | YES due to unknown trustworthy history, not identified corruption |
| EFFECTIVE_NEXT_DEPLOY_CONFIG / SAFE_SECRET_ACTIVATION_PATH | NOT VERIFIED / NOT PROVEN; no fresh config read or mutation here |
| Credentials / rotation / freeze / PHASE_S_CAN_RESUME | Four categories COMPROMISED / NO / ACTIVE / NO |
| READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION | NO for all |

Earlier stored single-executor/predeploy evidence is historical, not current next-deployment proof. No source/runtime/config/variable change, deploy/restart, migration/DDL/DML, credential rotation, commercial-provider/commerce or production action occurred; no E2E/build/runtime suite was run. Next is legitimate owner action for an approved personal identity with its available Windows private key, linked-GitHub metadata availability review, and submission of the ready unsent support draft. Proposed subject: **Manual volume backup returns INTERNAL_SERVER_ERROR with no snapshot created**. No automatic keygen, AV change, third backup, SQL continuation or Phase S resumption is approved by this safe stop.

## Historical backup reconciliation / trusted metadata audit — 2026-10-06

This previous helper-based abort and second/final backup cycle is superseded above. Its current-blocker and config-readback statements are historical; they do not prove official SSH access, new SQL evidence or an endpoint-security resolution.

**INCOMPLETE — SAFE ABORT; ENDPOINT_SECURITY_BLOCKER; RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Real staging migration history is still not known; the authorized success criterion was not achieved. Current evidence: [staging database gate](security/STAGING_DATABASE_GATE.md), [incident timeline](security/CREDENTIAL_INCIDENT_202610.md), [provider support handoff](security/RAILWAY_BACKUP_SUPPORT_HANDOFF.md) and [rotation approval boundary](security/CREDENTIAL_ROTATION_APPROVAL.md). Support remains DRAFT ONLY / SUPPORT_NOT_CONTACTED.

Entry local/remote documentation HEAD 30104ad071bac4df6c0b31524358c262f5b33b25; origin/main/deployed source 4ea73f50cafdbf67e16dc71de985052075feca42; 29 ahead / 0 behind. Final documentation SHA/count/remote equality are reported at closure. One exact all-state head/base PR search this turn returned none; no PR creation attempt/retry or merge. PR_CREATION_BLOCKED_BY_PERMISSION remains unresolved; absence of a PR is not green CI.

### Backup / access outcome

The exact API-verified staging project 72ed12be-9a2a-4e13-8594-30ffd8ffa565, environment d8399691-dacf-41e9-a9d5-060c97672e39, PG service ed0a374e-79da-4aab-9e3a-bb684fb829d1 and volume instance c5910985-a38a-479b-9274-e65ec6753c77 were retained. No late snapshot was visible at 2026-10-06T17:30:27.210Z. The separately authorized **second and final** creation request at 2026-10-06T17:30:46.574Z returned HTTP 200 / INTERNAL_SERVER_ERROR with no workflow ID. Successful readbacks at 17:30:48.048Z, 17:32:38.169Z and 17:52:44.877Z on the same date all returned 0 snapshots / 0 schedules. Cumulative creation requests **2; NO_THIRD_ATTEMPT**. TRACE_ID=NOT_CAPTURED; backend outcome/cost UNKNOWN; BACKUP_PROVIDER_BLOCKER=YES; BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; RESTORE_DRILL_VERIFIED=NO. Empty inventories do not rule out internal work, delayed snapshots or charges; no schedule, deletion, resize or restore was attempted.

Metadata-only READ ONLY SQL was authorized independently of backup availability in this cycle. However, local transient pairs failed the encrypted-key guard and were all removed, with no preexisting-key deletion. Five related McAfee log entries confirm the ASKPASS helper as QUARANTINED and establish the endpoint-security blocker. No bypass, antivirus restore/exclusion/change or unencrypted fallback was used. Personal key inventory remained 0 before / 0 after; workspace inventory was not asserted. No key-registration attempt, SSH or SQL occurred. Remote deletion NOT APPLICABLE; remote personal-key absence verified YES; local transient keys removed YES. API IDs are verified, but the intended SSH service-instance runtime target 3b37cfd9-f315-40df-a8a6-35673912d346 was not verified remotely.

| Release gate | Current evidence / decision |
|---|---|
| READ ONLY enforcement / explicit ROLLBACK | NOT VERIFIED / NOT EXECUTED because no SQL ran |
| DB version; applied/pending/failed/rolled-back counts; actual checksum comparison | UNKNOWN |
| Schema, analytics indexes and sessionVersion state | UNKNOWN; no full-drift or deployed-Git-equals-applied claim |
| Migration history verified / history clean | NO / NOT VERIFIED |
| Migrate-deploy no-op / PHASE_M_REQUIRED | UNKNOWN / UNKNOWN |
| MIGRATION_BLOCKER | YES — unknown history, not an identified corrupt or pending migration |
| SAFE_SECRET_ACTIVATION_PATH / PHASE_S_CAN_RESUME | NOT PROVEN / NO |
| Credential incident / rotation / release freeze | COMPROMISED / NO / ACTIVE |
| READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION | NO for all |

Fresh staging web/worker readbacks retain deployed SHA 4ea73f50cafdbf67e16dc71de985052075feca42 and stored source branch integration/pre-go-live; stored source is distinct from next-deployment proof. Stored web predeploy migrates with advisory locking disabled; worker, PG and Redis predeploy NONE. Current stored executor count 1; future count UNKNOWN. Config selectors/root directories remain null and the recorded 2026-09-25 resolved-config snapshot is empty; EFFECTIVE_NEXT_DEPLOY_CONFIG=NOT VERIFIED. No source/runtime/config/variable change, deploy/restart, migration/DDL/DML, credential rotation, commercial-provider/commerce or production action occurred. Independent runtime writes were not paused or audited; sensitive recovery copies and incident evidence were preserved.

Next: owner/provider triage of the two ambiguous backup requests through the unsent handoff, plus legitimate owner review of endpoint quarantine. No third request, automatic SQL retry or Phase S continuation follows this safe stop. Documentation remains incomplete operational recovery, not containment or release approval; only documentation checks are handled at closure, with no E2E/build/runtime-suite rerun. Historical sections below preserve their original authority and observations, not this cycle's independent SQL authorization.

## Historical first staging recovery-gate attempt — 2026-10-06

This first attempt is superseded by the current cycle above. Its single backup request, backup-before-SSH prerequisite and no-local-key statements are historical, not cumulative totals or current execution authority.

**RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** [STAGING_DATABASE_GATE.md](security/STAGING_DATABASE_GATE.md) is the current execution dossier; [incident timeline](security/CREDENTIAL_INCIDENT_202610.md) and [rotation approval boundary](security/CREDENTIAL_ROTATION_APPROVAL.md) agree. One authorized backup-create request targeted the exact verified staging PG instance and returned INTERNAL_SERVER_ERROR without workflowId; three post-listings remain 0 snapshots / 0 schedules. MANUAL_BACKUP_FAILED; BACKUP_AVAILABLE=NO; STAGING_BACKUP_VERIFIED=NO; RESTORE_DRILL_VERIFIED=NO. Backend outcome/cost UNKNOWN; no retry, deletion/schedule or restore.

The backup prerequisite prevented key generation/registration and SSH/SQL. Actual DB version/schema/applied/pending/failed/rolled-back/checksum mismatch remain UNKNOWN; history not verified, no no-op assertion, PHASE_M_REQUIRED=UNKNOWN. Latest staging deployments/mount/READY state unchanged; web predeploy still migrates with advisory lock disabled, worker NONE; exact next configuration remains NOT VERIFIED. SAFE_SECRET_ACTIVATION_PATH=NOT PROVEN. No source/runtime/config/variables/deployment/credential rotation/commercial-provider/commerce or production action performed. Independent runtime writes were not paused or audited.

Entry Git local/remote b781aa0287a8a676792a8ef6c60671fd4e2b2489, main/deployed source 4ea73f50cafdbf67e16dc71de985052075feca42, 28 ahead / 0 behind. Final doc HEAD/count/equality are reported after push. One exact PR search returned none; PR_CREATION_BLOCKED_BY_PERMISSION retained, no create retry. Credentials still COMPROMISED; all READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. Recommended next gate: owner triages the failed request and reconciles any delayed snapshot before fresh authority for another creation; no SSH/Phase S without checkpoint. Only five requested docs change; no E2E/build/runtime-suite rerun. All older no-backup-create statements below are historical, not this attempt's result.

## Historical secret activation / migration gate update — 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE; PHASE_S_CAN_RESUME=NO.** Current [SECRET_ACTIVATION_GATE.md](security/SECRET_ACTIVATION_GATE.md) and [incident update](security/CREDENTIAL_INCIDENT_202610.md) supersede execution authority for this read-only cycle. Rotation, deploy/restart/migration/config/provider writes and backup/restore were not performed; credentials remain COMPROMISED and local sensitive copies preserved.

Fresh Git entry documentation HEAD 4b78a32623958dd8b0ed36b530a08df08e7c0639, main unchanged 4ea73f50cafdbf67e16dc71de985052075feca42, 27 ahead / 0 behind. Staging web/worker still deploy that main baseline. Web snapshot/stored migration predeploy confirmed, worker NONE; API selectors null. Current stored executor count 1 does not prove future count. Exact current file attribution/next config remains unresolved. Restart secret refresh and any no-DDL activation path NOT PROVEN; redeploy/caching retains predeploy risk.

DB identity boundary verified privately; existing proxy strict-TLS access failed SELF_SIGNED_CERT_IN_CHAIN before SQL, noninteractive SSH failed NO_EXISTING_SSH_KEY; no TLS bypass/access registration. STAGING_MIGRATION_HISTORY_VERIFIED=NO; all real migration counts/DDL pending UNKNOWN. Backup API now confirms 0 snapshots/0 schedules on the exact staging PG volume instance; no adequate PITR/logical dump/restore proof. BACKUP_AVAILABLE=NO verified adequate checkpoint; RESTORE_DRILL_VERIFIED=NO; STAGING_BACKUP_VERIFIED=NO. This resolves volume inventory, not recovery readiness.

Recommended Option C: keep freeze, resolve legitimate access/trust, separately authorize exact backup/recovery and verify next config. Any migration-dependent route must separate Phase M from subsequently authorized Phase S. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. One PR search still absent; permission blocker retained with no creation retry; empty statuses/PR-triggered Actions are not green CI. No full E2E/build/activation experiment rerun. Historical sections below do not grant authority.

## Phase S execution update — 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE. PHASE_S_FAILED — preflight abort before mutation. ABORT — DEPLOY_BLOCKED_BY_MIGRATION_RISK.** Staging credential rotation is now conditionally authorized by the owner, but the no-migration activation prerequisite failed. Production rotation remains unauthorized. [Execution evidence](security/CREDENTIAL_INCIDENT_202610.md#phase-s-authorized-execution-attempt--2026-10-06) and [current conditional approval/production plan](security/CREDENTIAL_ROTATION_APPROVAL.md) supersede the historical authorization statuses below.

Fresh Git entry local/remote 42d0ca92c7816f870d2e543c13b847ecc9bcdc0f; main unchanged; 26 ahead / 0 behind. Existing staging web/worker source remains 4ea73f5. TEST keys match across those consumers and differ from production; configured staging DB/Redis match dedicated services. Web still has migrate deploy predeploy. Restart did not establish fresh-variable activation; redeploy cannot be treated as migration-free. No replacements, variable/config changes, restart/deploy, migration, local sensitive-copy cleanup or provider mutation performed. Health HTTP 200 / ok_with_warnings is baseline evidence, not containment.

All four staging and production categories remain compromised pending verified closure. No old-key/signature retirement or new session/webhook/cron behavior proved. Production plan updated only conditionally with the failed activation lesson; Phase P live preparation/execution not started. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain. READY FOR MERGE/STAGING BOOTSTRAP/EXTERNAL HOMOLOGATION/PRODUCTION=NO. Documentation alone does not lift freeze or deploy either frozen candidate SHA.

## Initial P0 containment update — historical snapshot, 2026-10-06

**RELEASE_SECURITY_FREEZE=ACTIVE.** Current decision artifact: [CREDENTIAL_ROTATION_APPROVAL.md](security/CREDENTIAL_ROTATION_APPROVAL.md), with [sanitized incident/evidence](security/CREDENTIAL_INCIDENT_202610.md). Staging and production credential containment require separate approval and actual verified completion; neither phase is authorized. Production rotation is urgent independently of the Admin release. No credential/environment/service/DB change or cleanup was executed.

Fresh Git entry local/remote 06981b8c844590b4f1c94cc3a41898cf7bd3404b, main unchanged, 25 ahead / 0 behind. CODE_CANDIDATE_SHA remains 7a820b62bb1515f7b30ccf31badf1f0881a6bd84; STAGING_DEPLOYMENT_CHECKPOINT remains b06ef6e437ee2d28fbeffeb5f91144c389aaa518; documentation does not replace either. Both environments' web/worker pairs remain on 4ea73f5 in read-only inventory. All four affected categories remain COMPROMISED pending closure evidence; current presence/difference is not revocation proof.

Current/reachable-history scan found no confirmed real affected credential in versionable files/text blobs (207 commits / 1,709 text blobs). Local ignored root env and five generated standalone env copies contain the configured TEST key; PowerShell history contains additional credentialed URLs of unknown validity, not matching current PG passwords. Local Codex transcript content was inaccessible due to file use, not a clean scan. Binary/encoded/unreachable/remote-retention gaps remain explicit. Repository cleanliness does not restore credential confidentiality.

Both staging AND production web predeploys run migrate deploy with advisory locking disabled. Secret refresh cannot silently authorize DDL, deploy the candidate or restore compromised variables via native rollback. ADMIN_SESSION_SECRET rotation logs out customers as well as Admins. CRON_SECRET_PREVIOUS support exists in current/deployed scoped source but is absent in live web config; retaining the compromised previous value requires explicit incident risk acceptance and deadline, not an automatic continuity workaround.

PR remains absent; no creation retry; main protection read 403. Entry-HEAD check-runs/statuses and all repository Actions runs 0: NOT CONFIGURED / none reported, never PASS. READY FOR MERGE=NO; READY FOR STAGING BOOTSTRAP=NO; READY FOR EXTERNAL HOMOLOGATION=NO; READY FOR PRODUCTION=NO. Credential containment and migration/checkpoint/executor approval are cumulative. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain; no DB access attempt/full E2E rerun/dependency change here. Earlier dated sections are historical evidence, not waiver of this freeze.

Assessment: 2026-10-03, branch `codex/admin-dashboard-reconciled-20261002`. This cycle prepares a reviewable release; it does **not** authorize merge, deployment, migrations on a real database or activation of commerce. No production environment or provider was changed.

## Final preflight update — 2026-10-04

Current decision dossier: [STAGING_BOOTSTRAP_APPROVAL.md](cycles/STAGING_BOOTSTRAP_APPROVAL.md). Immutable deployment checkpoint b06ef6e437ee2d28fbeffeb5f91144c389aaa518; last runtime/test commit 7a820b62bb1515f7b30ccf31badf1f0881a6bd84, with only docs changes afterward. New documentation HEAD is reported after push, not another homologated code version. Main unchanged, initial ahead/behind 24/0; no app suite rerun or Admin refactor.

Read-only Railway inventory/flags/domain/mounts/provider registration remain as below. Web/worker/PG/Redis each have one running instance, one active deployment and one configured replica. Configured staging DB/Redis and mounted-volume IDs differ from production; worker Redis absent (DB-backed queue, no added dependency). Candidate not deployed. The two rare_dev pending migrations cannot be inferred for staging: direct read-only PG attempt failed trusted TLS, and SSH path needs key registration. No trust bypass/access setup, query result, backlog count or migration was obtained. STAGING_MIGRATION_HISTORY_NOT_VERIFIED and BACKUP_NOT_VERIFIED remain blockers.

Web-only migration execution is a proposed gate, not proven for a future source change: verify explicit /railway.json web and /railway.cron.json worker selectors/effective manifests so code-config precedence cannot make the worker migrate too. Checkout=false does not pause expiry reconciliation or webhooks; they can update existing TEST orders and expire TEST sessions. Only new checkout/quote/email initiation is closed by the proposed three flags after runtime verification. Approved quiescence/backlog handling is required; no scheduler/process was stopped here.

**P0 credential containment required:** an erroneous PowerShell comparison emitted staging/production Stripe keys and webhook/Admin-session/cron secret values into a tool-output record in this conversation. No values are copied into repository files. Corrected comparisons emit classifications only; a file secret scan does not undo record exposure. Owner-led rotation/revocation and coordinated consumer/session/webhook recovery are required; production changes need separate explicit approval. No automatic rotation was performed and no confidentiality guarantee is claimed.

PR remains absent after fresh search/one 403 creation attempt; required reviews/protection UNKNOWN, zero reported checks/statuses/Actions on frozen SHA. READY FOR STAGING BOOTSTRAP: NO; AUTHORIZED FOR STAGING BOOTSTRAP: NO; READY FOR EXTERNAL HOMOLOGATION: NO. Existing merge/production NO decisions remain. Prisma registry re-read 2026-10-04 shows unchanged 7.10.0/config deepmerge-ts 7.1.5 and latest 8 prerelease; UPSTREAM_WAIT unchanged. Audit counts below are dated previous-cycle results, not a new audit run.

## Evidence boundary

Local QA uses synthetic data and disabled external side effects. PASS in Code means the inspected implementation/contract passed relevant local tests, not an externally homologated integration. LOCAL VERIFIED means the observed local environment only. Staging and Production describe verification of **this candidate**, not an assertion that the existing live service is broken or absent. No staging URL, provider callback, secret value or live catalog inventory is inferred.

Statuses used: PASS, LOCAL VERIFIED, STAGING VERIFIED, EXTERNAL HOMOLOGATION REQUIRED, BLOCKED, NOT TESTED, NOT APPLICABLE. Blocker status refers to opening this release for production; unresolved evidence or authorization is BLOCKED, not necessarily a code defect.

## Matrix

| Área | Code | Local QA | Staging | External | Production | Blocker | Próxima ação |
|---|---|---|---|---|---|---|---|
| Admin | PASS | LOCAL VERIFIED | NOT TESTED | NOT APPLICABLE | NOT TESTED | BLOCKED | Review actual PR, remote gates and isolated staging Admin flows |
| Database | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify target/version, backups, capacity and schema |
| Migrations | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Authorize target/window/single executor; follow migration runbook |
| Storage | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify dedicated staging volume read/write/redeploy; separately approve persistent production R2 |
| Stripe | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Fully isolated Stripe Test Mode homologation; no live charge |
| Checkout | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Keep flag closed; validate provider/payment/reservation lifecycle |
| PIX | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Validate account capability, expiry, asynchronous success/failure in Test Mode |
| Parcelamento | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Define requirement/account support; no explicit installment implementation found |
| Webhooks | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Verify signed test delivery, duplicates, retries and mode matching |
| Shipping | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Existing staging web flag is true: authorize false bootstrap before sandbox homologation; do not change live freight |
| Melhor Envio | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Sandbox token/endpoint and dimensional quote homologation |
| Email | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Isolated allowlisted delivery, selected provider and outbox ownership |
| Uploads | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Re-run upload/editor contracts against persistent storage/CDN |
| Cron | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Railway workers/DB targets inventoried; verify runtime queues and Vercel live topology; approve owner |
| Produtos/dimensões | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Correct measured local catalog data; separately audit authorized live catalog |
| Security | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Accept/resolve residual dependency risk; verify deployed guards/rate-limit backend |
| Monitoring | PASS | LOCAL VERIFIED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Prove external health/alerts, queue and provider observability |
| Rollback | NOT APPLICABLE | NOT TESTED | NOT TESTED | EXTERNAL HOMOLOGATION REQUIRED | NOT TESTED | BLOCKED | Restore drill and compatible artifact with revocation guarantees |

## Admin, security and local gates

Auth is server-side near data/effects, not layout-only: active ADMIN, signed/unexpired token, current credentialVersion and sessionVersion, forced temporary-password change. Administrative actions validate selected fields/IDs/enums; APIs enforce same-origin, content type, byte-counted payload limits and quotas. Upload multipart and push POST/DELETE include missing/false Content-Length, oversized streams, 413/415 and rate-limit regressions. FR-01..04 remain covered (payload bounds, repeated query params, deterministic pagination/ID ties and long-content overflow/clipping).

Local closing-cycle QA on 2026-10-03, retained for the unchanged runtime (not rerun during docs-only staging preparation): lint/typecheck PASS; 147 unit/integration files, 1,134 tests PASS; 21 Admin/auth files, 140 tests PASS in each of three targeted runs; Prisma validate/generate PASS; all 14 migrations from zero and three SQL contract runs PASS on disposable local QA. E2E: 178 passed, 62 skipped, zero failures/flaky tests (three browser projects); QA database/storage removed and port released. Skips: 24 require isolated staging checkout, 24 require a product fixture with 2+ images, 14 are project-specific scope. Those 48 uncovered scenarios are NOT TESTED, not external homologation evidence; no skip/assertion was changed to obtain a pass. Admin accessibility and responsive scope are recorded in `cycles/ADMIN_FINAL_INTEGRATION.md`. Clean production build/standalone and 28 Server Action exports PASS.

`app:check` completed without technical blockers locally, but its warnings are commercial release gates: local storage, legacy fixed freight, five active products without shipping dimensions and checkout disabled. `db:check`/migrate status report the two pending migrations on `rare_dev`; this expected nonzero result is **not** green database release readiness.

## Payments / checkout / webhooks

- Checkout guard is closed by default without explicit enablement; local CHECKOUT_ENABLED=false and isolated QA also forces false. This PR makes no commercial activation change.
- Stripe implementation pins API version `2026-04-22.dahlia`, selects card/PIX, bounds request time/retries, uses an order-scoped checkout idempotency key, and validates payment status before reconciliation. Success/cancel routes are `/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}` and `/finalizar-compra?checkout=cancelado&pedido=...`.
- `POST /api/stripe/webhook` verifies the signature on the raw body, matches test/live event mode to the configured key, deduplicates events and locks/reconciles orders transactionally. Closing checkout does not disable webhook reconciliation for existing orders.
- Local tests use controlled mocks. The later read-only staging discovery confirms TEST keys and an enabled test webhook registration, not a complete externally tested setup; no charge/session was created. PIX, redirects, asynchronous completion, retries, cancellations and account capability require authorized Test Mode homologation. Parcelamento is REQUIRES PRODUCT DECISION, account/product support NOT VERIFIED; no explicit implementation was found and card capability alone is not approval.

## Shipping / Melhor Envio / catalog

The endpoint allowlist is production `https://www.melhorenvio.com.br` or sandbox `https://sandbox.melhorenvio.com.br`, calling `/api/v2/me/shipment/calculate` with a manually configured Bearer token. The default timeout is 8 seconds, with sanitized errors. The repository has no OAuth callback, code exchange or automatic refresh flow; do not invent one.

**Shipping is not globally closed by default:** disabled mode returns false, an explicit SHIPPING_ENABLED is respected, but when unset a non-disabled mode is enabled. The local read-only assessment found legacy fixed mode, not proof that freight is off. QA explicitly forces SHIPPING_ENABLED=false. Keep that guard explicit in isolated staging and do not activate/change real freight in this cycle. Manual/fixed modes can use the 1,000g / 10×35×35cm fallback; it is not measured data or automatic-provider readiness.

The current read-only `shipping:dimensions:audit` examined all 10 products on **local `rare_dev`**, without truncation. Five active products lack weight/length/width/height:

| Local ID | Slug | Missing fields |
|---|---|---|
| cmp31aine0005q4o75z3winrf | supreme-bag | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aio10007q4o7ml7c0wr4 | bone-chrome-hearts | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aio60009q4o7coozl8mm | jaqueta-nike-nocta | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aioa000bq4o7e1fhq37v | camiseta-bape | weightGrams, lengthCm, widthCm, heightCm |
| cmp31aiof000eq4o7qj1ug59f | camiseta-hellstar | weightGrams, lengthCm, widthCm, heightCm |

`camiseta-bape` additionally reports VARIANT_MAY_CHANGE_PACKAGE. No measurements were invented or stored. This is **not** a production catalog list; live data requires a separately authorized read-only audit and measured packaging corrections.

## Email

Explicit selection only: `disabled` (default), `smtp`, `zeptomail`; no automatic provider fallback. Test policy/allowlist and send-not-before protect external delivery/backlog when correctly configured. The durable outbox has atomic token/lease claims, bounded retries and `uncertain` handling, not guaranteed exactly-once provider delivery. The persistent checkout worker drains it when enabled; the Vercel expiry route does not. No real email or bulk send was performed. Verify the chosen provider, test recipient allowlist, delivery and uncertain-message handling externally before enabling.

## Storage / uploads

Local mode defaults to `public/uploads` and `/uploads`. Uploaded product/banner originals and generated static WebP variants depend on durable object storage; ProductImage.url and banner imageUrl/mobileImageUrl are persisted references. Existing URLs must be inventoried before any separately authorized media migration.

Production R2 configuration uses STORAGE_DRIVER=r2, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL (or STORAGE_PUBLIC_BASE_URL). The S3-compatible endpoint is derived from the account. Partial R2 configuration fails; there is no automatic R2-to-local fallback. Uploads in production local mode are blocked, except an explicit restricted-staging local-storage exception; that exception still needs persistent storage and is not production approval.

Local filesystem media can disappear on redeploy or differ across instances. Verify persistent object write/read, public/CDN URLs, variants, editor and existing catalog references. No real credentials, R2/CDN configuration or media backfill was changed/tested externally in this cycle.

## Database / cron / monitoring / rollback

- [Pending migrations runbook](runbooks/PENDING_MIGRATIONS.md): ordinary index locks and session-column locks; backup, recovery and single executor. Railway pre-deploy automatically migrates with advisory locking disabled: authorization is needed **before deploying**, even if checkout remains closed.
- [Cron ownership runbook](runbooks/CRON_OWNERSHIP.md): Railway web/worker deployment inventory and distinct staging/production DB targets verified read-only; processing/queue health and Vercel live inventory NOT TESTED. KEEP Railway; Vercel UNKNOWN until inventory, then DISABLE AFTER APPROVAL only if redundant. SKIP LOCKED/leases do not elect an owner or guarantee external exactly-once effects.
- Public health is minimal/no-store; protected diagnostics include runtime/artifact information. Local health contracts do not prove external alerts, durable workers or production DB monitoring.
- Production backup/restore, known-compatible rollback artifact and post-checkpoint write reconciliation are NOT TESTED. Preserve session revocation when rolling application code back; never drop/reset the session columns as automatic rollback.

## Live staging discovery — configuration, not candidate homologation

Read-only on 2026-10-03: [STAGING_SAFETY.md](runbooks/STAGING_SAFETY.md) records actual Railway environment/service/deployment identities and all bootstrap gates. Existing URL is <https://rare-staging-staging.up.railway.app>. Web and worker deploy integration/pre-go-live at main baseline `4ea73f50cafdbf67e16dc71de985052075feca42`, not this Admin candidate. Therefore the matrix's candidate Staging column remains NOT TESTED.

Dedicated staging Postgres/Redis targets match their services and differ from production. Stripe web/worker keys are TEST, matching each other and different from production; webhook/session/cron secrets are present and distinct. Storage is local `/data/uploads` on a dedicated `/data` volume with `/uploads` URL base; all five R2 settings are missing. This is configured staging persistence, not tested media durability or production R2 readiness. Melhor Envio uses the sandbox endpoint fallback; token authentication/quotes were not exercised.

Existing staging is a laboratory: **web checkout=true and shipping=true**, not the requested false bootstrap. Web/worker SMTP test mode has valid matching EMAIL_TEST_RECIPIENTS (two) and EMAIL_SEND_NOT_BEFORE; config validation reports smtp_configured_delivery_unverified. Recipients/backlog are not authorized for this cycle. Bootstrap requires explicitly false flags and email disabled on participating processes, after approval to repurpose this existing environment. No external configuration was changed.

Public GET evidence: health 200 / ok_with_warnings, root 401 Basic, robots disallow-all, no-store/noindex/nofollow. Stripe read-only account evidence is BR/card_payments active; no PIX capability confirmation. One enabled TEST webhook points to the actual staging /api/stripe/webhook with the six documented events. Registration does not prove signed delivery/idempotency/reconciliation. No test charge, quote, email, media write or DB migration was performed.

Live staging web pre-deploy is `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy`. Target identity is known but real staging migration history, backup/recovery, single executor and authorization remain unverified. **STAGING_DEPLOY_BLOCKED / DEPLOY_BLOCKED_BY_MIGRATION_RISK**: do not deploy the candidate before these gates. Known two pending rare_dev migrations are prior local evidence, not an inferred staging state. Worker SUCCESS/active deployment metadata does not prove queue/backlog health; Vercel live target remains UNKNOWN.

## DEPENDENCY RESIDUAL RISK

Current lock: Next 16.3.8, Nodemailer 10.0.13, Prisma/client/adapter 7.9.1. Runtime audit refreshed during staging preparation: **3 high**, zero critical, in direct Prisma → transitive @prisma/config → deepmerge-ts 7.1.5 (`output/staging-prep-audit-runtime.json`, ignored). Prior closing-cycle full audit: **16 high**, comprising those 3 plus 13 dev/tooling entries (ESLint/Lighthouse chains), not 16 distinct production exploits; full audit was not rerun for doc-only changes.

[GHSA-ggr8-5vv4-36mx](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx) affects recursive object graphs and is fixed in deepmerge-ts 8; ordinary parsed JSON cannot itself contain recursive references. No application request path directly imports deepmerge. Prisma remains in the production install tree, so the advisory is not dismissed as dev-only. Mitigation is controlled repository-owned Prisma configuration and bounded/validated request inputs; this is risk reduction, not an upstream fix.

Registry/advisory refreshed 2026-10-03: compatible stable Prisma 7.10.0 still pins deepmerge-ts 7.1.5; latest tag 8.0.0-rc.19 is a prerelease, not a stable compatible resolution. [Prisma upstream issue](https://github.com/prisma/orm/issues/30052) remains open. **UPSTREAM_WAIT**: keep the reviewed lockfile; no audit fix --force, major downgrade, forced deepmerge override or gratuitous upgrade. Track a stable coordinated Prisma/client/adapter release, inspect its tree and rerun audits/gates. Available unrelated newer patches do not establish a fix for this chain. Dev-tooling upgrades need their own reviewed compatibility work.

**Release decision required:** the owner must document acceptance or deferral of the remaining advisory, mitigations, accountable reviewer and revisit trigger before production promotion. No commercial residual risk was accepted on the owner's behalf. Controlled configuration/bounded inputs reduce exposure but are not an upstream fix; production remains blocked pending that decision.

## Release decisions

- READY FOR MERGE: **NO** until an actual PR exists and remote required checks/reviews/protection can be verified. Local branch ancestry is reconciled, but absence of CI is not green CI.
- READY FOR STAGING/HOMOLOGATION: **NO**. Target and separate configured DB/Redis/Test secrets are identified; existing false-bootstrap requirements are not satisfied, sandbox auth/media/monitoring remain untested, and backup/executor/migration authorization are missing. The candidate and runbooks are prepared, not deployed.
- READY FOR PRODUCTION: **NO** until the staging/external gates, migrations, measured catalog, cron ownership, dependency risk disposition, monitoring/rollback and explicit promotion authorization are complete.

No main merge, live deploy, real-database migration/reset, DNS/secret change, commerce activation or live cron disable was performed.
