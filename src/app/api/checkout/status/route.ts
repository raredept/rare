import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const id = request.nextUrl.searchParams.get("pedido");
  const order = await prisma.order.findFirst({
    where: { customerId: customer.id, ...(id ? { id } : {
      checkoutDeadlineAt: { not: null }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    }) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, orderNumber: true, status: true, checkoutDeadlineAt: true,
      reservationExpiresAt: true, checkoutExpiredAt: true, stripeCheckoutSessionId: true },
  });
  const checkedAt = new Date();
  if (!order) return NextResponse.json({ order: null, serverNow: checkedAt.toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  const deadline = order.checkoutDeadlineAt ?? order.reservationExpiresAt;
  const processing = order.status === "awaiting_payment" && !order.reservationExpiresAt;
  let resumeUrl: string | null = null;
  if (!processing && order.status === "awaiting_payment" && deadline && deadline > checkedAt && order.stripeCheckoutSessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
      if (session.status === "open" && session.payment_status !== "paid") resumeUrl = session.url;
    } catch { /* A provider failure must never expose a possibly expired link. */ }
  }
  // Provider latency must not extend the displayed window or revive its link.
  const serverNow = new Date();
  if (deadline && deadline <= serverNow) resumeUrl = null;
  return NextResponse.json({ order: {
    id: order.id, orderNumber: order.orderNumber, status: order.status,
    deadlineAt: deadline?.toISOString() ?? null, expiredAt: order.checkoutExpiredAt?.toISOString() ?? null,
    processing, resumeUrl,
  }, serverNow: serverNow.toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
}
