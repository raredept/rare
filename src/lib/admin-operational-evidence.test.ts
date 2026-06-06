import { describe, expect, it } from "vitest";
import {
  buildOperationalEvidenceReport,
  expectedOperationalEvidence,
  isOperationalEvidenceStorageUnavailableError,
  operationalEvidenceStorageUnavailableMessage,
  parseOperationalEvidenceInput,
  sanitizeOperationalEvidenceDisplayText,
  type StoredOperationalEvidence,
} from "@/lib/admin-operational-evidence";

const now = new Date("2026-06-06T12:00:00.000Z");

function row(overrides: Partial<StoredOperationalEvidence>): StoredOperationalEvidence {
  return {
    key: "stripe_test_payment",
    status: "passed",
    environment: "staging",
    checkedAt: now,
    checkedByLabel: "Equipe RARE",
    notes: "Aprovado em staging.",
    evidenceReference: "Checklist staging",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("admin operational evidence", () => {
  it("lists every critical operational evidence expected before open sales", () => {
    expect(expectedOperationalEvidence.map((item) => item.key)).toEqual([
      "redis_shared_health",
      "public_smoke",
      "stripe_test_payment",
      "stripe_webhook_signed",
      "order_paid_admin",
      "inventory_reserve_sale_release",
      "inventory_expiration_release",
      "expired_inventory_cron",
      "admin_r2_upload",
      "checkout_enabled_decision",
      "limited_production_approval",
      "open_sales_approval",
    ]);
    expect(expectedOperationalEvidence.every((item) => item.blocksOpenSales)).toBe(true);
  });

  it("blocks open sales when Stripe test payment evidence is missing", () => {
    const rows = expectedOperationalEvidence
      .filter((item) => item.key !== "stripe_test_payment")
      .map((item) => row({ key: item.key, environment: item.defaultEnvironment }));
    const report = buildOperationalEvidenceReport(rows);
    const stripeItem = report.items.find((item) => item.key === "stripe_test_payment");

    expect(stripeItem).toEqual(expect.objectContaining({ status: "pending", missingForOpenSales: true }));
    expect(report.openSalesReady).toBe(false);
  });

  it("removes the Stripe blocker when the evidence is passed", () => {
    const rows = expectedOperationalEvidence.map((item) => row({ key: item.key, environment: item.defaultEnvironment }));
    const report = buildOperationalEvidenceReport(rows);
    const stripeItem = report.items.find((item) => item.key === "stripe_test_payment");

    expect(stripeItem).toEqual(expect.objectContaining({ status: "passed", missingForOpenSales: false }));
    expect(report.openSalesReady).toBe(true);
  });

  it("rejects secrets and sensitive personal data in submitted notes", () => {
    const result = parseOperationalEvidenceInput({
      key: "stripe_webhook_signed",
      status: "passed",
      environment: "staging",
      checkedByLabel: "Equipe",
      notes: "Webhook validado com whsec_secret_value",
      evidenceReference: "Checklist",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Stripe webhook secret");
    }
  });

  it("sanitizes stored text defensively before display", () => {
    const sanitized = sanitizeOperationalEvidenceDisplayText("Nao mostrar sk_test_abc123 nem cliente@example.com");

    expect(sanitized).toContain("[removido]");
    expect(sanitized).not.toContain("sk_test_abc123");
    expect(sanitized).not.toContain("cliente@example.com");
  });

  it("keeps configuration evidence separate from operational approval", () => {
    const report = buildOperationalEvidenceReport([
      row({
        key: "redis_shared_health",
        status: "passed",
        environment: "production",
      }),
    ]);

    expect(report.items.find((item) => item.key === "redis_shared_health")).toEqual(
      expect.objectContaining({ satisfiedForOpenSales: true }),
    );
    expect(report.items.find((item) => item.key === "stripe_test_payment")).toEqual(
      expect.objectContaining({ status: "pending", missingForOpenSales: true }),
    );
    expect(report.openSalesBlockedCount).toBe(expectedOperationalEvidence.length - 1);
  });

  it("marks storage as unavailable without marking evidence as approved", () => {
    const report = buildOperationalEvidenceReport([], { storageAvailable: false });

    expect(report.storageAvailable).toBe(false);
    expect(report.storageWarning).toBe(operationalEvidenceStorageUnavailableMessage);
    expect(report.openSalesReady).toBe(false);
    expect(report.openSalesBlockedCount).toBe(expectedOperationalEvidence.length);
    expect(report.items.every((item) => item.status === "pending")).toBe(true);
  });

  it("recognizes Prisma missing table errors without matching arbitrary errors", () => {
    expect(isOperationalEvidenceStorageUnavailableError({ code: "P2021", message: "Table does not exist" })).toBe(true);
    expect(isOperationalEvidenceStorageUnavailableError({ code: "P2022", message: "Column does not exist" })).toBe(true);
    expect(isOperationalEvidenceStorageUnavailableError(new Error("database connection failed"))).toBe(false);
  });
});
