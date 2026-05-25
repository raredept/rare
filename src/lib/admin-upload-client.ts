import {
  isOverServerRoutedUploadLimit,
  serverRoutedUploadLimitMessage,
} from "@/lib/upload-limits";

export type AdminUploadContext = "products" | "banners";

type UploadResponse = {
  uploads?: { url: string; key?: string; contentType?: string; size?: number }[];
  error?: string;
};

type UploadOptions = {
  context: AdminUploadContext;
  onProgress?: (progress: number) => void;
};

const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OPTIMIZED_IMAGE_MAX_DIMENSION = 2560;
const OPTIMIZED_IMAGE_QUALITY = 0.86;
const extensionByMimeType = new Map([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
]);

function getFileExtension(fileName: string) {
  const safeName = fileName.split(/[\\/]/).pop() ?? "";
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "";
  return extension?.toLowerCase() ?? "";
}

function hasExtensionMatchingMime(file: File) {
  const allowedExtensions = extensionByMimeType.get(file.type);
  return Boolean(allowedExtensions?.includes(getFileExtension(file.name)));
}

function replaceFileExtension(fileName: string, extension: string) {
  const safeName = fileName.split(/[\\/]/).pop() || "media";
  const baseName = safeName.includes(".") ? safeName.replace(/\.[^.]*$/, "") : safeName;
  return `${baseName || "media"}.${extension}`;
}

function loadImageFromObjectUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao preparar imagem para upload."));
    image.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", OPTIMIZED_IMAGE_QUALITY);
  });
}

async function optimizeImageBeforeUpload(file: File) {
  if (
    !OPTIMIZABLE_IMAGE_TYPES.has(file.type) ||
    !hasExtensionMatchingMime(file) ||
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(1, OPTIMIZED_IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas);
    if (!blob?.size || blob.size >= file.size) return file;

    return new File([blob], replaceFileExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  const preparedFile = await optimizeImageBeforeUpload(file);
  if (isOverServerRoutedUploadLimit(preparedFile)) {
    throw new Error(serverRoutedUploadLimitMessage(context === "banners" ? "Imagem" : "Arquivo"));
  }
  const url = await uploadViaServerRoute(preparedFile, context);
  onProgress?.(100);
  return url;
}
