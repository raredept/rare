import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { sendAdminTestPushNotification } from "@/lib/admin-notifications";
import { isSameOriginRequest } from "@/lib/request-security";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A test push is a homologation aid, not a feature: a handful per Admin is enough.
const ADMIN_TEST_PUSH_LIMIT = 5;
const ADMIN_TEST_PUSH_WINDOW_MS = 10 * 60_000;

const noStore = { "Cache-Control": "no-store" };

async function requireApiAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { admin: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore }) };
  }
  if (admin.mustChangePassword) {
    return {
      admin: null,
      response: NextResponse.json(
        { error: "Password change required", code: "ADMIN_PASSWORD_CHANGE_REQUIRED" },
        { status: 403, headers: noStore },
      ),
    };
  }
  // Same permission as registering a device: the test exercises the sale-alert channel.
  if (!hasAdminPermission(admin.role, "commerce.notifications")) {
    return {
      admin: null,
      response: NextResponse.json({ error: "Forbidden", code: "ADMIN_PERMISSION_DENIED" }, { status: 403, headers: noStore }),
    };
  }
  return { admin, response: null };
}

// Sends one clearly labelled test notification to the current Admin's own active
// devices. It creates no Order, AdminNotification, payment, stock or coupon data.
export async function POST(request: NextRequest) {
  const { admin, response } = await requireApiAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: noStore });
  }

  const limit = await rateLimit(`admin-push-test:${admin.id}`, ADMIN_TEST_PUSH_LIMIT, ADMIN_TEST_PUSH_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests", code: "ADMIN_PUSH_TEST_RATE_LIMITED" }, { status: 429, headers: noStore });
  }

  const result = await sendAdminTestPushNotification(admin.id);
  if (result.status !== "sent") {
    return NextResponse.json(
      { error: "Web Push is not configured", code: "ADMIN_PUSH_NOT_CONFIGURED" },
      { status: 503, headers: noStore },
    );
  }
  if (result.attempted === 0) {
    return NextResponse.json(
      { error: "No active device", code: "ADMIN_PUSH_NO_ACTIVE_DEVICE" },
      { status: 409, headers: noStore },
    );
  }

  return NextResponse.json(
    { ok: result.sent > 0, attempted: result.attempted, sent: result.sent, failed: result.failed, disabled: result.disabled },
    { status: result.sent > 0 ? 200 : 502, headers: noStore },
  );
}
