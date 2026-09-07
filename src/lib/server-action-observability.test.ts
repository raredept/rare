import { describe, expect, it } from "vitest";
import {
  buildServerActionErrorRecord,
  buildServerActionRequestRecord,
  getServerActionDeploymentId,
  sanitizeServerActionRoute,
} from "@/lib/server-action-observability";

describe("server action observability", () => {
  it("prefers an explicit deployment id and falls back to Railway metadata", () => {
    expect(getServerActionDeploymentId({
      NEXT_DEPLOYMENT_ID: "release-explicit",
      RAILWAY_DEPLOYMENT_ID: "railway-deploy",
      RAILWAY_GIT_COMMIT_SHA: "abcdef1234567890",
    })).toBe("release-explicit");
    expect(getServerActionDeploymentId({ RAILWAY_DEPLOYMENT_ID: "railway-deploy" })).toBe("railway-deploy");
    expect(getServerActionDeploymentId({ RAILWAY_GIT_COMMIT_SHA: "ABCDEF1234567890" })).toBe("abcdef1234567890");
  });

  it("omits malformed identifiers instead of copying them to logs", () => {
    const record = buildServerActionRequestRecord({
      route: "/entrar?email=person@example.com&token=private",
      method: "POST",
      requestId: "bad identifier with spaces",
      authState: "anonymous",
      appVersion: "0.1.0",
      environment: {
        NODE_ENV: "production\nforged-log-line",
        RAILWAY_GIT_COMMIT_SHA: "not-a-sha",
        RAILWAY_DEPLOYMENT_ID: "bad deployment with spaces",
        RAILWAY_REPLICA_ID: "replica-1",
      },
      timestamp: "2026-09-07T12:00:00.000Z",
    });
    const serialized = JSON.stringify(record);

    expect(record).toEqual(expect.objectContaining({
      route: "/entrar",
      method: "POST",
      requestId: "invalid",
      authState: "anonymous",
      releaseSha: null,
      deploymentId: null,
      replicaId: "replica-1",
      environment: "unknown",
    }));
    expect(serialized).not.toMatch(/person@example\.com|private|bad deployment|not-a-sha/);
  });

  it("does not include the error object, action id, payload, or headers", () => {
    const record = buildServerActionErrorRecord({
      route: "/admin/produtos?secret=value",
      method: "POST",
      requestId: "request-123",
      appVersion: "0.1.0",
      environment: { NODE_ENV: "production", RAILWAY_GIT_COMMIT_SHA: "abcdef1234567890" },
      timestamp: "2026-09-07T12:00:00.000Z",
    });
    const serialized = JSON.stringify(record);

    expect(record.category).toBe("server_action_execution_error");
    expect(record.route).toBe("/admin/produtos");
    expect(serialized).not.toMatch(/secret|next-action|cookie|authorization|payload/i);
  });

  it("normalizes routes without retaining query strings", () => {
    expect(sanitizeServerActionRoute("https://raredept.com.br/minha-conta/enderecos?cpf=123")).toBe("/minha-conta/enderecos");
    expect(sanitizeServerActionRoute("/%3Cscript%3E")).not.toContain("<script>");
  });
});
