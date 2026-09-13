import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getR2StorageConfig, getStorageDriver, getStorageLocalDir, getStoragePublicBaseUrl } from "@/lib/env";
import { resolveLocalStorageObjectPath, getMaxAcceptedUploadBytes } from "@/lib/storage";
import { ProductImageEditorError } from "@/lib/product-image-crop";

// Called exclusively after a database reference has been authorized. No HTTP fetch.
export function getEditableStorageKey(url: string, base: string) {
  const prefix = `${base.replace(/\/$/, "")}/`;
  if (!url.startsWith(prefix) || /[?#%\\]/.test(url.slice(prefix.length))) {
    throw new ProductImageEditorError("Esta mídia antiga não está no storage autorizado. Envie o original para reenquadrar.");
  }
  const key = url.slice(prefix.length);
  if (!key.startsWith("products/")) throw new ProductImageEditorError("Referência de mídia inválida.");
  try {
    resolveLocalStorageObjectPath("uploads", key);
  } catch {
    throw new ProductImageEditorError("Referência de mídia inválida.");
  }
  return key;
}

export async function readAuthorizedProductImage(url: string) {
  const maxBytes = getMaxAcceptedUploadBytes();
  if (getStorageDriver() === "r2") {
    const config = getR2StorageConfig();
    const key = getEditableStorageKey(url, config.publicBaseUrl);
    const client = new S3Client({ region: "auto", endpoint: config.endpoint, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
    try {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      if (!result.Body || (result.ContentLength ?? 0) > maxBytes) throw new ProductImageEditorError("Original acima do limite de upload.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new ProductImageEditorError("Original acima do limite de upload.");
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } finally {
      client.destroy();
    }
  }
  const key = getEditableStorageKey(url, getStoragePublicBaseUrl());
  const local = resolveLocalStorageObjectPath(getStorageLocalDir(), key);
  const [root, actual] = await Promise.all([realpath(local.storageDir), realpath(local.absolutePath)]);
  const relative = path.relative(root, actual);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new ProductImageEditorError("Referência de mídia inválida.");
  const file = await open(actual, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > maxBytes) throw new ProductImageEditorError("Original acima do limite de upload.");
    const bytes = await file.readFile();
    if (bytes.length > maxBytes) throw new ProductImageEditorError("Original acima do limite de upload.");
    return bytes;
  } finally {
    await file.close();
  }
}
