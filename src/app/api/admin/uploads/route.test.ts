import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/uploads/route";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getMaxUploadBytes: vi.fn(() => 5 * 1024 * 1024),
  saveUploadedImage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));

vi.mock("@/lib/storage", () => ({
  getMaxUploadBytes: routeMocks.getMaxUploadBytes,
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
    expect(routeMocks.saveUploadedImage).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.uploads).toEqual([{ url: "/uploads/products/2026/05/file.png", key: "products/2026/05/file.png" }]);
  });

  it("does not save files when admin auth fails", async () => {
    routeMocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));
    const formData = new FormData();
    formData.append("files", new File([new Uint8Array([1])], "produto.png", { type: "image/png" }));

    await expect(POST(buildUploadRequest(formData) as never)).rejects.toThrow("unauthorized");
    expect(routeMocks.saveUploadedImage).not.toHaveBeenCalled();
  });
});
