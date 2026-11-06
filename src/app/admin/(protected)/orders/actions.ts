"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { requireAdmin } from "@/lib/auth";
import { requestAsaasRefund, updateOrderStatusWithReservationRelease } from "@/lib/checkout";
import { invalidOrderTransitionMessage } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";

const allowedManualStatuses: OrderStatus[] = ["processing", "shipped", "delivered", "canceled", "refunded"];

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;

  if (!allowedManualStatuses.includes(status)) {
    throw new Error("Status invalido.");
  }

  try {
    await updateOrderStatusWithReservationRelease(id, status, "Status atualizado manualmente no admin");
  } catch (error) {
    const message = error instanceof Error && [invalidOrderTransitionMessage, "Pedido não encontrado."].includes(error.message) || (error instanceof Error && error.message.startsWith("Pagamento confirmado"))
      ? (error as Error).message
      : "Não foi possível atualizar o pedido agora.";
    redirect(withAdminActionRefresh(`/admin/orders/${id}?error=${encodeURIComponent(message)}`));
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  redirect(withAdminActionRefresh(`/admin/orders/${id}?success=order-status-saved`));
}

/**
 * Full refund at Asaas for a paid order. Requested once (claimed in the database); the order turns
 * "refunded" only when Asaas confirms it. Stock is not restored automatically.
 */
export async function requestOrderRefundAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || formData.get("confirm") !== "ESTORNAR") {
    redirect(withAdminActionRefresh(`/admin/orders/${encodeURIComponent(id)}?error=order-refund-failed`));
  }
  const result = await requestAsaasRefund(id, { id: admin.id, label: admin.username ?? admin.email });
  const outcome = result.status === "requested" ? "success=order-refund-requested"
    : result.status === "already_requested" ? "error=order-refund-duplicate"
    : result.status === "unknown" ? "error=order-refund-unknown"
    : "error=order-refund-failed";
  revalidatePath(`/admin/orders/${id}`);
  redirect(withAdminActionRefresh(`/admin/orders/${id}?${outcome}`));
}
