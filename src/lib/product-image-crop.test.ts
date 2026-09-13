import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createProductImagePreview, inspectProductImage, renderProductImageFraming } from "@/lib/product-image-crop";
import { DEFAULT_IMAGE_FRAMING, getImageFrameLayout, imageFramingSchema } from "@/lib/product-image-framing";

async function fixture(width = 240, height = 120) {
  return sharp({ create: { width, height, channels: 4, background: "red" } }).composite([
    { input: await sharp({ create: { width: width / 2, height, channels: 4, background: "blue" } }).png().toBuffer(), left: width / 2, top: 0 },
  ]).png().toBuffer();
}

describe("product image framing (real Sharp)", () => {
  it("uses the same 4:5 geometry for horizontal, vertical and square inputs", () => {
    for (const [width, height] of [[240, 120], [120, 240], [240, 240]]) {
      const cover = getImageFrameLayout(width, height, DEFAULT_IMAGE_FRAMING);
      const contain = getImageFrameLayout(width, height, { ...DEFAULT_IMAGE_FRAMING, mode: "contain" });
      expect(cover.width).toBeGreaterThanOrEqual(1600);
      expect(cover.height).toBeGreaterThanOrEqual(2000);
      expect(contain.width).toBeLessThanOrEqual(1600 + 1e-9);
      expect(contain.height).toBeLessThanOrEqual(2000 + 1e-9);
      expect(contain.width / contain.height).toBeCloseTo(width / height);
    }
  });

  it("repositions a real crop without stretching, with a deterministic 1600x2000 output", async () => {
    const source = await fixture();
    for (const x of [0, 1]) {
      const { bytes } = await renderProductImageFraming(source, { ...DEFAULT_IMAGE_FRAMING, x });
      const metadata = await sharp(bytes).metadata();
      expect([metadata.width, metadata.height]).toEqual([1600, 2000]);
      const pixel = await sharp(bytes).extract({ left: 800, top: 1000, width: 1, height: 1 }).raw().toBuffer();
      expect(pixel[x === 0 ? 0 : 2]).toBeGreaterThan(240);
      expect(pixel[x === 0 ? 2 : 0]).toBeLessThan(15);
    }
  });

  it("contain preserves the entire product and transparent padding", async () => {
    const { bytes } = await renderProductImageFraming(await fixture(), { ...DEFAULT_IMAGE_FRAMING, mode: "contain" });
    const pixel = async (left: number, top: number) => sharp(bytes).extract({ left, top, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
    expect((await pixel(800, 10))[3]).toBe(0);
    expect((await pixel(10, 1000))[0]).toBeGreaterThan(240);
    expect((await pixel(1590, 1000))[2]).toBeGreaterThan(240);
  });

  it("uses EXIF-oriented dimensions consistently in preview and rendered crop", async () => {
    const exif = await sharp(await fixture()).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect(await inspectProductImage(exif)).toMatchObject({ width: 120, height: 240, editable: true });
    const preview = await sharp(await createProductImagePreview(exif)).metadata();
    expect(preview.width! / preview.height!).toBe(0.5);
    const { bytes } = await renderProductImageFraming(exif, { ...DEFAULT_IMAGE_FRAMING, y: 0 });
    const metadata = await sharp(bytes).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect([metadata.width, metadata.height]).toEqual([1600, 2000]);
  });

  it("rejects animation explicitly, preserving the source bytes", async () => {
    const gif = await sharp({ create: { width: 20, height: 40, channels: 4, background: "red" } }).gif().toBuffer();
    const original = Buffer.from(gif);
    expect((await inspectProductImage(gif)).editable).toBe(false);
    await expect(renderProductImageFraming(gif, DEFAULT_IMAGE_FRAMING)).rejects.toThrow("animações");
    expect(gif.equals(original)).toBe(true);
    const redFrame = Buffer.alloc(20 * 20 * 3); const blueFrame = Buffer.alloc(20 * 20 * 3);
    for (let i = 0; i < redFrame.length; i += 3) { redFrame[i] = 255; blueFrame[i + 2] = 255; }
    const animatedWebp = await sharp(Buffer.concat([redFrame, blueFrame]), { raw: { width: 20, height: 40, pageHeight: 20, channels: 3 } }).webp({ delay: [100, 100] }).toBuffer();
    expect((await sharp(animatedWebp).metadata()).pages).toBe(2);
    expect((await inspectProductImage(animatedWebp)).editable).toBe(false);
    await expect(renderProductImageFraming(animatedWebp, DEFAULT_IMAGE_FRAMING)).rejects.toThrow("animações");
  });

  it("rejects corrupt content, untrusted dimensions, invalid zoom, coordinates and extra properties", async () => {
    await expect(inspectProductImage(Buffer.from("not an image"))).rejects.toThrow("Imagem inválida");
    expect(() => getImageFrameLayout(40_000_001, 1, DEFAULT_IMAGE_FRAMING)).toThrow();
    for (const patch of [{ zoom: 0.99 }, { zoom: 3.01 }, { x: -1 }, { y: 2 }, { x: NaN }, { path: "/etc/passwd" }, { width: 42 }]) {
      expect(imageFramingSchema.safeParse({ ...DEFAULT_IMAGE_FRAMING, ...patch }).success).toBe(false);
    }
    expect(imageFramingSchema.safeParse({ ...DEFAULT_IMAGE_FRAMING, mode: "contain", zoom: 1.01 }).success).toBe(false);
  });
});
