"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { settingsFormSchema } from "@/lib/validators";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const parsed = settingsFormSchema.parse({
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
    checkoutReservationMinutes: Number(text(formData, "checkoutReservationMinutes") || 30),
  });

  await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: parsed,
    create: { id: "store", ...parsed },
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?success=settings-saved");
}
