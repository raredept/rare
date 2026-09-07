import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { SERVER_ROUTED_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The former direct-to-R2 upload flow trusted client-declared metadata and
 * published the object without validating its bytes. Keep the legacy endpoint
 * explicitly closed so stale consumers receive a deterministic response while
 * the Admin continues to use the validated server-routed upload endpoint.
 */
export async function POST() {
  await requireAdmin();

  return NextResponse.json(
    {
      code: "DIRECT_UPLOAD_DISABLED",
      error: "Upload direto desativado. Use o upload validado do Admin.",
      uploadEndpoint: "/api/admin/uploads",
      maxBytes: SERVER_ROUTED_UPLOAD_LIMIT_BYTES,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
