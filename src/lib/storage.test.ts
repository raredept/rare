import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildObjectKey,
  getMaxUploadBytes,
  hasValidImageSignature,
  saveUploadedImage,
  sanitizeUploadFilenameStem,
  validateUploadedImageMetadata,
} from "@/lib/storage";

const originalEnv = process.env;
const testStorageDir = path.join(process.cwd(), "output", "test-storage");

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const webpBytes = new Uint8Array(Buffer.from("RIFFxxxxWEBP", "ascii"));

beforeEach(() => {
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
    expect(getMaxUploadBytes()).toBe(5 * 1024 * 1024);
  });

  it("validates image signatures against their declared extension", () => {
    expect(hasValidImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png")).toBe(true);
    expect(hasValidImageSignature(Buffer.from("<svg></svg>"), "png")).toBe(false);
    expect(hasValidImageSignature(Buffer.from("RIFFxxxxWEBP"), "webp")).toBe(true);
  });

  it("accepts JPG, PNG and WEBP metadata", () => {
    expect(validateUploadedImageMetadata(new File([jpgBytes], "produto.jpeg", { type: "image/jpeg" }))).toBe("jpg");
    expect(validateUploadedImageMetadata(new File([pngBytes], "produto.png", { type: "image/png" }))).toBe("png");
    expect(validateUploadedImageMetadata(new File([webpBytes], "produto.webp", { type: "image/webp" }))).toBe("webp");
  });

  it("rejects SVG and MP4 metadata", () => {
    expect(() => validateUploadedImageMetadata(new File([Buffer.from("<svg></svg>")], "icone.svg", { type: "image/svg+xml" }))).toThrow(
      "Formato invalido",
    );
    expect(() => validateUploadedImageMetadata(new File([Buffer.from("mp4")], "video.mp4", { type: "video/mp4" }))).toThrow(
      "Formato invalido",
    );
  });

  it("rejects files above the configured per-image size", () => {
    process.env.MAX_UPLOAD_SIZE_MB = "1";
    const oversized = new File([new Uint8Array(1024 * 1024 + 1)], "grande.png", { type: "image/png" });

    expect(() => validateUploadedImageMetadata(oversized)).toThrow("Arquivo maior que 1MB.");
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
  });

  it("saves valid local uploads under the configured dev directory", async () => {
    const saved = await saveUploadedImage(new File([pngBytes], "produto local.png", { type: "image/png" }));

    expect(saved.url).toMatch(/^\/test-uploads\/products\/\d{4}\/\d{2}\/[a-f0-9-]+-produto-local\.png$/);
    expect(saved.contentType).toBe("image/png");
    expect(existsSync(path.join(testStorageDir, saved.key))).toBe(true);
  });

  it("normalizes JPEG uploads to a jpg object key", async () => {
    const saved = await saveUploadedImage(new File([jpgBytes], "foto-final.jpeg", { type: "image/jpeg" }));

    expect(saved.key).toMatch(/foto-final\.jpg$/);
  });
});
