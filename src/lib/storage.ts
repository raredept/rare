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
const DEFAULT_MAX_GIF_UPLOAD_SIZE_MB = 10;
const DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB = 30;
const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type UploadContext = "products" | "banners";

const allowedMimeTypes = new Map([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
  ["image/gif", ["gif"]],
  ["video/mp4", ["mp4"]],
]);

const bannerAllowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const publicExtensionByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["video/mp4", "mp4"],
]);

function getConfiguredMaxMb(variable: string, fallback: number) {
  const maxMb = Number(process.env[variable] ?? fallback);
  return Number.isFinite(maxMb) && maxMb > 0 ? Math.max(1, maxMb) : fallback;
}

export function getMaxUploadSizeMb(mimeType?: string) {
  if (mimeType === "image/gif") {
    return getConfiguredMaxMb("MAX_GIF_UPLOAD_SIZE_MB", DEFAULT_MAX_GIF_UPLOAD_SIZE_MB);
  }

  if (mimeType === "video/mp4") {
    return getConfiguredMaxMb("MAX_VIDEO_UPLOAD_SIZE_MB", DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB);
  }

  return getConfiguredMaxMb("MAX_UPLOAD_SIZE_MB", DEFAULT_MAX_UPLOAD_SIZE_MB);
}

export function getMaxUploadBytes(mimeType?: string) {
  const safeMaxMb = getMaxUploadSizeMb(mimeType);
  return Math.max(1, safeMaxMb) * 1024 * 1024;
}

export function getMaxAcceptedUploadBytes() {
  return Math.max(
    getMaxUploadBytes("image/jpeg"),
    getMaxUploadBytes("image/gif"),
    getMaxUploadBytes("video/mp4"),
  );
}

export function normalizeUploadContext(value: FormDataEntryValue | string | null | undefined): UploadContext {
  const context = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!context || context === "products") return "products";
  if (context === "banners") return "banners";
  throw new Error("Contexto de upload invalido.");
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

export function validateUploadedImageMetadata(file: Pick<File, "name" | "type" | "size">, context: UploadContext = "products") {
  if (context === "banners" && !bannerAllowedMimeTypes.has(file.type)) {
    throw new Error("Formato invalido para banner. Envie JPG, PNG ou WEBP.");
  }

  const allowedExtensions = allowedMimeTypes.get(file.type);
  if (!allowedExtensions) {
    throw new Error("Formato invalido. Envie JPG, PNG, WEBP, GIF ou MP4.");
  }

  const extension = getFileExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    throw new Error("Extensao do arquivo nao corresponde ao formato da midia.");
  }

  if (file.size > getMaxUploadBytes(file.type)) {
    throw new Error(`Arquivo maior que ${getMaxUploadSizeMb(file.type)}MB.`);
  }

  const publicExtension = publicExtensionByMimeType.get(file.type);
  if (!publicExtension) {
    throw new Error("Formato invalido. Envie JPG, PNG, WEBP, GIF ou MP4.");
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

  if (extension === "gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }

  if (extension === "mp4") {
    return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
  }

  return false;
}

export function buildObjectKey(fileName: string, extension: string, now = new Date(), context: UploadContext = "products") {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stem = sanitizeUploadFilenameStem(fileName);
  return `${context}/${year}/${month}/${randomUUID()}-${stem}.${extension}`;
}

export async function saveUploadedImage(file: File, options: { context?: UploadContext } = {}) {
  const context = options.context ?? "products";
  const extension = validateUploadedImageMetadata(file, context);
  const objectKey = buildObjectKey(file.name, extension, new Date(), context);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(bytes, extension)) {
    throw new Error("Arquivo de midia invalido.");
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
