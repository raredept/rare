"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { requireAdmin } from "@/lib/auth";
import { updateOrderStatusWithReservationRelease } from "@/lib/checkout";
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
