import { NextResponse, type NextRequest } from "next/server";
import { releaseExpiredReservations } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function authorizeCron(request: NextRequest) {
  const secret = clean(process.env.CRON_SECRET);
  if (!secret) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Cron not configured." }, { status: 503 }),
    };
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true as const };
}

function safeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Expired reservation release failed.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[redacted-token]");
}

async function handleReleaseExpiredInventory(request: NextRequest) {
  const authorization = authorizeCron(request);
  if (!authorization.ok) return authorization.response;

  try {
    const releasedReservations = await releaseExpiredReservations();
    return NextResponse.json({
      ok: true,
      releasedReservations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron:release-expired-inventory] failed", { message: safeLogMessage(error) });
    return NextResponse.json({ error: "Expired reservation release failed." }, { status: 500 });
  }
}

export const GET = handleReleaseExpiredInventory;
export const POST = handleReleaseExpiredInventory;
