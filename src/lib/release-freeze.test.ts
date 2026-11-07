import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEVELOPMENT_APP_ENVS, PRODUCTION_APP_ENVS, RESTRICTED_APP_ENVS } from "@/lib/deployment-environment";
import {
  RELEASE_ENVIRONMENT_NAMES,
  checkReleaseFreeze,
  decideRelease,
  evaluateFreezeRecord,
  readFreezeRecord,
  resolveReleaseTarget,
} from "../../scripts/release-freeze.mjs";

const evidenceExists = (relative: string) => relative === "docs/cycles/rare-bf-mfa-asaas/SECURITY_FREEZE_CLOSURE.md";
const cleared = {
  state: "CLEARED",
  closure: { clearedAt: "2026-11-20", clearedBy: "Owner, after Phase S and Phase P", evidence: "docs/cycles/rare-bf-mfa-asaas/SECURITY_FREEZE_CLOSURE.md" },
};
const active = { state: "ACTIVE", closure: { clearedAt: null, clearedBy: null, evidence: null } };

function decide(record: unknown, env: Record<string, string | undefined>) {
  return decideRelease({ freeze: evaluateFreezeRecord(record, { evidenceExists }), target: resolveReleaseTarget(env, undefined), environmentFreeze: env.RELEASE_SECURITY_FREEZE });
}

describe("release security freeze", () => {
  it("fails a production release closed while the freeze is active", () => {
    for (const env of [{ APP_ENV: "production" }, { APP_ENV: "prod" }, { RAILWAY_ENVIRONMENT_NAME: "production" }, { NODE_ENV: "production" }]) {
      expect(decide(active, env)).toMatchObject({ allowed: false, level: "fail", target: "production" });
    }
  });

  it("lets staging and development proceed with a warning, so the rotation can be rehearsed", () => {
    expect(decide(active, { APP_ENV: "staging", RAILWAY_ENVIRONMENT_NAME: "staging" })).toMatchObject({ allowed: true, level: "warn", target: "restricted" });
    expect(decide(active, {})).toMatchObject({ allowed: true, level: "warn", target: "development" });
  });

  it("passes a production release once the record is CLEARED with its closure", () => {
    expect(decide(cleared, { APP_ENV: "production" })).toMatchObject({ allowed: true, level: "ok", active: false });
  });

  it.each(["false", "0", "off", "disabled", "no", "", "cleared", "Cleared", " CLEARED", "CLEARED ", "INACTIVE", null, 0, false])(
    "does not treat state %j as cleared",
    (state) => {
      expect(decide({ ...cleared, state }, { APP_ENV: "production" })).toMatchObject({ allowed: false, level: "fail" });
    },
  );

  it.each([
    ["no date", { ...cleared.closure, clearedAt: null }],
    ["unparseable date", { ...cleared.closure, clearedAt: "soon" }],
    ["no owner", { ...cleared.closure, clearedBy: "  " }],
    ["no evidence", { ...cleared.closure, evidence: null }],
    ["evidence that does not exist", { ...cleared.closure, evidence: "docs/nowhere.md" }],
  ])("keeps the freeze when CLEARED has %s", (_label, closure) => {
    expect(decide({ ...cleared, closure }, { APP_ENV: "production" })).toMatchObject({ allowed: false, level: "fail" });
  });

  it("treats a missing or malformed record as ACTIVE", () => {
    for (const record of [null, undefined, "CLEARED", [], {}]) {
      expect(decide(record, { APP_ENV: "production" })).toMatchObject({ allowed: false, level: "fail" });
    }
  });

  it.each(["false", "0", "off", "disabled", "CLEARED", "cleared"])(
    "never lets RELEASE_SECURITY_FREEZE=%s lift an active record",
    (value) => {
      const decision = decide(active, { APP_ENV: "production", RELEASE_SECURITY_FREEZE: value });
      expect(decision).toMatchObject({ allowed: false, level: "fail" });
      expect(decision.notes.join(" ")).toContain("can only activate");
    },
  );

  it("lets the environment re-activate a cleared record", () => {
    expect(decide(cleared, { APP_ENV: "production", RELEASE_SECURITY_FREEZE: "active" })).toMatchObject({ allowed: false, level: "fail", reason: "RELEASE_SECURITY_FREEZE=ACTIVE set in the environment" });
  });

  it("counts any production or unrecognised signal as production", () => {
    expect(resolveReleaseTarget({ APP_ENV: "staging", RAILWAY_ENVIRONMENT_NAME: "production" }, undefined)).toBe("production");
    expect(resolveReleaseTarget({ APP_ENV: "stagin" }, undefined)).toBe("production");
    expect(resolveReleaseTarget({ RELEASE_TARGET: "review" }, undefined)).toBe("production");
    expect(resolveReleaseTarget({ APP_ENV: "staging" }, "production")).toBe("production");
    expect(resolveReleaseTarget({ APP_ENV: "homologation" }, undefined)).toBe("restricted");
    expect(resolveReleaseTarget({ APP_ENV: "test" }, undefined)).toBe("development");
  });

  it("uses the same environment names as the application", () => {
    expect(RELEASE_ENVIRONMENT_NAMES.production).toEqual([...PRODUCTION_APP_ENVS]);
    expect(RELEASE_ENVIRONMENT_NAMES.restricted).toEqual([...RESTRICTED_APP_ENVS]);
    expect(RELEASE_ENVIRONMENT_NAMES.development).toEqual([...DEVELOPMENT_APP_ENVS]);
  });

  it("reads the committed record, which is ACTIVE until the incident is closed", () => {
    expect(readFreezeRecord()).toMatchObject({ state: "ACTIVE", incident: "docs/security/CREDENTIAL_INCIDENT_202610.md" });
    expect(checkReleaseFreeze({ env: { APP_ENV: "production" } })).toMatchObject({ allowed: false, level: "fail" });
    expect(checkReleaseFreeze({ env: { APP_ENV: "staging" } })).toMatchObject({ allowed: true, level: "warn" });
  });

  it("exits non-zero from the CLI for a production release and zero for staging", () => {
    const script = path.resolve(__dirname, "../../scripts/release-freeze.mjs");
    const run = (env: Record<string, string>) => spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
    const production = run({ APP_ENV: "production", RELEASE_SECURITY_FREEZE: "false" });
    expect(production.status).toBe(1);
    expect(production.stderr).toContain("Production release blocked");
    expect(run({ RAILWAY_ENVIRONMENT_NAME: "staging", APP_ENV: "staging" }).status).toBe(0);
  });
});
