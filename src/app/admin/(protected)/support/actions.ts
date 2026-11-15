"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAdminEntityId } from "@/lib/admin-action-input";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deliverSupportRequest, retrySupportRequest } from "@/lib/support-requests";

/** Puts a FAILED delivery back in the queue. Idempotency keys keep an e-mail from going out twice. */
export async function retrySupportDeliveryAction(formData: FormData) {
  const admin = await requireAdmin("commerce.support");
  const id = parseAdminEntityId(formData.get("id"));
  if (!id) redirect(withAdminActionRefresh("/admin/support?error=support-invalid"));

  const reset = await retrySupportRequest(prisma, id);
  if (reset) {
    await recordAdminAudit(prisma, { actor: { id: admin.id, label: admin.username ?? admin.email }, action: "support.delivery_retried", entityType: "SupportRequest", entityId: id });
    try {
      await deliverSupportRequest(prisma, id);
    } catch {
      // The worker picks it up.
    }
  }
  revalidatePath("/admin/support");
  redirect(withAdminActionRefresh(`/admin/support?success=${reset ? "support-retried" : "support-unchanged"}`));
}
