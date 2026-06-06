"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import {
  isOperationalEvidenceStorageUnavailableError,
  operationalEvidenceStorageUnavailableMessage,
  parseOperationalEvidenceInput,
} from "@/lib/admin-operational-evidence";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithEvidenceMessage(params: { success?: string; error?: string }): never {
  const searchParams = new URLSearchParams();
  if (params.success) searchParams.set("success", params.success);
  if (params.error) searchParams.set("error", params.error);
  const query = searchParams.toString();
  redirect(withAdminActionRefresh(`/admin/readiness${query ? `?${query}` : ""}`));
}

export async function saveOperationalEvidenceAction(formData: FormData) {
  await requireAdmin();

  const parsed = parseOperationalEvidenceInput({
    key: text(formData, "key"),
    status: text(formData, "status"),
    environment: text(formData, "environment"),
    checkedByLabel: text(formData, "checkedByLabel"),
    notes: text(formData, "notes"),
    evidenceReference: text(formData, "evidenceReference"),
  });

  if (!parsed.success) {
    redirectWithEvidenceMessage({
      error: parsed.error.issues[0]?.message ?? "Revise a evidencia antes de salvar.",
    });
  }

  const evidence = parsed.data;
  const checkedAt = evidence.status === "pending" ? null : new Date();

  try {
    await prisma.operationalEvidence.upsert({
      where: {
        key_environment: {
          key: evidence.key,
          environment: evidence.environment,
        },
      },
      update: {
        status: evidence.status,
        checkedAt,
        checkedByLabel: evidence.checkedByLabel,
        notes: evidence.notes,
        evidenceReference: evidence.evidenceReference,
      },
      create: {
        key: evidence.key,
        environment: evidence.environment,
        status: evidence.status,
        checkedAt,
        checkedByLabel: evidence.checkedByLabel,
        notes: evidence.notes,
        evidenceReference: evidence.evidenceReference,
      },
    });
  } catch (error) {
    if (isOperationalEvidenceStorageUnavailableError(error)) {
      redirectWithEvidenceMessage({ error: operationalEvidenceStorageUnavailableMessage });
    }

    throw error;
  }

  revalidatePath("/admin/readiness");
  redirectWithEvidenceMessage({ success: "evidence-saved" });
}
