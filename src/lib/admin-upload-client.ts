import {
  isOverServerRoutedUploadLimit,
  serverRoutedUploadLimitMessage,
} from "@/lib/upload-limits";

export type AdminUploadContext = "products" | "banners";

type UploadResponse = {
  uploads?: {
    url: string;
    key?: string;
    contentType?: string;
    size?: number;
    width?: number;
    height?: number;
    variants?: Array<{
      kind: "thumbnail" | "medium";
      url: string;
      key: string;
      contentType: "image/webp";
      size: number;
      width: number;
      height: number;
    }>;
  }[];
  error?: string;
};

type UploadOptions = {
  context: AdminUploadContext;
  onProgress?: (progress: number) => void;
};

async function uploadViaServerRoute(file: File, context: AdminUploadContext) {
  const formData = new FormData();
  formData.set("uploadContext", context);
  formData.append("files", file);

  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData,
  });
  const body = (await response.json().catch(() => ({}))) as UploadResponse;

  if (!response.ok || body.error) {
    const fallbackMessage = response.status === 413 ? serverRoutedUploadLimitMessage("Arquivo") : "Falha ao enviar mídia.";
    throw new Error(body.error || fallbackMessage);
  }

  const uploaded = body.uploads?.[0];
  if (!uploaded?.url) {
    throw new Error("Upload concluído sem URL pública.");
  }

  return uploaded.url;
}

export async function uploadAdminMediaFile(file: File, { context, onProgress }: UploadOptions) {
  if (isOverServerRoutedUploadLimit(file)) {
    throw new Error(serverRoutedUploadLimitMessage(context === "banners" ? "Imagem" : "Arquivo"));
  }

  onProgress?.(5);
  const url = await uploadViaServerRoute(file, context);
  onProgress?.(100);
  return url;
}
