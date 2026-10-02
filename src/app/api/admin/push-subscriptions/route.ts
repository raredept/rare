import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(isAllowedPushEndpoint, "Unsupported push service."),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }).strict(),
}).strict();

async function requireApiAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  }
  if (admin.mustChangePassword) {
    return {
      admin: null,
      response: NextResponse.json(
        { error: "Password change required", code: "ADMIN_PASSWORD_CHANGE_REQUIRED" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { admin, response: null };
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireApiAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

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
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const parsed = z.object({ endpoint: z.url().max(2048) }).strict().safeParse(await request.json().catch(() => null));
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
