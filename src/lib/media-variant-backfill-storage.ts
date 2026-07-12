import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  getR2StorageConfig,
  getStorageDriver,
  getStorageLocalDir,
  getStoragePublicBaseUrl,
} from "@/lib/env";
import type { MediaBackfillStorage } from "@/lib/media-variant-backfill";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function getObjectKeyFromPublicUrl(value: string, publicBaseUrl: string) {
  const publicBase = new URL(publicBaseUrl, "https://rare.local");
  const candidate = new URL(value, "https://rare.local");

  if (publicBase.origin !== "https://rare.local" && candidate.origin !== publicBase.origin) {
    throw new Error("media-url-outside-configured-storage");
  }

  const basePath = publicBase.pathname.replace(/\/$/, "");
  if (candidate.pathname !== basePath && !candidate.pathname.startsWith(`${basePath}/`)) {
    throw new Error("media-url-outside-configured-storage");
  }

  const encodedKey = candidate.pathname.slice(basePath.length).replace(/^\//, "");
  if (!encodedKey || /%2f|%5c/i.test(encodedKey)) throw new Error("invalid-media-object-key");

  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    throw new Error("invalid-media-object-key");
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\") || segment.includes("\0"))) {
    throw new Error("invalid-media-object-key");
  }

  return key;
}

function resolveLocalObjectPath(root: string, key: string) {
  const storageRoot = path.resolve(process.cwd(), root);
  const objectPath = path.resolve(storageRoot, ...key.split("/"));
  const relative = path.relative(storageRoot, objectPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("invalid-media-object-key");
  }
  return objectPath;
}

function isMissingObjectError(error: unknown) {
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const name = (error as { name?: string })?.name;
  return status === 404 || name === "NotFound" || name === "NoSuchKey";
}

function isPreconditionError(error: unknown) {
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const name = (error as { name?: string })?.name;
  return status === 409 || status === 412 || name === "PreconditionFailed";
}

export function createConfiguredMediaBackfillStorage(): MediaBackfillStorage {
  const driver = getStorageDriver();

  if (driver === "r2") {
    const config = getR2StorageConfig();
    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    const keyFor = (url: string) => getObjectKeyFromPublicUrl(url, config.publicBaseUrl);

    return {
      async exists(url) {
        try {
          await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: keyFor(url) }));
          return true;
        } catch (error) {
          if (isMissingObjectError(error)) return false;
          throw error;
        }
      },
      async read(url, maxBytes) {
        const key = keyFor(url);
        const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        if (typeof head.ContentLength === "number" && head.ContentLength > maxBytes) {
          throw new Error("source-exceeds-configured-size-limit");
        }
        const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!response.Body) throw new Error("source-object-body-missing");
        const bytes = Buffer.from(await response.Body.transformToByteArray());
        if (bytes.length > maxBytes) throw new Error("source-exceeds-configured-size-limit");
        return bytes;
      },
      async putIfAbsent(url, bytes, contentType) {
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: keyFor(url),
              Body: bytes,
              ContentType: contentType,
              CacheControl: IMMUTABLE_CACHE_CONTROL,
              IfNoneMatch: "*",
            }),
          );
          return "created";
        } catch (error) {
          if (isPreconditionError(error)) return "exists";
          throw error;
        }
      },
    };
  }

  const localRoot = getStorageLocalDir();
  const publicBaseUrl = getStoragePublicBaseUrl();
  const pathFor = (url: string) => resolveLocalObjectPath(localRoot, getObjectKeyFromPublicUrl(url, publicBaseUrl));

  return {
    async exists(url) {
      try {
        await access(pathFor(url));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return false;
        throw error;
      }
    },
    async read(url, maxBytes) {
      const objectPath = pathFor(url);
      const metadata = await stat(objectPath);
      if (metadata.size > maxBytes) throw new Error("source-exceeds-configured-size-limit");
      return readFile(objectPath);
    },
    async putIfAbsent(url, bytes) {
      const objectPath = pathFor(url);
      await mkdir(path.dirname(objectPath), { recursive: true });
      try {
        await writeFile(objectPath, bytes, { flag: "wx" });
        return "created";
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "EEXIST") return "exists";
        throw error;
      }
    },
  };
}
