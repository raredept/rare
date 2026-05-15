import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/uploads/route";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getMaxAcceptedUploadBytes: vi.fn(() => 30 * 1024 * 1024),
  normalizeUploadContext: vi.fn((value: FormDataEntryValue | null) => (value === "banners" ? "banners" : "products")),
  saveUploadedImage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));

vi.mock("@/lib/storage", () => ({
  getMaxAcceptedUploadBytes: routeMocks.getMaxAcceptedUploadBytes,
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
  routeMocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  routeMocks.saveUploadedImage.mockResolvedValue({
    url: "/uploads/products/2026/05/file.png",
    key: "products/2026/05/file.png",
  });
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

  it("does not save files when admin auth fails", async () => {
    routeMocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    await expect(POST(buildUploadRequest(formData) as never)).rejects.toThrow("unauthorized");
    expect(routeMocks.saveUploadedImage).not.toHaveBeenCalled();
  });
});
