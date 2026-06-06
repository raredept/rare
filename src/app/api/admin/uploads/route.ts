import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  getMaxAcceptedUploadBytes,
  getPublicUploadErrorMessage,
  normalizeUploadContext,
  saveUploadedImage,
} from "@/lib/storage";
import {
  SERVER_ROUTED_UPLOAD_LIMIT_BYTES,
  VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES,
  serverRoutedUploadLimitMessage,
} from "@/lib/upload-limits";

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
  const admin = await requireAdmin();
  const limit = await rateLimit(`admin-upload:${admin.id}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

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

    const oversizedFile = files.find((file) => file.size > SERVER_ROUTED_UPLOAD_LIMIT_BYTES);
    if (oversizedFile) {
      return NextResponse.json({ error: serverRoutedUploadLimitMessage("Arquivo") }, { status: 413 });
    }

    const uploads = [];
    for (const file of files) {
      uploads.push(await saveUploadedImage(file, { context: uploadContext }));
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json({ error: getPublicUploadErrorMessage(error) }, { status: 400 });
  }
}
