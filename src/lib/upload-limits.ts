export const SERVER_ROUTED_UPLOAD_LIMIT_MB = 4;
export const SERVER_ROUTED_UPLOAD_LIMIT_BYTES = SERVER_ROUTED_UPLOAD_LIMIT_MB * 1024 * 1024;

export const PRODUCT_UPLOAD_HELP_TEXT =
  "JPG, PNG, WEBP, AVIF, GIF ou MP4. Máximo 4 MB por arquivo. Imagens estáticas elegíveis podem gerar versões WEBP para catálogo e detalhe.";
export const BANNER_UPLOAD_HELP_TEXT =
  "JPG, PNG, WEBP, AVIF, GIF ou MP4. Máximo 4 MB por arquivo. Imagens estáticas elegíveis podem gerar versões WEBP; GIF e MP4 são preservados.";

export function isOverServerRoutedUploadLimit(file: Pick<File, "size">) {
  return file.size > SERVER_ROUTED_UPLOAD_LIMIT_BYTES;
}

export function serverRoutedUploadLimitMessage(kind = "Arquivo") {
  return `${kind} acima de ${SERVER_ROUTED_UPLOAD_LIMIT_MB} MB. Comprima a mídia ou envie uma versão menor.`;
}
