import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { auditMigrationHistory, migrationChecksums, type MigrationHistoryRow, type RepositoryMigration } from "@/lib/migration-history";

const sql = (text: string) => Buffer.from(text, "utf8");
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const repo: RepositoryMigration[] = [
  { name: "20260101000000_init", sql: sql("CREATE TABLE a ();\n") },
  { name: "20260201000000_second", sql: sql("CREATE TABLE b ();\r\nCREATE INDEX i ON b ();\r\n") },
  { name: "20261106120000_new", sql: sql("CREATE TABLE c ();\n") },
];
const done = (name: string, checksum: string): MigrationHistoryRow => ({ migration_name: name, checksum, finished_at: "2026-10-01T00:00:00Z", rolled_back_at: null });

describe("migration history audit", () => {
  it("recognises the LF checksum of a CRLF working copy, as the canonical Git blob gives it", () => {
    const checksums = migrationChecksums(repo[1].sql);
    expect(checksums.lf).toBe(sha("CREATE TABLE b ();\nCREATE INDEX i ON b ();\n"));
    expect(checksums.crlf).toBe(sha("CREATE TABLE b ();\r\nCREATE INDEX i ON b ();\r\n"));
  });

  it("reports applied and pending migrations and stays clean (the staging case: 14 applied, 4 new)", () => {
    const audit = auditMigrationHistory(repo, [done("20260101000000_init", sha("CREATE TABLE a ();\n")), done("20260201000000_second", sha("CREATE TABLE b ();\nCREATE INDEX i ON b ();\n"))]);
    expect(audit.counts).toMatchObject({ APPLIED: 2, PENDING: 1, FAILED: 0, CHECKSUM_MISMATCH: 0, EXTRA: 0 });
    expect(audit.migrations.map((entry) => entry.checksumVariant)).toEqual(["as-read", "lf", null]);
    expect(audit.clean).toBe(true);
  });

  it("flags a checksum that matches no variant of the repository file", () => {
    const audit = auditMigrationHistory(repo, [done("20260101000000_init", sha("edited by hand"))]);
    expect(audit.migrations[0]).toMatchObject({ state: "CHECKSUM_MISMATCH", checksumVariant: null });
    expect(audit.clean).toBe(false);
  });

  it("flags a failed attempt and a rolled-back one", () => {
    const audit = auditMigrationHistory(repo, [
      { migration_name: "20260101000000_init", checksum: "x", finished_at: null, rolled_back_at: null },
      { migration_name: "20260201000000_second", checksum: "x", finished_at: null, rolled_back_at: "2026-10-02T00:00:00Z" },
    ]);
    expect(audit.migrations.map((entry) => entry.state)).toEqual(["FAILED", "ROLLED_BACK", "PENDING"]);
    expect(audit.clean).toBe(false);
  });

  it("flags history rows the repository does not know", () => {
    const audit = auditMigrationHistory(repo, [done("20260101000000_init", sha("CREATE TABLE a ();\n")), done("20260301000000_manual_hotfix", "y")]);
    expect(audit.extra).toEqual(["20260301000000_manual_hotfix"]);
    expect(audit.counts.EXTRA).toBe(1);
    expect(audit.clean).toBe(false);
  });

  it("flags a re-applied migration and a pending one older than an applied one", () => {
    const audit = auditMigrationHistory(repo, [
      { migration_name: "20260101000000_init", checksum: "x", finished_at: null, rolled_back_at: "2026-10-01T00:00:00Z" },
      done("20260101000000_init", sha("CREATE TABLE a ();\n")),
      done("20261106120000_new", sha("CREATE TABLE c ();\n")),
    ]);
    expect(audit.migrations.map((entry) => entry.state)).toEqual(["APPLIED", "PENDING", "APPLIED"]);
    expect(audit.anomalies).toEqual(["20260101000000_init: 2 history rows", "20260201000000_second: pending but older than an applied migration"]);
    expect(audit.clean).toBe(false);
  });
});
