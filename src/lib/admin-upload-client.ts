import {
  directR2UploadLimitMessage,
  isOverDirectR2UploadLimit,
  isOverServerRoutedUploadLimit,
  serverRoutedUploadLimitMessage,
} from "@/lib/upload-limits";

export type AdminUploadContext = "products" | "banners";

type UploadResponse = {
  uploads?: { url: string; key?: string; contentType?: string; size?: number }[];
  error?: string;
};

type PresignResponse = {
  upload?: {
    uploadUrl: string;
    publicUrl: string;
    key: string;
    contentType: string;
    size: number;
    expiresInSeconds: number;
  };
  fallback?: "server-routed";
  maxBytes?: number;
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

async function putFileToPresignedUrl(file: File, uploadUrl: string, onProgress?: (progress: number) => void) {
  if (typeof XMLHttpRequest === "undefined") {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error("Falha ao enviar mídia ao R2.");
    }
    onProgress?.(100);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error("Falha ao enviar mídia ao R2."));
    };
    request.onerror = () => reject(new Error("Falha de rede ao enviar mídia ao R2."));
    request.send(file);
  });
}

async function requestPresignedUpload(file: File, context: AdminUploadContext) {
  const response = await fetch("/api/admin/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      uploadContext: context,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as PresignResponse;
  return { response, body };
}

export async function uploadAdminMediaFile(file: File, { context, onProgress }: UploadOptions) {
  if (isOverDirectR2UploadLimit(file)) {
    throw new Error(directR2UploadLimitMessage(context === "banners" ? "Imagem" : "Arquivo"));
  }

  const { response, body } = await requestPresignedUpload(file, context);

  if (body.fallback === "server-routed") {
    if (isOverServerRoutedUploadLimit(file)) {
      throw new Error(body.error || "Upload direto para R2 indisponível para arquivos acima de 4 MB neste ambiente.");
    }

    const url = await uploadViaServerRoute(file, context);
    onProgress?.(100);
    return url;
  }

  if (!response.ok || body.error) {
    throw new Error(body.error || "Falha ao preparar upload.");
  }

  if (!body.upload?.uploadUrl || !body.upload.publicUrl) {
    throw new Error("Upload preparado sem URL assinada.");
  }

  await putFileToPresignedUrl(file, body.upload.uploadUrl, onProgress);
  return body.upload.publicUrl;
}
