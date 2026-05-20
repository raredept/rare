import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getStorageDriver } from "@/lib/env";
import { createPresignedR2Upload, normalizeUploadContext } from "@/lib/storage";
import { DIRECT_R2_UPLOAD_LIMIT_BYTES, SERVER_ROUTED_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const presignRequestSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().min(1).max(DIRECT_R2_UPLOAD_LIMIT_BYTES),
  uploadContext: z.enum(["products", "banners"]),
});

export async function POST(request: NextRequest) {
  await requireAdmin();

  try {
    const payload = presignRequestSchema.parse(await request.json());
    const context = normalizeUploadContext(payload.uploadContext);

    if (getStorageDriver() !== "r2") {
      return NextResponse.json(
        {
          fallback: "server-routed",
          maxBytes: SERVER_ROUTED_UPLOAD_LIMIT_BYTES,
          error: "Upload direto para R2 indisponivel neste ambiente. O Admin pode usar o upload local apenas para arquivos pequenos.",
        },
        { status: 409 },
      );
    }

    const upload = await createPresignedR2Upload(
      {
        name: payload.filename,
        type: payload.contentType,
        size: payload.sizeBytes,
      },
      { context },
    );

    return NextResponse.json({ upload });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Metadados de upload invalidos."
        : error instanceof Error
          ? error.message
          : "Falha ao gerar URL de upload.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
