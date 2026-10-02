"use server";

import { revalidatePath } from "next/cache";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { parseAdminEntityId } from "@/lib/admin-action-input";

export async function markAllAdminNotificationsReadAction() {
  await requireAdmin();

  await prisma.adminNotification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  redirect(withAdminActionRefresh("/admin/notifications?success=notifications-read"));
}

export async function markAdminNotificationReadAction(formData: FormData) {
  await requireAdmin();
  const id = parseAdminEntityId(formData.get("id"));

  if (!id) {
    throw new Error("Notificacao invalida.");
  }

  await prisma.adminNotification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
}
