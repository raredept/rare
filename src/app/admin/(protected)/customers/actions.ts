"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAdminEntityId } from "@/lib/admin-action-input";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deactivates (or reactivates) a customer account without deleting anything: orders, payments and
 * support requests stay for the audit trail. Deactivating also ends every open session (the session
 * version moves), and an inactive account cannot sign in.
 */
export async function setCustomerActiveAction(formData: FormData) {
  const admin = await requireAdmin("commerce.customers");
  const id = parseAdminEntityId(formData.get("customerId"));
  const active = formData.get("active");
  if (!id || (active !== "true" && active !== "false")) redirect(withAdminActionRefresh("/admin/customers?error=customer-invalid"));

  const nextActive = active === "true";
  const updated = await prisma.customer.updateMany({
    where: { id, active: !nextActive },
    data: nextActive ? { active: true } : { active: false, sessionVersion: { increment: 1 } },
  });
  if (updated.count) {
    await recordAdminAudit(prisma, {
      actor: { id: admin.id, label: admin.username ?? admin.email },
      action: nextActive ? "customer.reactivated" : "customer.deactivated",
      entityType: "Customer",
      entityId: id,
    });
  }
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
  redirect(withAdminActionRefresh(`/admin/customers/${id}?success=${nextActive ? "customer-reactivated" : "customer-deactivated"}`));
}
