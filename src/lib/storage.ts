import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  assertUploadStorageReady,
  getR2StorageConfig,
  getStorageDriver,
  getStorageLocalDir,
  getStoragePublicBaseUrl,
} from "@/lib/env";

const DEFAULT_MAX_UPLOAD_SIZE_MB = 5;
const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";

const allowedMimeTypes = new Map([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
]);

const publicExtensionByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function getMaxUploadBytes() {
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5);
  const safeMaxMb = Number.isFinite(maxMb) && maxMb > 0 ? maxMb : DEFAULT_MAX_UPLOAD_SIZE_MB;
  return Math.max(1, safeMaxMb) * 1024 * 1024;
}

export function getMaxUploadSizeMb() {
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? DEFAULT_MAX_UPLOAD_SIZE_MB);
  return Number.isFinite(maxMb) && maxMb > 0 ? Math.max(1, maxMb) : DEFAULT_MAX_UPLOAD_SIZE_MB;
}

function getFileExtension(fileName: string) {
  const safeName = fileName.split(/[\\/]/).pop() ?? "";
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "";
  return extension?.toLowerCase() ?? "";
}

export function sanitizeUploadFilenameStem(fileName: string) {
  const safeName = fileName.split(/[\\/]/).pop() ?? "";
  const withoutExtension = safeName.replace(/\.[^.]*$/, "");
  const normalized = withoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return normalized || "imagem";
}

export function validateUploadedImageMetadata(file: Pick<File, "name" | "type" | "size">) {
  const allowedExtensions = allowedMimeTypes.get(file.type);
  if (!allowedExtensions) {
    throw new Error("Formato invalido. Envie JPG, PNG ou WEBP.");
  }

  const extension = getFileExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    throw new Error("Extensao do arquivo nao corresponde ao formato da imagem.");
  }

  if (file.size > getMaxUploadBytes()) {
    throw new Error(`Arquivo maior que ${getMaxUploadSizeMb()}MB.`);
  }

  const publicExtension = publicExtensionByMimeType.get(file.type);
  if (!publicExtension) {
    throw new Error("Formato invalido. Envie JPG, PNG ou WEBP.");
  }

  return publicExtension;
}

export function hasValidImageSignature(bytes: Buffer, extension: string) {
  if (extension === "jpg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (extension === "webp") {
    return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

export function buildObjectKey(fileName: string, extension: string, now = new Date()) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stem = sanitizeUploadFilenameStem(fileName);
  return `products/${year}/${month}/${randomUUID()}-${stem}.${extension}`;
}

export async function saveUploadedImage(file: File) {
  const extension = validateUploadedImageMetadata(file);
  const objectKey = buildObjectKey(file.name, extension);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(bytes, extension)) {
    throw new Error("Arquivo de imagem invalido.");
  }

  assertUploadStorageReady();

  if (getStorageDriver() === "r2") {
    const r2 = getR2StorageConfig();

    const client = new S3Client({
      region: "auto",
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: file.type,
        CacheControl: UPLOAD_CACHE_CONTROL,
        IfNoneMatch: "*",
      }),
    );

    return {
      url: `${r2.publicBaseUrl}/${objectKey}`,
      key: objectKey,
      contentType: file.type,
      size: file.size,
    };
  }

  const publicPath = `${getStoragePublicBaseUrl()}/${objectKey}`;
  const storageDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), getStorageLocalDir());
  const absolutePath = path.join(storageDir, objectKey);

  if (!absolutePath.startsWith(`${storageDir}${path.sep}`)) {
    throw new Error("Caminho de upload invalido.");
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    url: publicPath,
    key: objectKey,
    contentType: file.type,
    size: file.size,
  };
}
