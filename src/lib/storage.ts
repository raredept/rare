import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertUploadStorageReady,
  getR2StorageConfig,
  getStorageDriver,
  getStorageLocalDir,
  getStoragePublicBaseUrl,
} from "@/lib/env";
import { generateStaticImageVariants, STATIC_IMAGE_CONTENT_TYPES } from "@/lib/image-variants";
import {
  buildGeneratedMediaObjectKey,
  type GeneratedMediaVariantKind,
} from "@/lib/media-variant-convention";
import {
  DIRECT_R2_UPLOAD_LIMIT_BYTES,
  DIRECT_R2_UPLOAD_LIMIT_MB,
  SERVER_ROUTED_UPLOAD_LIMIT_MB,
} from "@/lib/upload-limits";

const DEFAULT_MAX_UPLOAD_SIZE_MB = SERVER_ROUTED_UPLOAD_LIMIT_MB;
const DEFAULT_MAX_GIF_UPLOAD_SIZE_MB = SERVER_ROUTED_UPLOAD_LIMIT_MB;
const DEFAULT_MAX_VIDEO_UPLOAD_SIZE_MB = SERVER_ROUTED_UPLOAD_LIMIT_MB;
const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PRESIGNED_R2_UPLOAD_EXPIRES_SECONDS = 300;

export type UploadContext = "products" | "banners";

export type StoredUploadVariant = {
  kind: GeneratedMediaVariantKind;
  url: string;
  key: string;
  contentType: "image/webp";
  size: number;
  width: number;
  height: number;
};

export type StoredUpload = {
  url: string;
  key: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  variants?: StoredUploadVariant[];
};

const allowedMimeTypes = new Map([
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]],
  ["image/avif", ["avif"]],
  ["image/gif", ["gif"]],
  ["video/mp4", ["mp4"]],
]);

const bannerAllowedMimeTypes = new Set(allowedMimeTypes.keys());

const publicExtensionByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["video/mp4", "mp4"],
]);

function getConfiguredMaxMb(variable: string, fallback: number) {
  const maxMb = Number(process.env[variable] ?? fallback);
  const configuredMaxMb = Number.isFinite(maxMb) && maxMb > 0 ? Math.max(1, maxMb) : fallback;
  return Math.min(configuredMaxMb, SERVER_ROUTED_UPLOAD_LIMIT_MB);
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

export function validateUploadedImageMetadata(
  file: Pick<File, "name" | "type" | "size">,
  context: UploadContext = "products",
  options: { maxBytes?: number; maxMb?: number } = {},
) {
  if (context === "banners" && !bannerAllowedMimeTypes.has(file.type)) {
    throw new Error("Formato invalido para banner. Envie JPG, PNG, WEBP, AVIF, GIF ou MP4.");
  }

  const allowedExtensions = allowedMimeTypes.get(file.type);
  if (!allowedExtensions) {
    throw new Error("Formato invalido. Envie JPG, PNG, WEBP, AVIF, GIF ou MP4.");
  }

  const extension = getFileExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    throw new Error("Extensao do arquivo nao corresponde ao formato da midia.");
  }

  const maxBytes = options.maxBytes ?? getMaxUploadBytes(file.type);
  const maxMb = options.maxMb ?? getMaxUploadSizeMb(file.type);
  if (file.size > maxBytes) {
    throw new Error(`Arquivo maior que ${maxMb}MB.`);
  }

  const publicExtension = publicExtensionByMimeType.get(file.type);
  if (!publicExtension) {
    throw new Error("Formato invalido. Envie JPG, PNG, WEBP, AVIF, GIF ou MP4.");
  }

  return publicExtension;
}

export function validateDirectR2UploadMetadata(file: Pick<File, "name" | "type" | "size">, context: UploadContext = "products") {
  return validateUploadedImageMetadata(file, context, {
    maxBytes: DIRECT_R2_UPLOAD_LIMIT_BYTES,
    maxMb: DIRECT_R2_UPLOAD_LIMIT_MB,
  });
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

  if (extension === "avif") {
    return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"));
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

function buildObjectKeyBase(fileName: string, now = new Date(), context: UploadContext = "products") {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stem = sanitizeUploadFilenameStem(fileName);
  return `${context}/${year}/${month}/${randomUUID()}-${stem}`;
}

type SafeLocalObjectKey = {
  context: UploadContext;
  year: string;
  month: string;
  fileName: string;
  relativePath: string;
};

const localObjectKeyFileNamePattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png|webp|avif|gif|mp4)$/;

function isAbsoluteObjectKey(objectKey: string) {
  return path.isAbsolute(objectKey) || path.posix.isAbsolute(objectKey) || path.win32.isAbsolute(objectKey);
}

function assertSafeLocalObjectKeySegment(segment: string) {
  if (!segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
    throw new Error("Caminho de upload invalido.");
  }
}

function parseSafeLocalObjectKey(objectKey: string): SafeLocalObjectKey {
  const normalizedObjectKey = objectKey.replace(/\\/g, "/");

  if (!normalizedObjectKey || normalizedObjectKey.includes("\0") || isAbsoluteObjectKey(normalizedObjectKey)) {
    throw new Error("Caminho de upload invalido.");
  }

  const segments = normalizedObjectKey.split("/");
  if (segments.length !== 4) {
    throw new Error("Caminho de upload invalido.");
  }

  for (const segment of segments) {
    assertSafeLocalObjectKeySegment(segment);
  }

  const [context, year, month, fileName] = segments;
  if (context !== "products" && context !== "banners") {
    throw new Error("Caminho de upload invalido.");
  }

  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month) || !localObjectKeyFileNamePattern.test(fileName)) {
    throw new Error("Caminho de upload invalido.");
  }

  return {
    context,
    year,
    month,
    fileName,
    relativePath: `${context}/${year}/${month}/${fileName}`,
  };
}

export function resolveLocalStorageObjectPath(localStorageDir: string, objectKey: string) {
  const safeKey = parseSafeLocalObjectKey(objectKey);
  const storageDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), localStorageDir);
  const absolutePath = path.resolve(
    /*turbopackIgnore: true*/ storageDir,
    safeKey.context,
    safeKey.year,
    safeKey.month,
    safeKey.fileName,
  );
  const relativeFromStorageDir = path.relative(storageDir, absolutePath);

  if (
    !relativeFromStorageDir ||
    relativeFromStorageDir.startsWith("..") ||
    path.isAbsolute(relativeFromStorageDir) ||
    path.win32.isAbsolute(relativeFromStorageDir)
  ) {
    throw new Error("Caminho de upload invalido.");
  }

  return {
    absolutePath,
    directoryPath: path.dirname(absolutePath),
    relativePath: safeKey.relativePath,
    storageDir,
  };
}

function createR2Client(r2: ReturnType<typeof getR2StorageConfig>) {
  return new S3Client({
    region: "auto",
    endpoint: r2.endpoint,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  });
}

export async function createPresignedR2Upload(
  file: Pick<File, "name" | "type" | "size">,
  options: { context?: UploadContext; now?: Date } = {},
) {
  const context = options.context ?? "products";
  const extension = validateDirectR2UploadMetadata(file, context);

  if (getStorageDriver() !== "r2") {
    throw new Error("Upload direto para R2 indisponivel neste ambiente. Configure STORAGE_DRIVER=r2 para uploads de ate 100 MB.");
  }

  const r2 = getR2StorageConfig();
  const key = buildObjectKey(file.name, extension, options.now ?? new Date(), context);
  const client = createR2Client(r2);
  const command = new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ContentType: file.type,
    CacheControl: UPLOAD_CACHE_CONTROL,
    IfNoneMatch: "*",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGNED_R2_UPLOAD_EXPIRES_SECONDS });

  return {
    uploadUrl,
    publicUrl: `${r2.publicBaseUrl}/${key}`,
    key,
    contentType: file.type,
    size: file.size,
    expiresInSeconds: PRESIGNED_R2_UPLOAD_EXPIRES_SECONDS,
  };
}

export async function saveUploadedImage(file: File, options: { context?: UploadContext } = {}) {
  const context = options.context ?? "products";
  const extension = validateUploadedImageMetadata(file, context);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(bytes, extension)) {
    throw new Error("Arquivo de midia invalido.");
  }

  assertUploadStorageReady();
  const storageDriver = getStorageDriver();
  const r2 = storageDriver === "r2" ? getR2StorageConfig() : null;
  const r2Client = r2 ? createR2Client(r2) : null;

  async function persistObject(objectKey: string, objectBytes: Buffer, contentType: string) {
    if (r2 && r2Client) {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: objectKey,
          Body: objectBytes,
          ContentType: contentType,
          CacheControl: UPLOAD_CACHE_CONTROL,
          IfNoneMatch: "*",
        }),
      );

      return `${r2.publicBaseUrl}/${objectKey}`;
    }

    const localPath = resolveLocalStorageObjectPath(getStorageLocalDir(), objectKey);
    const publicPath = `${getStoragePublicBaseUrl()}/${localPath.relativePath}`;

    await mkdir(/*turbopackIgnore: true*/ localPath.directoryPath, { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ localPath.absolutePath, objectBytes);

    return publicPath;
  }

  const generatedVariants = STATIC_IMAGE_CONTENT_TYPES.has(file.type)
    ? await generateStaticImageVariants(bytes)
    : null;

  if (generatedVariants) {
    const baseObjectKey = buildObjectKeyBase(file.name, new Date(), context);
    const variants: StoredUploadVariant[] = [];

    for (const generatedVariant of generatedVariants.variants) {
      const variantKey = buildGeneratedMediaObjectKey(baseObjectKey, generatedVariant.kind, extension);
      const variantUrl = await persistObject(variantKey, generatedVariant.bytes, generatedVariant.contentType);
      variants.push({
        kind: generatedVariant.kind,
        url: variantUrl,
        key: variantKey,
        contentType: generatedVariant.contentType,
        size: generatedVariant.bytes.length,
        width: generatedVariant.width,
        height: generatedVariant.height,
      });
    }

    const originalKey = buildGeneratedMediaObjectKey(baseObjectKey, "original", extension);
    const originalUrl = await persistObject(originalKey, bytes, file.type);

    return {
      url: originalUrl,
      key: originalKey,
      contentType: file.type,
      size: bytes.length,
      width: generatedVariants.sourceWidth,
      height: generatedVariants.sourceHeight,
      variants,
    } satisfies StoredUpload;
  }

  const objectKey = buildObjectKey(file.name, extension, new Date(), context);
  const publicPath = await persistObject(objectKey, bytes, file.type);

  return {
    url: publicPath,
    key: objectKey,
    contentType: file.type,
    size: bytes.length,
  } satisfies StoredUpload;
}

const safePublicUploadErrorPatterns = [
  /^Contexto de upload invalido\.$/,
  /^Formato invalido/,
  /^Extensao do arquivo nao corresponde/,
  /^Arquivo maior que \d+MB\.$/,
  /^Arquivo de midia invalido\.$/,
  /^Arquivo de imagem estática inválido\.$/,
  /^Caminho de upload invalido\.$/,
  /^Upload direto para R2 indisponivel/,
  /^Upload local nao e permitido em producao/,
  /^Upload Cloudflare R2 incompleto/,
];

export function getPublicUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (safePublicUploadErrorPatterns.some((pattern) => pattern.test(message))) {
    return message;
  }

  return "Falha ao processar ou armazenar a mídia.";
}
