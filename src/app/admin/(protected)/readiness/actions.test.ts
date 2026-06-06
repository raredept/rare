import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  prisma: {
    operationalEvidence: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

function buildEvidenceFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("key", "stripe_test_payment");
  formData.set("status", "passed");
  formData.set("environment", "staging");
  formData.set("checkedByLabel", "Equipe RARE");
  formData.set("evidenceReference", "Checklist staging 2026-06-06");
  formData.set("notes", "Pagamento test mode aprovado sem dados sensiveis.");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.prisma.operationalEvidence.upsert.mockResolvedValue({ id: "evidence-1" });
});

describe("operational evidence admin actions", () => {
  it("requires admin, upserts sanitized evidence and redirects with success", async () => {
    const { saveOperationalEvidenceAction } = await import("@/app/admin/(protected)/readiness/actions");

    await expect(saveOperationalEvidenceAction(buildEvidenceFormData())).rejects.toThrow(
      /^NEXT_REDIRECT:\/admin\/readiness\?success=evidence-saved&refresh=\d+$/,
    );

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.operationalEvidence.upsert).toHaveBeenCalledWith({
      where: {
        key_environment: {
          key: "stripe_test_payment",
          environment: "staging",
        },
      },
      update: expect.objectContaining({
        status: "passed",
        checkedByLabel: "Equipe RARE",
        notes: "Pagamento test mode aprovado sem dados sensiveis.",
        evidenceReference: "Checklist staging 2026-06-06",
        checkedAt: expect.any(Date),
      }),
      create: expect.objectContaining({
        key: "stripe_test_payment",
        environment: "staging",
        status: "passed",
        checkedAt: expect.any(Date),
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/readiness");
  });

  it("rejects evidence notes containing secrets before persisting", async () => {
    const { saveOperationalEvidenceAction } = await import("@/app/admin/(protected)/readiness/actions");

    await expect(
      saveOperationalEvidenceAction(buildEvidenceFormData({ notes: "Nao salvar sk_live_secret_value" })),
    ).rejects.toThrow(/^NEXT_REDIRECT:\/admin\/readiness\?error=Remova\+Stripe\+secret\+key/);

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.operationalEvidence.upsert).not.toHaveBeenCalled();
  });

  it("redirects with a friendly message when operational evidence table is unavailable", async () => {
    mocks.prisma.operationalEvidence.upsert.mockRejectedValueOnce({
      code: "P2021",
      message: 'The table "OperationalEvidence" does not exist.',
    });
    const { saveOperationalEvidenceAction } = await import("@/app/admin/(protected)/readiness/actions");

    await expect(saveOperationalEvidenceAction(buildEvidenceFormData())).rejects.toThrow(/^NEXT_REDIRECT:/);

    const redirectUrl = mocks.redirect.mock.calls[0]?.[0] ?? "";
    const decodedRedirectUrl = decodeURIComponent(redirectUrl.replace(/\+/g, " "));
    expect(decodedRedirectUrl).toContain("Tabela de evidências ainda não aplicada");
    expect(decodedRedirectUrl).not.toContain("does not exist");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not persist when admin authentication fails", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));
    const { saveOperationalEvidenceAction } = await import("@/app/admin/(protected)/readiness/actions");

    await expect(saveOperationalEvidenceAction(buildEvidenceFormData())).rejects.toThrow("unauthorized");

    expect(mocks.prisma.operationalEvidence.upsert).not.toHaveBeenCalled();
  });
});
