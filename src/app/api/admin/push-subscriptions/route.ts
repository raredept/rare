import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { isSameOriginRequest } from "@/lib/request-security";
import { rateLimit } from "@/lib/rate-limit";
import { readBoundedRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";

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

async function readPushPayload(request: Request, adminId: string) {
  const limit = await rateLimit(`admin-push:${adminId}`, 120, 60_000);
  if (!limit.ok) {
    return { response: NextResponse.json({ error: "Too many requests" }, { status: 429 }), payload: null };
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return { response: NextResponse.json({ error: "Expected application/json" }, { status: 415 }), payload: null };
  }
  try {
    const bytes = await readBoundedRequestBody(request, 4096);
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return { response: null, payload };
  } catch (error) {
    return {
      response: NextResponse.json({ error: "Invalid push subscription" }, {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
      }),
      payload: null,
    };
  }
}

export async function POST(request: NextRequest) {
  const { admin, response } = await requireApiAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = await readPushPayload(request, admin.id);
  if (body.response) return body.response;
  const parsed = pushSubscriptionSchema.safeParse(body.payload);
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
  const { admin, response } = await requireApiAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = await readPushPayload(request, admin.id);
  if (body.response) return body.response;
  const parsed = z.object({ endpoint: z.url().max(2048) }).strict().safeParse(body.payload);
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
