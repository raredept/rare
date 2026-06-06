import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/uploads/presign/route";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSignedUrl: vi.fn(),
  S3Client: vi.fn(function S3Client(config: unknown) {
    return { config };
  }),
  PutObjectCommand: vi.fn(function PutObjectCommand(input: unknown) {
    return { input };
  }),
}));

const originalEnv = process.env;

vi.mock("@/lib/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: routeMocks.S3Client,
  PutObjectCommand: routeMocks.PutObjectCommand,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: routeMocks.getSignedUrl,
}));

function buildPresignRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function configureR2Env() {
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "abc123",
    R2_BUCKET: "rare-media",
    R2_ACCESS_KEY_ID: "configured-access-key",
    R2_SECRET_ACCESS_KEY: "configured-secret-key-that-must-not-leak",
    R2_PUBLIC_BASE_URL: "https://media.rare.example",
    RATE_LIMIT_DRIVER: "memory",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configureR2Env();
  routeMocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  routeMocks.getSignedUrl.mockResolvedValue("https://r2.example/upload?signature=temporary");
});

afterEach(() => {
  process.env = originalEnv;
});

describe("admin upload presign route", () => {
  it("requires an admin session before generating presigned uploads", async () => {
    routeMocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));

    await expect(
      POST(
        buildPresignRequest({
          filename: "produto.webp",
          contentType: "image/webp",
          sizeBytes: 1024,
          uploadContext: "products",
        }) as never,
      ),
    ).rejects.toThrow("unauthorized");
    expect(routeMocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects invalid upload contexts and files above 100 MB", async () => {
    const invalidContext = await POST(
      buildPresignRequest({
        filename: "produto.webp",
        contentType: "image/webp",
        sizeBytes: 1024,
        uploadContext: "avatars",
      }) as never,
    );
    const oversized = await POST(
      buildPresignRequest({
        filename: "video.mp4",
        contentType: "video/mp4",
        sizeBytes: 100 * 1024 * 1024 + 1,
        uploadContext: "products",
      }) as never,
    );

    expect(invalidContext.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(routeMocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects SVG and MIME/extension mismatches", async () => {
    const svg = await POST(
      buildPresignRequest({
        filename: "icone.svg",
        contentType: "image/svg+xml",
        sizeBytes: 1024,
        uploadContext: "products",
      }) as never,
    );
    const mismatch = await POST(
      buildPresignRequest({
        filename: "produto.jpg",
        contentType: "image/png",
        sizeBytes: 1024,
        uploadContext: "products",
      }) as never,
    );
    const svgBody = await svg.json();
    const mismatchBody = await mismatch.json();

    expect(svg.status).toBe(400);
    expect(svgBody.error).toContain("Formato invalido");
    expect(mismatch.status).toBe(400);
    expect(mismatchBody.error).toContain("Extensao do arquivo nao corresponde");
    expect(routeMocks.getSignedUrl).not.toHaveBeenCalled();
  });

  it("generates product and banner keys without exposing R2 secrets", async () => {
    const productResponse = await POST(
      buildPresignRequest({
        filename: "Produto Novo.webp",
        contentType: "image/webp",
        sizeBytes: 1024,
        uploadContext: "products",
      }) as never,
    );
    const bannerResponse = await POST(
      buildPresignRequest({
        filename: "Campanha Home.jpg",
        contentType: "image/jpeg",
        sizeBytes: 2048,
        uploadContext: "banners",
      }) as never,
    );
    const productBody = await productResponse.json();
    const bannerText = await bannerResponse.text();
    const bannerBody = JSON.parse(bannerText);

    expect(productResponse.status).toBe(200);
    expect(productBody.upload.key).toMatch(/^products\/\d{4}\/\d{2}\/[a-f0-9-]+-produto-novo\.webp$/);
    expect(productBody.upload.publicUrl).toBe(`https://media.rare.example/${productBody.upload.key}`);
    expect(productBody.upload.variants).toBeUndefined();
    expect(bannerResponse.status).toBe(200);
    expect(bannerBody.upload.key).toMatch(/^banners\/\d{4}\/\d{2}\/[a-f0-9-]+-campanha-home\.jpg$/);
    expect(bannerText).not.toContain("configured-secret-key-that-must-not-leak");
    expect(routeMocks.getSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("returns a controlled fallback for local storage instead of accepting large files through the function", async () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
      STORAGE_DRIVER: "local",
    };

    const response = await POST(
      buildPresignRequest({
        filename: "produto.webp",
        contentType: "image/webp",
        sizeBytes: 1024,
        uploadContext: "products",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.fallback).toBe("server-routed");
    expect(body.maxBytes).toBe(4 * 1024 * 1024);
    expect(routeMocks.getSignedUrl).not.toHaveBeenCalled();
  });
});
