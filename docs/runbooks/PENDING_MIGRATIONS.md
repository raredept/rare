# Pending migrations — controlled application

Reviewed on 2026-10-03. This is a future operator runbook, **not authorization to execute**. No migration was applied to `rare_dev`, real staging or production in this cycle. Only a disposable local QA database received all 14 migrations.

## Objective and expected state before application

Apply, in order, the two pending migrations observed by read-only checks on local `rare_dev`:

1. `20260920120000_analytics_paid_at_index`
2. `20260921120000_session_version`

The repository contains 14 migrations. The expected baseline is the earlier 12 completed, these two pending, and no unresolved failed migration. This is **not a verified production inventory**: inspect the authorized target again before proceeding. A different history, partially applied DDL or unexpected schema is a stop condition.

## Migration 1: analytics indexes

The SQL in `prisma/migrations/20260920120000_analytics_paid_at_index/migration.sql` is exactly:

```sql
CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order" ("status", "paidAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_productId_idx" ON "OrderItem" ("orderId", "productId");
```

- Two ordinary, non-unique B-tree indexes; **not** `CONCURRENTLY`. Each build scans its table, consumes disk, CPU/I/O and WAL, and takes a SHARE lock that blocks writes while permitting ordinary reads. Long transactions can prolong the wait.
- No ALTER TABLE, column default, NOT NULL change, explicit backfill or destructive operation.
- `IF NOT EXISTS` checks the name, not equivalence: an existing index with that name must have the expected definition and be ready/valid.
- No explicit BEGIN/COMMIT in the migration file. Do not assume both statements or the entire deployment are atomic; inspect actual catalogs/history after a failure.
- Write interruption is likely during each build. Its duration cannot be estimated from the tiny QA database; measure representative staging volume/load and agree a maintenance window.

## Migration 2: session revocation columns

The SQL in `prisma/migrations/20260921120000_session_version/migration.sql` is exactly:

```sql
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
```

- ALTER TABLE requires ACCESS EXCLUSIVE locks, blocking reads and writes while held. Each operation can wait behind existing transactions.
- PostgreSQL 11+ can add this constant non-volatile default using metadata: existing rows read as `0`, without an explicit UPDATE backfill or heap rewrite for the default. Verify the actual server version; older versions can rewrite tables.
- The new columns are integer, NOT NULL, default `0`. Their values are persistent authentication/revocation state, not expendable counters.
- No explicit BEGIN/COMMIT and no IF NOT EXISTS. If User succeeds and Customer fails, a blind retry can fail on the existing User column. Inspect and use the reviewed recovery procedure below.
- Expected lock-holding time is short on a supported server, but lock waits can cause an outage. “Fast default” does not guarantee zero downtime.

## Pre-check and backup/checkpoint

An authorized operator must:

1. Identify the exact environment/database using safe metadata, without printing connection strings or secrets. Verify server version, schema, permissions, available disk/WAL capacity, table sizes and migration history.
2. Inspect existing index definitions, column definitions, long-running transactions and lock waits. Define acceptable lock/statement timeouts, write interruption and abort thresholds from staging measurements, not invented production estimates.
3. Create a recoverable database checkpoint/backup and record its timestamp and retention. Confirm a restore test on an isolated database; a backup filename alone is not proof of recovery.
4. Record the last compatible application artifact/commit and plan reconciliation of writes occurring after that checkpoint.
5. Coordinate app, worker and migrations with one accountable operator and a maintenance window. User/Customer login and logout also write session state. Pausing live services requires separate authorization.

**Release blocker:** `railway.json` currently contains:

```text
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy
```

That pre-deploy command automatically applies pending migrations on a future Railway deployment and explicitly disables Prisma advisory locking. Do not deploy first and consider migration authorization later. Require exactly **one migration executor**; no simultaneous manual deploy, another service deploy or pipeline migration. This cycle did not change that configuration or any live service.

Read-only pre/post queries, executed only against the identified authorized database (these intentionally omit migration logs and personal data):

```sql
SHOW server_version;
SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
FROM "_prisma_migrations" ORDER BY started_at;

SELECT t.relname AS table_name, i.relname AS index_name,
       x.indisvalid, x.indisready, pg_get_indexdef(i.oid) AS definition
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND i.relname IN ('Order_status_paidAt_idx', 'OrderItem_orderId_productId_idx');

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('User', 'Customer')
  AND column_name = 'sessionVersion';

SELECT c.relname, c.reltuples::bigint AS approximate_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('Order', 'OrderItem', 'User', 'Customer');

SELECT pid, state, now() - xact_start AS transaction_age,
       wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
  AND xact_start IS NOT NULL ORDER BY xact_start;
```

Use the actual target schema if it differs; stop and investigate rather than silently applying these checks to the wrong schema.

## Application command — future, explicitly authorized only

From the approved checkout, with its reviewed lockfile/Prisma 7.9.1 installed and the target selected securely outside command arguments:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

The status command is read-only. Deploy applies **all** pending migrations, not only a named one: stop if its pending set differs. Generate creates the client, not database changes. Prisma deploy does not reset a database or use a shadow database, and does not by itself generate the client or prove absence of schema drift. Do not use `migrate dev`, `db push`, `migrate reset` or ad-hoc ALTER commands on the real target.

## Sanity checks / post-migration verification

- `npx prisma migrate status`: all 14 expected migrations completed, no unfinished/unresolved failed row. Re-run the catalog queries above: both indexes valid/ready with the correct ordered fields; both integer columns NOT NULL with default `0`.
- Inspect health, lock waits, query latency and worker backlog against agreed thresholds. Verify analytics queries use the intended contract; index creation alone is not a measured performance improvement.
- In isolated staging, verify active Admin/customer login, logout/revocation, temporary-password restriction, old credential/session versions and expired sessions. Existing legacy tokens lacking sessionVersion map to `0`; do not reset versions to preserve old tokens after revocation.
- Re-run relevant SQL contracts and application smoke using synthetic data, without real payments, freight labels or bulk emails.
- Record evidence, target, checkpoint, operator, start/end time and promoted artifact without secrets. Only then consider the separately authorized application promotion.

## Contingency, rollback criteria and impact

Stop promotion on exceeded agreed lock/duration thresholds, inconsistent DDL/history, authentication failures or sustained performance regressions. Cancel/terminate an operation only through the authorized operator's incident procedure; inspect what actually committed before retrying.

For an unfinished migration, preserve evidence privately, compare history and catalog state, and choose a reviewed recovery: undo only its safely reversible partial effects and mark the failed migration rolled back, or complete the exact intended DDL and mark that failed migration applied. `prisma migrate resolve` is a human-approved recovery tool, **not** permission to conceal a failure or skip SQL. Never edit an already applied migration, reset the database or blindly retry partial ADD COLUMN statements.

There is no automatic “down migration” here. Prefer retaining these additive columns/indexes and rolling the application back only to an artifact compatible with the schema **and session revocation guarantees**. Removing an index requires confirming ownership (IF NOT EXISTS may have retained a pre-existing index) and a separately reviewed operation. Dropping/resetting sessionVersion loses revocation history and breaks the current client/auth contract; it is not an acceptable automatic rollback.

A checkpoint restore is a last-resort, separately authorized operation, with post-checkpoint orders, payments and writes reconciled first. This cycle did not test a production restore, so production rollback remains NOT TESTED.

## Disposable QA and shadow databases

The 2026-10-03 isolated runner applied all 14 migrations from zero, seeded synthetic data and passed three SQL contract runs; its database and storage were removed by its guarded cleanup. Prisma validate/generate also passed. These are local replay evidence, not live locking/downtime or drift evidence. `rare_dev` remained with the two pending migrations.

A shadow database must be dedicated and disposable, contain no important data and never be the primary datasource. `migrate dev` can reset an explicitly configured shadow database. `migrate deploy` does not depend on it. No shadow was cleaned or reset in this cycle.

## Primary references

- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Prisma 7 development and production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)
- [Prisma 7 failed-migration recovery](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing)
- [Prisma 7 shadow database](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database)
