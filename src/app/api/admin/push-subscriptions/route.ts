import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

async function requireApiAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { admin, response: null };
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireApiAdmin();
  if (response) return response;

  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
  const subscription = await prisma.adminPushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: admin.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
      active: true,
      failedAt: null,
    },
    update: {
      userId: admin.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
      active: true,
      failedAt: null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: subscription.id });
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireApiAdmin();
  if (response) return response;

  const parsed = z.object({ endpoint: z.url().max(2048) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  await prisma.adminPushSubscription.updateMany({
    where: { endpoint: parsed.data.endpoint },
    data: {
      active: false,
      failedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
