export const VERCEL_FUNCTION_PAYLOAD_LIMIT_MB = 4.5;
export const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = Math.floor(VERCEL_FUNCTION_PAYLOAD_LIMIT_MB * 1024 * 1024);
export const SERVER_ROUTED_UPLOAD_LIMIT_MB = 4;
export const SERVER_ROUTED_UPLOAD_LIMIT_BYTES = SERVER_ROUTED_UPLOAD_LIMIT_MB * 1024 * 1024;

export const PRODUCT_UPLOAD_HELP_TEXT = "JPG, PNG, WEBP, GIF ou MP4 até 4 MB por arquivo.";
export const BANNER_UPLOAD_HELP_TEXT = "JPG, PNG ou WEBP até 4 MB.";

export function isOverServerRoutedUploadLimit(file: Pick<File, "size">) {
  return file.size > SERVER_ROUTED_UPLOAD_LIMIT_BYTES;
}

export function serverRoutedUploadLimitMessage(kind = "Arquivo") {
  return `${kind} acima de ${SERVER_ROUTED_UPLOAD_LIMIT_MB} MB. Comprima a mídia ou envie uma versão menor.`;
}
