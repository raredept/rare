import { describe, expect, it } from "vitest";
import {
  getDeploymentEnvironment,
  isProductionAppEnv,
  isRestrictedAppEnv,
  isUnknownAppEnv,
  KNOWN_APP_ENVS,
  PRODUCTION_APP_ENVS,
  RESTRICTED_APP_ENVS,
} from "@/lib/deployment-environment";
import { assertProductionMediaBackfillAuthorized } from "@/lib/media-backfill-cli";
import { isRestrictedEnvironment } from "@/lib/staging-access";
import { isPublicIndexingEnabled } from "@/lib/seo";
import { getEmailConfigurationStatus } from "@/lib/email-config";

describe("getDeploymentEnvironment", () => {
  it("treats every production name as production", () => {
    for (const appEnv of ["production", "prod", "live", "PROD", " Live "]) {
      expect(getDeploymentEnvironment({ APP_ENV: appEnv })).toBe("production");
    }
  });

  it("treats the homologation names as restricted even on a production build", () => {
    for (const appEnv of RESTRICTED_APP_ENVS) {
      expect(getDeploymentEnvironment({ APP_ENV: appEnv, NODE_ENV: "production" })).toBe("restricted");
    }
  });

  it("lets a known development label win, so every guard reads it the same way", () => {
    expect(getDeploymentEnvironment({ APP_ENV: "test", NODE_ENV: "production" })).toBe("development");
    expect(getDeploymentEnvironment({ APP_ENV: "development" })).toBe("development");
  });

  it("falls back to NODE_ENV when APP_ENV is unset or unknown", () => {
    expect(getDeploymentEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(getDeploymentEnvironment({ APP_ENV: "rare-prod", NODE_ENV: "production" })).toBe("production");
    expect(getDeploymentEnvironment({ APP_ENV: "qa" })).toBe("development");
    expect(getDeploymentEnvironment({})).toBe("development");
  });
});

describe("name predicates", () => {
  it("classify each known name exactly once", () => {
    for (const name of KNOWN_APP_ENVS) {
      const matches = [isProductionAppEnv({ APP_ENV: name }), isRestrictedAppEnv({ APP_ENV: name })].filter(Boolean);
      expect(matches.length).toBeLessThanOrEqual(1);
      expect(isUnknownAppEnv({ APP_ENV: name })).toBe(false);
    }
  });

  it("flag an unrecognised label", () => {
    expect(isUnknownAppEnv({ APP_ENV: "homologacao" })).toBe(true);
    expect(isUnknownAppEnv({ APP_ENV: "stage" })).toBe(true);
    expect(isUnknownAppEnv({})).toBe(false);
  });
});

// The consumers used to carry their own copies of these lists. They must now
// agree with the shared definition name by name.
describe("every consumer agrees on the environment", () => {
  it("staging gate and noindex follow the restricted list", () => {
    for (const name of [...KNOWN_APP_ENVS, "homologacao", "stage"]) {
      const env = { APP_ENV: name, PUBLIC_INDEXING_ENABLED: "true", NODE_ENV: "production" };
      expect(isRestrictedEnvironment(env)).toBe(isRestrictedAppEnv(env));
      if (isRestrictedAppEnv(env)) expect(isPublicIndexingEnabled(env)).toBe(false);
    }
  });

  it("the e-mail policy requires production delivery exactly where the guards see production", () => {
    const smtp = {
      EMAIL_DRIVER: "smtp",
      SMTP_HOST: "smtp.zoho.com",
      SMTP_PORT: "465",
      SMTP_USER: "orders@raredept.com.br",
      SMTP_PASSWORD: "x",
      EMAIL_FROM_ORDERS: "orders@raredept.com.br",
      EMAIL_TEST_RECIPIENTS: "qa@raredept.com.br",
      EMAIL_SEND_NOT_BEFORE: "2026-01-01T00:00:00Z",
    };

    for (const name of KNOWN_APP_ENVS) {
      const expectsProduction = getDeploymentEnvironment({ APP_ENV: name }) === "production";
      const withProductionMode = getEmailConfigurationStatus({ ...smtp, APP_ENV: name, EMAIL_DELIVERY_MODE: "production" });
      const withTestMode = getEmailConfigurationStatus({ ...smtp, APP_ENV: name, EMAIL_DELIVERY_MODE: "test" });
      expect(withProductionMode !== "missing_required_configuration", `APP_ENV=${name} production mode`).toBe(expectsProduction);
      expect(withTestMode !== "missing_required_configuration", `APP_ENV=${name} test mode`).toBe(!expectsProduction);
    }
  });

  it("covers every production name the e-mail policy recognises", () => {
    expect([...PRODUCTION_APP_ENVS].sort()).toEqual(["live", "prod", "production"]);
  });
});

describe("media backfill authorization (regression)", () => {
  const apply = { dryRun: false, limit: 10, maxSourceBytes: 1 };

  it("blocks every production name, not only the literal 'production'", () => {
    for (const appEnv of ["production", "prod", "live"]) {
      expect(() => assertProductionMediaBackfillAuthorized(apply, { APP_ENV: appEnv }), appEnv).toThrowError(/Backfill em produção bloqueado/);
    }
  });

  it("blocks an unset or unknown label on a production build", () => {
    expect(() => assertProductionMediaBackfillAuthorized(apply, { NODE_ENV: "production" })).toThrow();
    expect(() => assertProductionMediaBackfillAuthorized(apply, { APP_ENV: "rare-prod", NODE_ENV: "production" })).toThrow();
  });

  it("still runs in homologation and with explicit authorization", () => {
    expect(() => assertProductionMediaBackfillAuthorized(apply, { APP_ENV: "staging", NODE_ENV: "production" })).not.toThrow();
    expect(() =>
      assertProductionMediaBackfillAuthorized(apply, { APP_ENV: "prod", MEDIA_BACKFILL_ALLOW_PRODUCTION: "true" }),
    ).not.toThrow();
  });

  it("never blocks a dry run", () => {
    expect(() => assertProductionMediaBackfillAuthorized({ ...apply, dryRun: true }, { APP_ENV: "prod" })).not.toThrow();
  });
});
