import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/uploads/presign/route";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
});

describe("retired admin upload presign route", () => {
  it("keeps the legacy endpoint closed without issuing a write URL", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      code: "DIRECT_UPLOAD_DISABLED",
      error: "Upload direto desativado. Use o upload validado do Admin.",
      uploadEndpoint: "/api/admin/uploads",
      maxBytes: 4 * 1024 * 1024,
    });
    expect(JSON.stringify(body)).not.toMatch(/uploadUrl|signature|secret/i);
  });

  it("requires authentication before returning the retirement response", async () => {
    routeMocks.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(POST()).rejects.toThrow("unauthorized");
  });

  it("does not allow a signed-in non-admin through the retired endpoint", async () => {
    routeMocks.requireAdmin.mockRejectedValueOnce(new Error("admin role required"));

    await expect(POST()).rejects.toThrow("admin role required");
  });
});
