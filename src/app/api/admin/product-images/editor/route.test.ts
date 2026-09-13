import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/admin/product-images/editor/route";
import { DEFAULT_IMAGE_FRAMING } from "@/lib/product-image-framing";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), prepare: vi.fn(), apply: vi.fn(), upload: vi.fn(), resolve: vi.fn(), read: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/product-image-editor", async (original) => ({ ...(await original<typeof import("@/lib/product-image-editor")>()), prepareProductImageEditor: mocks.prepare, applyProductImageFraming: mocks.apply, uploadProductImageForEditor: mocks.upload, resolveProductImageReference: mocks.resolve }));
vi.mock("@/lib/product-image-editor-storage", () => ({ readAuthorizedProductImage: mocks.read }));
vi.mock("@/lib/product-image-crop", async (original) => ({ ...(await original<typeof import("@/lib/product-image-crop")>()), createProductImagePreview: mocks.preview }));
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://rare.test/api/admin/product-images/editor", { method: "POST", headers: { "Content-Type": "application/json", host: "rare.test", origin: "https://rare.test", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: "admin1" }); mocks.limit.mockResolvedValue({ ok: true }); mocks.apply.mockResolvedValue({ url: "/new.webp" }); });
describe("admin image editor routes", () => {
  it("requires fully privileged Admin before preview or writes", async () => {
    mocks.auth.mockRejectedValue(new Error("admin-reset-required"));
    await expect(POST(request({}) as never)).rejects.toThrow("admin-reset-required");
    await expect(GET(new Request("https://rare.test/api/admin/product-images/editor?assetId=a") as never)).rejects.toThrow("admin-reset-required");
    expect(mocks.apply).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("rejects CSRF and excess requests before processing", async () => {
    expect((await POST(request({}, { origin: "https://evil.test" }) as never)).status).toBe(403);
    mocks.limit.mockResolvedValue({ ok: false });
    expect((await POST(request({}) as never)).status).toBe(429);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("rejects arbitrary URL input and malformed framing", async () => {
    for (const body of [{ action: "apply", reference: { url: "https://internal/secret" }, framing: DEFAULT_IMAGE_FRAMING }, { action: "apply", reference: { assetId: "a" }, framing: { ...DEFAULT_IMAGE_FRAMING, zoom: 999 } }]) {
      expect((await POST(request(body) as never)).status).toBe(400);
    }
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("bounds request bytes even without trustworthy Content-Length", async () => {
    expect((await POST(request({ extra: "a".repeat(5000) }) as never)).status).toBe(413);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("returns a replacement only after successful processing; hides internal errors", async () => {
    const body = { action: "apply", reference: { assetId: "a" }, framing: DEFAULT_IMAGE_FRAMING };
    expect((await POST(request(body) as never)).status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith("admin1", { assetId: "a" }, DEFAULT_IMAGE_FRAMING);
    mocks.apply.mockRejectedValue(new Error("r2 credentials secret"));
    const response = await POST(request(body) as never);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("preservada"); expect(text).not.toContain("secret");
  });
  it("preview is private and does not cache original bytes publicly", async () => {
    mocks.resolve.mockResolvedValue({ originalUrl: "/original.png" }); mocks.read.mockResolvedValue(Buffer.from("original")); mocks.preview.mockResolvedValue(Buffer.from("preview"));
    const result = await GET(new Request("https://rare.test/api/admin/product-images/editor?assetId=a") as never);
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).toBe("preview");
  });
});
