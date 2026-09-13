import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { applyProductImageFraming, prepareProductImageEditor, productImageReferenceSchema, resolveProductImageReference, uploadProductImageForEditor } from "@/lib/product-image-editor";
import { createProductImagePreview, ProductImageEditorError } from "@/lib/product-image-crop";
import { readAuthorizedProductImage } from "@/lib/product-image-editor-storage";
import { imageFramingSchema } from "@/lib/product-image-framing";
import { SERVER_ROUTED_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), reference: productImageReferenceSchema }).strict(),
  z.object({ action: z.literal("apply"), reference: productImageReferenceSchema, framing: imageFramingSchema }).strict(),
]);

function fail(error: unknown) {
  return NextResponse.json({ error: error instanceof ProductImageEditorError ? error.message : error instanceof z.ZodError ? "Enquadramento ou referência inválida." : "Não foi possível processar a imagem. A mídia anterior foi preservada." }, { status: 400 });
}

function sameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return origin.host.toLowerCase() === request.headers.get("host")?.toLowerCase() &&
      (origin.protocol === "https:" || (process.env.NODE_ENV !== "production" && origin.protocol === "http:"));
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const limited = await rateLimit(`admin-image-preview:${admin.id}`, 120, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Aguarde um instante." }, { status: 429 });
  try {
    const reference = Object.fromEntries(new URL(request.url).searchParams);
    const source = await resolveProductImageReference(admin.id, reference);
    const preview = await createProductImagePreview(await readAuthorizedProductImage(source.originalUrl));
    return new Response(new Uint8Array(preview), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const limited = await rateLimit(`admin-image-editor:${admin.id}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Aguarde um instante." }, { status: 429 });
  try {
    const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
    const maxBytes = multipart ? SERVER_ROUTED_UPLOAD_LIMIT_BYTES + 64 * 1024 : 4096;
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > maxBytes) return NextResponse.json({ error: "Arquivo ou requisição acima do limite." }, { status: 413 });
    // Bound the actual stream as well: Content-Length is not trustworthy.
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (!request.body) throw new ProductImageEditorError("Requisição vazia.");
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return NextResponse.json({ error: "Arquivo ou requisição acima do limite." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bounded = new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "application/json" } });
    if (multipart) {
      const form = await bounded.formData();
      const file = form.get("file");
      if (!(file instanceof File) || form.getAll("file").length !== 1 || file.size > SERVER_ROUTED_UPLOAD_LIMIT_BYTES) {
        throw new ProductImageEditorError("Envie uma imagem de até 4 MB.");
      }
      return NextResponse.json({ asset: await uploadProductImageForEditor(admin.id, file) });
    }
    const payload = requestSchema.parse(await bounded.json());
    const asset = payload.action === "prepare"
      ? await prepareProductImageEditor(admin.id, payload.reference)
      : await applyProductImageFraming(admin.id, payload.reference, payload.framing);
    return NextResponse.json({ asset });
  } catch (error) { return fail(error); }
}
