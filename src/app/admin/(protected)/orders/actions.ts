"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { updateOrderStatusWithReservationRelease } from "@/lib/checkout";
import type { OrderStatus } from "@prisma/client";

const allowedManualStatuses: OrderStatus[] = ["processing", "shipped", "delivered", "canceled", "refunded"];

export async function updateOrderStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;

  if (!allowedManualStatuses.includes(status)) {
    throw new Error("Status invalido.");
  }

  await updateOrderStatusWithReservationRelease(id, status, "Status atualizado manualmente no admin");

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
