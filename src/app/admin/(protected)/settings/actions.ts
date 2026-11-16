"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { cardInstallmentAuditView, parseCardInstallmentSettings } from "@/lib/card-installment-settings";
import { parseMoneyToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { settingsFormSchema } from "@/lib/validators";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin("system.settings");
  const parsedResult = settingsFormSchema.safeParse({
    instagramUrl: text(formData, "instagramUrl") || undefined,
    storeName: text(formData, "storeName"),
    whatsappNumber: text(formData, "whatsappNumber") || undefined,
    whatsappDefaultMessage: text(formData, "whatsappDefaultMessage"),
    manualShippingInCents: parseMoneyToCents(formData.get("fixedShipping")),
    freeShippingMinInCents: parseMoneyToCents(formData.get("freeShippingThreshold")) || undefined,
    originCep: text(formData, "originCep") || undefined,
    shippingMode: text(formData, "shippingMode") || "fixed",
    fixedShippingInCents: parseMoneyToCents(formData.get("fixedShipping")),
    freeShippingThresholdInCents: parseMoneyToCents(formData.get("freeShippingThreshold")) || undefined,
    shippingInstructions: text(formData, "shippingInstructions") || undefined,
    checkoutRequiresAddress: formData.get("checkoutRequiresAddress") === "on",
    checkoutReservationMinutes: 15,
  });
  if (!parsedResult.success) {
    redirect(withAdminActionRefresh("/admin/settings?error=settings-validation"));
  }
  const parsed = parsedResult.data;

  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: parsed,
    create: { id: "store", ...parsed },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  redirect(withAdminActionRefresh("/admin/settings?success=settings-saved"));
}

/**
 * Admin → Configurações → Pagamentos → Cartão de crédito. Same permission as the other store
 * settings (system.settings): no new role or permission. Every change is audited (before/after).
 * Rules apply only to NEW orders; existing orders keep their own snapshot.
 */
export async function saveCardInstallmentSettingsAction(formData: FormData) {
  const admin = await requireAdmin("system.settings");
  const parsed = parseCardInstallmentSettings(formData);
  if (!parsed.ok) {
    redirect(withAdminActionRefresh(`/admin/settings?error=installments&code=${parsed.code}#parcelamento`));
  }
  const value = parsed.value;
  await prisma.$transaction(async (tx) => {
    const before = await tx.storeSettings.findUnique({
      where: { id: "store" },
      select: { cardInstallmentsEnabled: true, cardInstallmentsMax: true, cardInstallmentsMinInCents: true, cardInstallment4xBps: true, cardInstallment5xBps: true, cardInstallment6xBps: true },
    });
    await tx.storeSettings.upsert({ where: { id: "store" }, update: value, create: { id: "store", ...value } });
    await recordAdminAudit(tx, {
      actor: { id: admin.id, label: admin.username ?? admin.email },
      action: "settings.installments_updated",
      entityType: "StoreSettings",
      entityId: "store",
      before: cardInstallmentAuditView(before),
      after: cardInstallmentAuditView(value),
    });
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  redirect(withAdminActionRefresh("/admin/settings?success=installments-saved#parcelamento"));
}
