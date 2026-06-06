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
