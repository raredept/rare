import { describe, expect, it } from "vitest";
import { assertProductionMediaBackfillAuthorized, parseMediaBackfillArgs } from "@/lib/media-backfill-cli";

describe("media backfill CLI safeguards", () => {
  it.each(["0", "-1", "1.5", "101", "invalid"])("rejects invalid limit %s", (limit) => {
    expect(() => parseMediaBackfillArgs([`--limit=${limit}`], {})).toThrow("--limit deve ser um inteiro entre 1 e 100.");
  });
  it("defaults to dry-run and rejects conflicting modes", () => {
    expect(parseMediaBackfillArgs([], {}).dryRun).toBe(true);
    expect(() => parseMediaBackfillArgs(["--apply", "--dry-run"], {})).toThrow();
  });
  it("blocks production apply without the second explicit authorization", () => {
    const args = parseMediaBackfillArgs(["--apply"], {});
    expect(() => assertProductionMediaBackfillAuthorized(args, { APP_ENV: "production" })).toThrow("Backfill em produção bloqueado");
  });
});
