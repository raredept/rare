import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getUploadFailureDiagnostic } from "@/lib/upload-observability";
import {
  getPublicUploadErrorMessage,
  normalizeUploadContext,
  saveUploadedImage,
} from "@/lib/storage";
import {
  SERVER_ROUTED_UPLOAD_LIMIT_BYTES,
  serverRoutedUploadLimitMessage,
} from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxFilesPerRequest = 10;

function getMaxRequestBytes() {
  return SERVER_ROUTED_UPLOAD_LIMIT_BYTES * maxFilesPerRequest;
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim();
  if (!origin || !host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const allowedProtocol =
      parsedOrigin.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && parsedOrigin.protocol === "http:");

    return allowedProtocol && parsedOrigin.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origem de upload invalida." }, { status: 403 });
  }

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
    const message = getPublicUploadErrorMessage(error);
    if (message === "Falha ao processar ou armazenar a mídia.") {
      console.error("admin_upload_failure", getUploadFailureDiagnostic(error));
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
