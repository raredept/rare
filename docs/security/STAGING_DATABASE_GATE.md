# RARE — staging database & recovery gate

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

PostgreSQL version, schema/index/column metadata and all staging migration counts remain UNKNOWN. Repository contains **14 migrations**, freshly counted from deployed Git source. No failed/partial migration or mismatch was discovered; absence was also not established. **STAGING_MIGRATION_HISTORY_VERIFIED=NO; MIGRATE_DEPLOY_EXPECTED_NOOP=NOT PROVEN.**

Canonical SHA-256 values below were recomputed privately from SQL UTF-8 Git blobs at 4ea73f50cafdbf67e16dc71de985052075feca42, never from unnormalized Windows worktree bytes. They are migration-file checksums, not credential hashes. SQL/seed literals were not emitted. Installed Prisma 7.9.1 engine checksum matching accepts original/LF/CRLF equivalents; those variants were computed in memory. [Prisma checksum implementation](https://github.com/prisma/prisma-engines/blob/e922089b7d7502aff4249d5da3420f6fa55fc6ad/schema-engine/connectors/schema-connector/src/checksum.rs). Database comparison was **NOT EXECUTED**.

| Migration | Deployed Git canonical SHA-256 | Staging state |
|---|---|---|
| 20260511210000_init | c1c6b627ed850a3a627629a7cfd5a13b54023fca8829b747e21457c3fa1d4fae | UNKNOWN |
| 20260512013000_v1_5_customers_orders | 1407f307dea67e4d1da4c6a6762a4e5348b7bd35f3ed2d8f520937d7af1de30b | UNKNOWN |
| 20260512053542_v1_6_shipping_base | c17f536e9e14a96174b97178305ec2120151723ed839444a0a81ff0a09f4bbc9 | UNKNOWN |
| 20260515120000_v1_7_7_home_banners | 39a1fa5d5904f3d45b6cdcd6aaf191112c6d689ea291ac55ee55e35dfa498f34 | UNKNOWN |
| 20260520090000_v1_7_12_featured_sort_order | 1ab32731020e9905df44d1a989e890d50cfc28459e60048dbf71ef599c0afe0b | UNKNOWN |
| 20260524170000_v1_7_14_shipping_quote_snapshot | b5399d78493ffa2c331edb4f2fd751f4b90d6f78832569c444ca8431768ba954 | UNKNOWN |
| 20260606182000_operational_evidence | 410a0d66f54ffe6936b5c8ba52cc6d44671fd8b6a33bcadf355225a629440773 | UNKNOWN |
| 20260709120000_admin_sale_notifications | 355aef77a586aead7062bfedf6d57d4af35234ae68de73789a5a3c7d5e93a19d | UNKNOWN |
| 20260710120000_first_order_coupon | 333b79361a8a848a0d723511d5f398debd2d36ed99b12149f1624a85711b311e | UNKNOWN |
| 20260907150000_admin_temporary_password | bdc0a2739b2c00ffb5eec9b0b014bfddb3949bf25dfbf112d54bfd97e814d3ff | UNKNOWN |
| 20260907230000_payment_email_outbox | 5ecdca2155702386ad136edeab699f6e9ef706a46e02262304a5913b7c320fdc | UNKNOWN |
| 20260913120000_storefront_media_checkout_deadline | c3ca40d2e71f1391cba46fda8f3a6e5cdfe3ea9697ac50e6d28dac2ab3fec086 | UNKNOWN |
| 20260920120000_analytics_paid_at_index | a6059495a00e658d8ac1dd77875dbc215e654fd47713fb1b3e66eed45862e197 | UNKNOWN |
| 20260921120000_session_version | 63a12bf3b7df20b3fff1a90fed232cc43f9d721fed60a6bbc39ebcd6d470e076 | UNKNOWN |

APPLIED=UNKNOWN; PENDING=UNKNOWN; FAILED=UNKNOWN; ROLLED_BACK=UNKNOWN; CHECKSUM_MISMATCH=UNKNOWN. No particular file is asserted pending. [Existing conditional risk manifest](SECRET_ACTIVATION_GATE.md#repository-migrations--conditional-risk-manifest) records operations/locks/data effects for all 14; narrow it only after trusted history. It includes blocking ordinary indexes, ALTER locks, auth/session effects and conditional Admin seed DML, not a DDL-only/no-risk manifest. Overall risk remains HIGH / unresolved; duration unknown. On failed/partial migration or genuine checksum mismatch: **P0 DATABASE MIGRATION INTEGRITY BLOCKER**, stop with no repair.

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
