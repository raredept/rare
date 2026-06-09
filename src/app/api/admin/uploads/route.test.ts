import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/uploads/route";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getMaxAcceptedUploadBytes: vi.fn(() => 30 * 1024 * 1024),
  normalizeUploadContext: vi.fn((value: FormDataEntryValue | null) => (value === "banners" ? "banners" : "products")),
  saveUploadedImage: vi.fn(),
  getPublicUploadErrorMessage: vi.fn(() => "Falha ao processar ou armazenar a mídia."),
}));

const originalEnv = process.env;

vi.mock("@/lib/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));

vi.mock("@/lib/storage", () => ({
  getMaxAcceptedUploadBytes: routeMocks.getMaxAcceptedUploadBytes,
  getPublicUploadErrorMessage: routeMocks.getPublicUploadErrorMessage,
  normalizeUploadContext: routeMocks.normalizeUploadContext,
  saveUploadedImage: routeMocks.saveUploadedImage,
}));

function buildUploadRequest(formData: FormData) {
  return new Request("http://localhost/api/admin/uploads", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv, RATE_LIMIT_DRIVER: "memory" };
  routeMocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  routeMocks.saveUploadedImage.mockResolvedValue({
    url: "/uploads/products/2026/05/file.png",
    key: "products/2026/05/file.png",
  });
});

afterEach(() => {
  process.env = originalEnv;
});

describe("admin uploads route", () => {
  it("requires an admin session before saving uploaded files", async () => {
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    const response = await POST(buildUploadRequest(formData) as never);
    const body = await response.json();

    expect(routeMocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(routeMocks.saveUploadedImage).toHaveBeenCalledWith(expect.any(File), { context: "products" });
    expect(response.status).toBe(200);
    expect(body.uploads).toEqual([{ url: "/uploads/products/2026/05/file.png", key: "products/2026/05/file.png" }]);
  });

  it("passes banner upload context to storage without changing product uploads", async () => {
    routeMocks.saveUploadedImage.mockResolvedValueOnce({
      url: "/uploads/banners/2026/05/file.webp",
      key: "banners/2026/05/file.webp",
    });
    const formData = new FormData();
    formData.set("uploadContext", "banners");
    formData.append("files", new File([new Uint8Array([1])], "banner.webp", { type: "image/webp" }));

    const response = await POST(buildUploadRequest(formData) as never);
    const body = await response.json();

    expect(routeMocks.normalizeUploadContext).toHaveBeenCalledWith("banners");
    expect(routeMocks.saveUploadedImage).toHaveBeenCalledWith(expect.any(File), { context: "banners" });
    expect(response.status).toBe(200);
    expect(body.uploads).toEqual([{ url: "/uploads/banners/2026/05/file.webp", key: "banners/2026/05/file.webp" }]);
  });

  it("returns generated variant metadata from the server-routed upload", async () => {
    routeMocks.saveUploadedImage.mockResolvedValueOnce({
      url: "/uploads/products/file-rare-v1-original.png",
      key: "products/2026/06/file-rare-v1-original.png",
      contentType: "image/png",
      size: 1000,
      width: 1600,
      height: 1200,
      variants: [
        {
          kind: "thumbnail",
          url: "/uploads/products/file-rare-v1-thumbnail.webp",
          key: "products/2026/06/file-rare-v1-thumbnail.webp",
          contentType: "image/webp",
          size: 200,
          width: 640,
          height: 480,
        },
        {
          kind: "medium",
          url: "/uploads/products/file-rare-v1-medium.webp",
          key: "products/2026/06/file-rare-v1-medium.webp",
          contentType: "image/webp",
          size: 500,
          width: 1200,
          height: 900,
        },
      ],
    });
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    const response = await POST(buildUploadRequest(formData) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.uploads[0].variants).toHaveLength(2);
    expect(body.uploads[0].variants[0]).toMatchObject({
      kind: "thumbnail",
      contentType: "image/webp",
      width: 640,
    });
  });

  it("does not save files when admin auth fails", async () => {
    routeMocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    await expect(POST(buildUploadRequest(formData) as never)).rejects.toThrow("unauthorized");
    expect(routeMocks.saveUploadedImage).not.toHaveBeenCalled();
  });

  it("returns a controlled 413 before parsing oversized server-routed upload payloads", async () => {
    const request = new Request("http://localhost/api/admin/uploads", {
      method: "POST",
      headers: { "content-length": String(41 * 1024 * 1024) },
      body: "oversized",
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("Upload acima de 4 MB");
    expect(routeMocks.saveUploadedImage).not.toHaveBeenCalled();
  });

  it("rejects server-side upload files above 4 MB before storage writes", async () => {
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array(4 * 1024 * 1024 + 1)], "grande.jpg", { type: "image/jpeg" }));

    const response = await POST(buildUploadRequest(formData) as never);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("Arquivo acima de 4 MB");
    expect(routeMocks.saveUploadedImage).not.toHaveBeenCalled();
  });

  it("does not expose internal processing or storage errors", async () => {
    routeMocks.saveUploadedImage.mockRejectedValueOnce(
      new Error("sharp failed with R2_SECRET_ACCESS_KEY=configured-secret-key"),
    );
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    const response = await POST(buildUploadRequest(formData) as never);
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("Falha ao processar ou armazenar");
    expect(text).not.toContain("configured-secret-key");
  });
});
