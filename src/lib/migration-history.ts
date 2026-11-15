import { createHash } from "node:crypto";

// Compares the repository's Prisma migrations with a database's _prisma_migrations history, the way
// the staging audit of 2026-10-07 did by hand: name, checksum and the started/finished/rolled-back
// timestamps only. Pure: the caller reads the files and the rows.

export type RepositoryMigration = { name: string; sql: Buffer };

export type MigrationHistoryRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

export type MigrationState = "APPLIED" | "PENDING" | "FAILED" | "ROLLED_BACK" | "CHECKSUM_MISMATCH";
export type ChecksumVariant = "as-read" | "lf" | "crlf";

export type MigrationAuditEntry = {
  name: string;
  state: MigrationState;
  attempts: number;
  checksumVariant: ChecksumVariant | null;
};

export type MigrationHistoryAudit = {
  migrations: MigrationAuditEntry[];
  extra: string[];
  anomalies: string[];
  counts: Record<MigrationState | "EXTRA", number>;
  /** No failed, rolled-back, mismatched or unknown history. Pending migrations alone keep it clean. */
  clean: boolean;
};

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** Prisma stores the SHA-256 of the file as read; a Windows checkout may have rewritten LF to CRLF. */
export function migrationChecksums(sql: Buffer): Record<ChecksumVariant, string> {
  const lf = Buffer.from(sql.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"), "utf8");
  return { "as-read": sha256(sql), lf: sha256(lf), crlf: sha256(crlf) };
}

export function auditMigrationHistory(repository: RepositoryMigration[], rows: MigrationHistoryRow[]): MigrationHistoryAudit {
  const attemptsByName = new Map<string, MigrationHistoryRow[]>();
  for (const row of rows) attemptsByName.set(row.migration_name, [...(attemptsByName.get(row.migration_name) ?? []), row]);

  const anomalies: string[] = [];
  const migrations = [...repository].sort((first, second) => first.name.localeCompare(second.name)).map((migration): MigrationAuditEntry => {
    const attempts = attemptsByName.get(migration.name) ?? [];
    if (!attempts.length) return { name: migration.name, state: "PENDING", attempts: 0, checksumVariant: null };
    const finished = attempts.filter((row) => row.finished_at && !row.rolled_back_at);
    if (finished.length > 1) anomalies.push(`${migration.name}: ${finished.length} finished attempts`);
    if (attempts.length > 1) anomalies.push(`${migration.name}: ${attempts.length} history rows`);
    if (finished.length) {
      const checksums = migrationChecksums(migration.sql);
      const recorded = finished[finished.length - 1].checksum;
      const variant = (Object.keys(checksums) as ChecksumVariant[]).find((key) => checksums[key] === recorded) ?? null;
      return { name: migration.name, state: variant ? "APPLIED" : "CHECKSUM_MISMATCH", attempts: attempts.length, checksumVariant: variant };
    }
    const failed = attempts.some((row) => !row.finished_at && !row.rolled_back_at);
    return { name: migration.name, state: failed ? "FAILED" : "ROLLED_BACK", attempts: attempts.length, checksumVariant: null };
  });

  const known = new Set(repository.map((migration) => migration.name));
  const extra = [...new Set(rows.map((row) => row.migration_name).filter((name) => !known.has(name)))].sort();

  // A pending migration older than an applied one means the database followed a different path.
  const lastApplied = migrations.map((entry) => entry.state).lastIndexOf("APPLIED");
  migrations.slice(0, Math.max(lastApplied, 0)).filter((entry) => entry.state === "PENDING")
    .forEach((entry) => anomalies.push(`${entry.name}: pending but older than an applied migration`));

  const counts = { APPLIED: 0, PENDING: 0, FAILED: 0, ROLLED_BACK: 0, CHECKSUM_MISMATCH: 0, EXTRA: extra.length };
  for (const entry of migrations) counts[entry.state] += 1;
  const clean = counts.FAILED === 0 && counts.ROLLED_BACK === 0 && counts.CHECKSUM_MISMATCH === 0 && extra.length === 0 && anomalies.length === 0;
  return { migrations, extra, anomalies, counts, clean };
}
