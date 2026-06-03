import { describe, expect, it } from "vitest";
import { getPreferredProductCardMedia, getProductCardMediaPair, getProductMediaTypeFromUrl, isProductVideoUrl } from "@/lib/product-media";

describe("product media helpers", () => {
  it("infers media type from public URLs", () => {
    expect(getProductMediaTypeFromUrl("/uploads/products/a.jpg")).toBe("image");
    expect(getProductMediaTypeFromUrl("/uploads/products/a.webp")).toBe("image");
    expect(getProductMediaTypeFromUrl("/uploads/products/a.avif")).toBe("image");
    expect(getProductMediaTypeFromUrl("/uploads/products/a.gif")).toBe("gif");
    expect(getProductMediaTypeFromUrl("https://media.rare.example/products/a.mp4?cache=1")).toBe("video");
    expect(getProductMediaTypeFromUrl("/uploads/products/a.bin")).toBe("unknown");
  });

  it("prefers static images over GIF or video media for product cards", () => {
    const media = [
      { url: "/uploads/products/a.mp4" },
      { url: "/uploads/products/a.gif" },
      { url: "/uploads/products/a.webp" },
    ];

    expect(getPreferredProductCardMedia(media)?.url).toBe("/uploads/products/a.webp");
    expect(getPreferredProductCardMedia(media.slice(0, 2))?.url).toBe("/uploads/products/a.gif");
    expect(isProductVideoUrl(media[0].url)).toBe(true);
  });

  it("uses the second sorted image as hover media only when it is not a video", () => {
    expect(
      getProductCardMediaPair([
        { url: "/uploads/products/front.webp" },
        { url: "/uploads/products/back.webp" },
      ]),
    ).toEqual({
      primary: { url: "/uploads/products/front.webp" },
      hover: { url: "/uploads/products/back.webp" },
    });

    expect(
      getProductCardMediaPair([
        { url: "/uploads/products/front.webp" },
        { url: "/uploads/products/spin.gif" },
      ]).hover,
    ).toBeNull();
  });

  it("uses the next useful card image when sorted media includes video or duplicate URLs", () => {
    expect(
      getProductCardMediaPair([
        { url: "/uploads/products/spin.mp4" },
        { url: "/uploads/products/front.webp" },
        { url: "/uploads/products/back.webp" },
      ]),
    ).toEqual({
      primary: { url: "/uploads/products/front.webp" },
      hover: { url: "/uploads/products/back.webp" },
    });

    expect(
      getProductCardMediaPair([
        { url: "/uploads/products/front.webp" },
        { url: "/uploads/products/front.webp" },
        { url: "/uploads/products/back.webp" },
      ]).hover,
    ).toEqual({ url: "/uploads/products/back.webp" });
  });
});
