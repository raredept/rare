import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMaxAcceptedUploadBytes, normalizeUploadContext, saveUploadedImage } from "@/lib/storage";
import { VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES, serverRoutedUploadLimitMessage } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxFilesPerRequest = 10;

function getMaxRequestBytes() {
  if (process.env.VERCEL === "1") {
    return VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES;
  }

  return getMaxAcceptedUploadBytes() * maxFilesPerRequest;
}

export async function POST(request: NextRequest) {
  await requireAdmin();

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    const maxRequestBytes = getMaxRequestBytes();
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
      return NextResponse.json({ error: serverRoutedUploadLimitMessage("Upload") }, { status: 413 });
    }

    const formData = await request.formData();
    const uploadContext = normalizeUploadContext(formData.get("uploadContext"));
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (files.length > maxFilesPerRequest) {
      return NextResponse.json({ error: `Envie no maximo ${maxFilesPerRequest} arquivos por vez.` }, { status: 400 });
    }

    const uploads = [];
    for (const file of files) {
      uploads.push(await saveUploadedImage(file, { context: uploadContext }));
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
