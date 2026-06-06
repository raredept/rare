import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildObjectKey,
  createPresignedR2Upload,
  getMaxAcceptedUploadBytes,
  getPublicUploadErrorMessage,
  getMaxUploadBytes,
  hasValidImageSignature,
  normalizeUploadContext,
  resolveLocalStorageObjectPath,
  saveUploadedImage,
  sanitizeUploadFilenameStem,
  validateDirectR2UploadMetadata,
  validateUploadedImageMetadata,
} from "@/lib/storage";

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
  S3Client: vi.fn(function S3Client(config: unknown) {
    return { config, send: s3Mocks.send };
  }),
  PutObjectCommand: vi.fn(function PutObjectCommand(input: unknown) {
    return { input };
  }),
}));

const presignerMocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: s3Mocks.S3Client,
  PutObjectCommand: s3Mocks.PutObjectCommand,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: presignerMocks.getSignedUrl,
}));

const originalEnv = process.env;
const testStorageDir = path.join(process.cwd(), "output", "test-storage");

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webpBytes = new Uint8Array(Buffer.from("RIFFxxxxWEBP", "ascii"));
const avifBytes = new Uint8Array(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]));
const gifBytes = new Uint8Array(Buffer.from("GIF89a", "ascii"));
const mp4Bytes = new Uint8Array(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]));

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

beforeEach(() => {
  vi.clearAllMocks();
  s3Mocks.send.mockResolvedValue({});
  presignerMocks.getSignedUrl.mockResolvedValue("https://r2.example/presigned-upload");
  process.env = {
    ...originalEnv,
    NODE_ENV: "development",
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: "output/test-storage",
    STORAGE_PUBLIC_BASE_URL: "/test-uploads",
    MAX_UPLOAD_SIZE_MB: "5",
  };
});

afterEach(async () => {
  process.env = originalEnv;
  await rm(testStorageDir, { recursive: true, force: true });
});

describe("storage helpers", () => {
  it("falls back to the safe upload limit when env is invalid", () => {
    process.env.MAX_UPLOAD_SIZE_MB = "not-a-number";
    expect(getMaxUploadBytes()).toBe(4 * 1024 * 1024);
    expect(getMaxAcceptedUploadBytes()).toBe(4 * 1024 * 1024);
  });

  it("keeps validation errors public and hides unexpected internal details", () => {
    expect(getPublicUploadErrorMessage(new Error("Arquivo de midia invalido."))).toBe("Arquivo de midia invalido.");
    expect(
      getPublicUploadErrorMessage(new Error("sharp failure R2_SECRET_ACCESS_KEY=configured-secret-key")),
    ).toBe("Falha ao processar ou armazenar a mídia.");
  });

  it("caps configured upload limits to the Vercel function payload-safe size", () => {
    process.env.VERCEL = "1";
    process.env.MAX_UPLOAD_SIZE_MB = "5";
    process.env.MAX_GIF_UPLOAD_SIZE_MB = "10";
    process.env.MAX_VIDEO_UPLOAD_SIZE_MB = "30";

    expect(getMaxUploadBytes()).toBe(4 * 1024 * 1024);
    expect(getMaxAcceptedUploadBytes()).toBe(4 * 1024 * 1024);
  });

  it("validates media signatures against their declared extension", () => {
    expect(hasValidImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png")).toBe(true);
    expect(hasValidImageSignature(Buffer.from("<svg></svg>"), "png")).toBe(false);
    expect(hasValidImageSignature(Buffer.from("RIFFxxxxWEBP"), "webp")).toBe(true);
    expect(hasValidImageSignature(Buffer.from(avifBytes), "avif")).toBe(true);
    expect(hasValidImageSignature(Buffer.from("GIF89a"), "gif")).toBe(true);
    expect(hasValidImageSignature(Buffer.from(mp4Bytes), "mp4")).toBe(true);
  });

  it("rejects static files that match the signature but cannot be decoded", async () => {
    await expect(
      saveUploadedImage(new File([pngBytes], "corrompido.png", { type: "image/png" })),
    ).rejects.toThrow("Arquivo de imagem estática inválido.");
  });

  it("accepts JPG, PNG, WEBP, AVIF, GIF and MP4 metadata", () => {
    expect(validateUploadedImageMetadata(new File([jpgBytes], "produto.jpeg", { type: "image/jpeg" }))).toBe("jpg");
    expect(validateUploadedImageMetadata(new File([pngBytes], "produto.png", { type: "image/png" }))).toBe("png");
    expect(validateUploadedImageMetadata(new File([webpBytes], "produto.webp", { type: "image/webp" }))).toBe("webp");
    expect(validateUploadedImageMetadata(new File([avifBytes], "produto.avif", { type: "image/avif" }))).toBe("avif");
    expect(validateUploadedImageMetadata(new File([gifBytes], "animado.gif", { type: "image/gif" }))).toBe("gif");
    expect(validateUploadedImageMetadata(new File([mp4Bytes], "video.mp4", { type: "video/mp4" }))).toBe("mp4");
  });

  it("accepts banner uploads for images, GIF and MP4 without reducing the upload limit", () => {
    expect(normalizeUploadContext("banners")).toBe("banners");
    expect(validateUploadedImageMetadata(new File([webpBytes], "banner.webp", { type: "image/webp" }), "banners")).toBe("webp");
    expect(validateUploadedImageMetadata(new File([avifBytes], "banner.avif", { type: "image/avif" }), "banners")).toBe("avif");
    expect(validateUploadedImageMetadata(new File([gifBytes], "banner.gif", { type: "image/gif" }), "banners")).toBe("gif");
    expect(validateUploadedImageMetadata(new File([mp4Bytes], "banner.mp4", { type: "video/mp4" }), "banners")).toBe("mp4");
    expect(getMaxUploadBytes("video/mp4")).toBe(4 * 1024 * 1024);
  });

  it("rejects SVG metadata", () => {
    expect(() => validateUploadedImageMetadata(new File([Buffer.from("<svg></svg>")], "icone.svg", { type: "image/svg+xml" }))).toThrow(
      "Formato invalido",
    );
  });

  it("rejects files above the configured per-image size", () => {
    process.env.MAX_UPLOAD_SIZE_MB = "1";
    const oversized = new File([new Uint8Array(1024 * 1024 + 1)], "grande.png", { type: "image/png" });

    expect(() => validateUploadedImageMetadata(oversized)).toThrow("Arquivo maior que 1MB.");
  });

  it("validates direct R2 uploads with the 100 MB hard limit", () => {
    const accepted = { name: "catalogo.mp4", type: "video/mp4", size: 100 * 1024 * 1024 };
    const oversized = { name: "grande.mp4", type: "video/mp4", size: 100 * 1024 * 1024 + 1 };

    expect(validateDirectR2UploadMetadata(accepted)).toBe("mp4");
    expect(() => validateDirectR2UploadMetadata(oversized)).toThrow("Arquivo maior que 100MB.");
  });

  it("uses larger safe limits for GIF and MP4", () => {
    process.env.MAX_GIF_UPLOAD_SIZE_MB = "2";
    process.env.MAX_VIDEO_UPLOAD_SIZE_MB = "3";

    const largeGif = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "animado.gif", { type: "image/gif" });
    const largeVideo = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "video.mp4", { type: "video/mp4" });

    expect(() => validateUploadedImageMetadata(largeGif)).toThrow("Arquivo maior que 2MB.");
    expect(() => validateUploadedImageMetadata(largeVideo)).toThrow("Arquivo maior que 3MB.");
  });

  it("rejects extension and MIME mismatches", () => {
    const mismatched = new File([pngBytes], "produto.jpg", { type: "image/png" });

    expect(() => validateUploadedImageMetadata(mismatched)).toThrow("Extensao do arquivo nao corresponde");
  });

  it("sanitizes uploaded filenames before creating object keys", () => {
    expect(sanitizeUploadFilenameStem("..\\Camiseta Ágil 01.png")).toBe("camiseta-agil-01");
    expect(buildObjectKey("../Camiseta Ágil 01.png", "png", new Date("2026-05-14T12:00:00Z"))).toMatch(
      /^products\/2026\/05\/[a-f0-9-]+-camiseta-agil-01\.png$/,
    );
    expect(buildObjectKey("../Campanha Home.webp", "webp", new Date("2026-05-14T12:00:00Z"), "banners")).toMatch(
      /^banners\/2026\/05\/[a-f0-9-]+-campanha-home\.webp$/,
    );
  });

  it("resolves valid local object keys under the configured storage directory", () => {
    const resolved = resolveLocalStorageObjectPath(
      "output/test-storage",
      "products/2026/05/00000000-0000-0000-0000-000000000000-produto-local.png",
    );

    expect(resolved.relativePath).toBe("products/2026/05/00000000-0000-0000-0000-000000000000-produto-local.png");
    expect(resolved.absolutePath).toBe(path.join(testStorageDir, resolved.relativePath));
    expect(resolved.directoryPath).toBe(path.join(testStorageDir, "products", "2026", "05"));
  });

  it("blocks traversal and absolute local object keys", () => {
    const unsafeKeys = [
      "../secret.png",
      "products/2026/05/../../secret.png",
      "products\\2026\\..\\secret.png",
      "/products/2026/05/00000000-0000-0000-0000-000000000000-produto.png",
      "C:\\tmp\\00000000-0000-0000-0000-000000000000-produto.png",
      "products/2026/13/00000000-0000-0000-0000-000000000000-produto.png",
    ];

    for (const unsafeKey of unsafeKeys) {
      expect(() => resolveLocalStorageObjectPath("output/test-storage", unsafeKey)).toThrow("Caminho de upload invalido.");
    }
  });

  it("saves valid local uploads under the configured dev directory", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    })
      .png()
      .toBuffer();
    const saved = await saveUploadedImage(new File([toArrayBuffer(source)], "produto local.png", { type: "image/png" }));

    expect(saved.url).toMatch(/^\/test-uploads\/products\/\d{4}\/\d{2}\/[a-f0-9-]+-produto-local\.png$/);
    expect(saved.contentType).toBe("image/png");
    expect(existsSync(path.join(testStorageDir, saved.key))).toBe(true);
  });

  it("stores original, thumbnail and medium files for an eligible static image", async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 4,
        background: { r: 20, g: 20, b: 20, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const saved = await saveUploadedImage(new File([toArrayBuffer(source)], "produto grande.png", { type: "image/png" }));

    expect(saved.key).toMatch(/produto-grande-rare-v1-original\.png$/);
    expect(saved).toMatchObject({
      contentType: "image/png",
      width: 1600,
      height: 1200,
      variants: [
        { kind: "thumbnail", contentType: "image/webp", width: 640, height: 480 },
        { kind: "medium", contentType: "image/webp", width: 1200, height: 900 },
      ],
    });
    expect(existsSync(path.join(testStorageDir, saved.key))).toBe(true);
    for (const variant of saved.variants ?? []) {
      expect(existsSync(path.join(testStorageDir, variant.key))).toBe(true);
    }
  });

  it("preserves GIF and MP4 uploads without trying to generate image variants", async () => {
    const savedGif = await saveUploadedImage(new File([gifBytes], "animado.gif", { type: "image/gif" }));
    const savedVideo = await saveUploadedImage(new File([mp4Bytes], "video.mp4", { type: "video/mp4" }));

    expect(savedGif.contentType).toBe("image/gif");
    expect(savedVideo.contentType).toBe("video/mp4");
    expect(savedGif.variants).toBeUndefined();
    expect(savedVideo.variants).toBeUndefined();
    expect(savedGif.key).not.toContain("rare-v1-original");
    expect(savedVideo.key).not.toContain("rare-v1-original");
  });

  it("normalizes JPEG uploads to a jpg object key", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 30, g: 30, b: 30 },
      },
    })
      .jpeg()
      .toBuffer();
    const saved = await saveUploadedImage(new File([toArrayBuffer(source)], "foto-final.jpeg", { type: "image/jpeg" }));

    expect(saved.key).toMatch(/foto-final\.jpg$/);
  });

  it("blocks local upload storage in production by default", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      STORAGE_DRIVER: "local",
      ALLOW_LOCAL_STORAGE_IN_PRODUCTION: "false",
    };

    await expect(saveUploadedImage(new File([pngBytes], "produto.png", { type: "image/png" }))).rejects.toThrow(
      "Upload local nao e permitido em producao",
    );
    expect(s3Mocks.S3Client).not.toHaveBeenCalled();
  });

  it("requires complete R2 env vars before sending an upload", async () => {
    process.env.STORAGE_DRIVER = "r2";
    process.env.R2_ACCOUNT_ID = "configured-account-id";
    process.env.R2_BUCKET = "";
    process.env.R2_ACCESS_KEY_ID = "configured-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "";
    process.env.R2_PUBLIC_BASE_URL = "https://media.rare.example";

    await expect(saveUploadedImage(new File([pngBytes], "produto.png", { type: "image/png" }))).rejects.toThrow(
      "Upload Cloudflare R2 incompleto",
    );
    expect(s3Mocks.S3Client).not.toHaveBeenCalled();
  });

  it("stores valid R2 uploads with the configured public URL and media metadata", async () => {
    process.env.STORAGE_DRIVER = "r2";
    process.env.R2_ACCOUNT_ID = "abc123";
    process.env.R2_BUCKET = "rare-media";
    process.env.R2_ACCESS_KEY_ID = "configured-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "configured-secret-key";
    process.env.R2_PUBLIC_BASE_URL = "https://media.rare.example/";

    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .webp()
      .toBuffer();
    const saved = await saveUploadedImage(new File([toArrayBuffer(source)], "produto.webp", { type: "image/webp" }));
    const command = s3Mocks.PutObjectCommand.mock.calls[0]?.[0] as { Bucket: string; Key: string; ContentType: string; IfNoneMatch: string };

    expect(saved.url).toBe(`https://media.rare.example/${saved.key}`);
    expect(JSON.stringify(saved)).not.toContain("configured-secret-key");
    expect(s3Mocks.S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://abc123.r2.cloudflarestorage.com",
      }),
    );
    expect(command).toMatchObject({
      Bucket: "rare-media",
      Key: saved.key,
      ContentType: "image/webp",
      IfNoneMatch: "*",
    });
    expect(s3Mocks.send).toHaveBeenCalledTimes(1);
  });

  it("stores generated R2 variants with immutable cache and correct content types without real network calls", async () => {
    process.env.STORAGE_DRIVER = "r2";
    process.env.R2_ACCOUNT_ID = "abc123";
    process.env.R2_BUCKET = "rare-media";
    process.env.R2_ACCESS_KEY_ID = "configured-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "configured-secret-key";
    process.env.R2_PUBLIC_BASE_URL = "https://media.rare.example/";
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 4,
        background: { r: 30, g: 30, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const saved = await saveUploadedImage(new File([toArrayBuffer(source)], "produto.png", { type: "image/png" }));
    const commands = s3Mocks.PutObjectCommand.mock.calls.map((call) => call[0] as {
      Key: string;
      ContentType: string;
      CacheControl: string;
    });

    expect(s3Mocks.send).toHaveBeenCalledTimes(3);
    expect(commands.map((command) => command.ContentType)).toEqual(["image/webp", "image/webp", "image/png"]);
    expect(commands.every((command) => command.CacheControl === "public, max-age=31536000, immutable")).toBe(true);
    expect(saved.variants).toHaveLength(2);
    expect(JSON.stringify(saved)).not.toContain("configured-secret-key");
  });

  it("creates short-lived presigned R2 PUT uploads without reading file bytes", async () => {
    process.env.STORAGE_DRIVER = "r2";
    process.env.R2_ACCOUNT_ID = "abc123";
    process.env.R2_BUCKET = "rare-media";
    process.env.R2_ACCESS_KEY_ID = "configured-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "configured-secret-key";
    process.env.R2_PUBLIC_BASE_URL = "https://media.rare.example/";

    const upload = await createPresignedR2Upload(
      { name: "Banner Home.webp", type: "image/webp", size: 42 },
      { context: "banners", now: new Date("2026-05-14T12:00:00Z") },
    );
    const command = s3Mocks.PutObjectCommand.mock.calls[0]?.[0] as { Bucket: string; Key: string; ContentType: string; IfNoneMatch: string };

    expect(upload.uploadUrl).toBe("https://r2.example/presigned-upload");
    expect(upload.publicUrl).toBe(`https://media.rare.example/${upload.key}`);
    expect(upload.key).toMatch(/^banners\/2026\/05\/[a-f0-9-]+-banner-home\.webp$/);
    expect(upload.expiresInSeconds).toBe(300);
    expect(command).toMatchObject({
      Bucket: "rare-media",
      Key: upload.key,
      ContentType: "image/webp",
      IfNoneMatch: "*",
    });
    expect(presignerMocks.getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
  });
});
