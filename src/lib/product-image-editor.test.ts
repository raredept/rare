import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_IMAGE_FRAMING } from "@/lib/product-image-framing";
import { applyProductImageFraming, prepareProductImageEditor, resolveProductImageReference, uploadProductImageForEditor } from "@/lib/product-image-editor";

const mocks = vi.hoisted(() => ({ assetFind: vi.fn(), assetCreate: vi.fn(), imageFind: vi.fn(), read: vi.fn(), inspect: vi.fn(), render: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { productMediaAsset: { findUnique: mocks.assetFind, create: mocks.assetCreate }, productImage: { findUnique: mocks.imageFind } } }));
vi.mock("@/lib/storage", () => ({ saveUploadedImage: mocks.save, validateUploadedImageMetadata: vi.fn() }));
vi.mock("@/lib/product-image-editor-storage", () => ({ readAuthorizedProductImage: mocks.read }));
vi.mock("@/lib/product-image-crop", async (original) => ({ ...(await original<typeof import("@/lib/product-image-crop")>()), inspectProductImage: mocks.inspect, renderProductImageFraming: mocks.render }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assetFind.mockResolvedValue({ id: "asset1", url: "/current.webp", originalUrl: "/original.png", createdByAdminId: "admin1", framing: { ...DEFAULT_IMAGE_FRAMING, x: 0.2 } });
  mocks.imageFind.mockResolvedValue({ url: "/current.webp" });
  mocks.read.mockResolvedValue(Buffer.from("original bytes"));
  mocks.inspect.mockResolvedValue({ width: 2000, height: 3000, editable: true });
  mocks.render.mockResolvedValue({ bytes: Buffer.from("rendered"), source: { width: 2000, height: 3000 }, framing: DEFAULT_IMAGE_FRAMING });
  mocks.save.mockResolvedValue({ url: "/new.webp" });
  mocks.assetCreate.mockImplementation(async ({ data }) => ({ id: "newAsset", ...data }));
});

describe("authorized immutable product image editing", () => {
  it("restores saved framing and always reads the original, including after reload", async () => {
    const result = await prepareProductImageEditor("admin1", { productImageId: "image1" });
    expect(result.framing.x).toBe(0.2);
    expect(mocks.read).toHaveBeenCalledWith("/original.png");
    expect(mocks.assetFind).toHaveBeenCalledWith({ where: { url: "/current.webp" } });
  });
  it("cannot edit another Admin's unattached upload, a missing image or an arbitrary URL/path", async () => {
    await expect(resolveProductImageReference("admin2", { assetId: "asset1" })).rejects.toThrow("não autorizada");
    mocks.imageFind.mockResolvedValue(null);
    await expect(resolveProductImageReference("admin1", { productImageId: "missing" })).rejects.toThrow("não encontrada");
    for (const input of [{ url: "https://internal.test/secret" }, { path: "../secret" }, { assetId: "asset1", url: "/unsafe" }, { assetId: "../secret" }]) {
      await expect(resolveProductImageReference("admin1", input)).rejects.toThrow();
    }
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("lets a fully authorized Admin reframe an attached product image from another Admin", async () => {
    await expect(resolveProductImageReference("admin2", { productImageId: "image1" })).resolves.toMatchObject({ originalUrl: "/original.png" });
  });
  it("repeated edits create immutable assets from the same original, never the prior derivative", async () => {
    const first = await applyProductImageFraming("admin1", { assetId: "asset1" }, DEFAULT_IMAGE_FRAMING);
    mocks.assetFind.mockResolvedValue({ id: "newAsset", url: first.url, originalUrl: "/original.png", createdByAdminId: "admin1", framing: DEFAULT_IMAGE_FRAMING });
    await applyProductImageFraming("admin1", first.reference, { ...DEFAULT_IMAGE_FRAMING, zoom: 2 });
    expect(mocks.read.mock.calls).toEqual([["/original.png"], ["/original.png"]]);
    expect(mocks.assetCreate).toHaveBeenCalledTimes(2);
    expect(mocks.assetCreate).toHaveBeenLastCalledWith({ data: expect.objectContaining({ originalUrl: "/original.png", framing: { ...DEFAULT_IMAGE_FRAMING, zoom: 2 } }) });
  });
  it("storage failure never creates a replacement record; DB failure returns no successful replacement", async () => {
    mocks.save.mockRejectedValueOnce(new Error("R2 failure"));
    await expect(applyProductImageFraming("admin1", { assetId: "asset1" }, DEFAULT_IMAGE_FRAMING)).rejects.toThrow("R2 failure");
    expect(mocks.assetCreate).not.toHaveBeenCalled();
    mocks.assetCreate.mockRejectedValueOnce(new Error("DB failure"));
    await expect(applyProductImageFraming("admin1", { assetId: "asset1" }, DEFAULT_IMAGE_FRAMING)).rejects.toThrow("DB failure");
  });
  it("uploads persist the untouched source and a DB-owned reference only after storage succeeds", async () => {
    const result = await uploadProductImageForEditor("admin1", new File(["original"], "photo.png", { type: "image/png" }));
    expect(result.reference).toEqual({ assetId: "newAsset" });
    expect(mocks.assetCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ url: "/new.webp", originalUrl: "/new.webp", createdByAdminId: "admin1" }) });
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.assetCreate.mock.invocationCallOrder[0]);
  });
});
