export const VERCEL_FUNCTION_PAYLOAD_LIMIT_MB = 4.5;
export const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = Math.floor(VERCEL_FUNCTION_PAYLOAD_LIMIT_MB * 1024 * 1024);
export const SERVER_ROUTED_UPLOAD_LIMIT_MB = 4;
export const SERVER_ROUTED_UPLOAD_LIMIT_BYTES = SERVER_ROUTED_UPLOAD_LIMIT_MB * 1024 * 1024;
export const DIRECT_R2_UPLOAD_LIMIT_MB = 100;
export const DIRECT_R2_UPLOAD_LIMIT_BYTES = DIRECT_R2_UPLOAD_LIMIT_MB * 1024 * 1024;

export const PRODUCT_UPLOAD_HELP_TEXT =
  "JPG, PNG, WEBP, GIF ou MP4. Máximo 4 MB por arquivo. Para melhor qualidade e performance, envie imagens em WEBP/JPG otimizadas.";
export const BANNER_UPLOAD_HELP_TEXT =
  "JPG, PNG ou WEBP. Máximo 4 MB por arquivo. Para melhor qualidade e performance, envie imagens em WEBP/JPG otimizadas.";

export function isOverServerRoutedUploadLimit(file: Pick<File, "size">) {
  return file.size > SERVER_ROUTED_UPLOAD_LIMIT_BYTES;
}

export function isOverDirectR2UploadLimit(file: Pick<File, "size">) {
  return file.size > DIRECT_R2_UPLOAD_LIMIT_BYTES;
}

export function serverRoutedUploadLimitMessage(kind = "Arquivo") {
  return `${kind} acima de ${SERVER_ROUTED_UPLOAD_LIMIT_MB} MB. Comprima a mídia ou envie uma versão menor.`;
}

export function directR2UploadLimitMessage(kind = "Arquivo") {
  return `${kind} acima de ${DIRECT_R2_UPLOAD_LIMIT_MB} MB. Envie uma mídia menor ou otimize o arquivo antes do upload.`;
}
