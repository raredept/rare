import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateStaticImageVariants } from "@/lib/image-variants";

describe("image variant generation", () => {
  it("generates WEBP thumbnail and medium variants without enlarging the original", async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 4,
        background: { r: 15, g: 15, b: 15, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const generated = await generateStaticImageVariants(source);

    expect(generated).toMatchObject({
      sourceWidth: 1600,
      sourceHeight: 1200,
      variants: [
        { kind: "thumbnail", contentType: "image/webp", width: 640, height: 480 },
        { kind: "medium", contentType: "image/webp", width: 1200, height: 900 },
      ],
    });
    expect(generated?.variants.every((variant) => variant.bytes.length < source.length)).toBe(true);
  });

  it.each(["jpeg", "webp"] as const)("generates variants from valid %s input", async (format) => {
    const pipeline = sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 25, g: 35, b: 45 },
      },
    });
    const source = format === "jpeg" ? await pipeline.jpeg().toBuffer() : await pipeline.webp().toBuffer();

    const generated = await generateStaticImageVariants(source);

    expect(generated).toMatchObject({
      sourceWidth: 1600,
      sourceHeight: 1200,
      variants: [
        { kind: "thumbnail", contentType: "image/webp", width: 640, height: 480 },
        { kind: "medium", contentType: "image/webp", width: 1200, height: 900 },
      ],
    });
  });

  it("applies EXIF orientation and strips metadata from generated variants", async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 45, g: 35, b: 25 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect((await sharp(source).metadata()).orientation).toBe(6);

    const generated = await generateStaticImageVariants(source);

    expect(generated).toMatchObject({
      sourceWidth: 1200,
      sourceHeight: 1600,
      variants: [
        { kind: "thumbnail", width: 640, height: 853 },
        { kind: "medium", width: 1200, height: 1600 },
      ],
    });

    for (const variant of generated?.variants ?? []) {
      const metadata = await sharp(variant.bytes).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.exif).toBeUndefined();
    }
  });

  it("rejects images above the configured pixel limit before decoding them", async () => {
    const excessiveDimensions = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"><rect width="1" height="1"/></svg>',
    );

    await expect(generateStaticImageVariants(excessiveDimensions)).rejects.toThrow(
      "Arquivo de imagem estática inválido.",
    );
  });

  it("rejects a truncated small image even when its dimensions can be read", async () => {
    const source = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    }).png().toBuffer();
    const truncated = source.subarray(0, Math.floor(source.length / 2));

    await expect(sharp(truncated).metadata()).resolves.toMatchObject({ width: 800, height: 600 });
    await expect(generateStaticImageVariants(truncated)).rejects.toThrow(
      "Arquivo de imagem estática inválido.",
    );
  });

  it("skips small images and rejects invalid image data with a controlled error", async () => {
    const smallSource = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    await expect(generateStaticImageVariants(smallSource)).resolves.toBeNull();
    await expect(generateStaticImageVariants(Buffer.from("not-an-image"))).rejects.toThrow(
      "Arquivo de imagem estática inválido.",
    );
  });
});
