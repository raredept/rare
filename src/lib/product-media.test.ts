import { describe, expect, it } from "vitest";
import {
  buildProductImageSrcSet,
  getPreferredProductCardMedia,
  getProductCardMediaPair,
  getProductMediaRenderPlan,
  getProductMediaTypeFromUrl,
  isSafeProductOgImageUrl,
  isProductVideoUrl,
  isZoomableProductMediaUrl,
} from "@/lib/product-media";

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

  it("treats static images and GIFs as zoomable product media, but not videos", () => {
    expect(isZoomableProductMediaUrl("/uploads/products/front.jpg")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/front.jpeg")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/front.png")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/front.webp")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/front.avif")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/spin.gif")).toBe(true);
    expect(isZoomableProductMediaUrl("/uploads/products/fit.mp4")).toBe(false);
    expect(isZoomableProductMediaUrl("/uploads/products/file.bin")).toBe(false);
  });

  it("keeps OG images static, public and unsigned", () => {
    expect(isSafeProductOgImageUrl("/uploads/products/front.jpg")).toBe(true);
    expect(isSafeProductOgImageUrl("/uploads/products/front.jpeg")).toBe(true);
    expect(isSafeProductOgImageUrl("/uploads/products/front.png")).toBe(true);
    expect(isSafeProductOgImageUrl("/uploads/products/front.webp")).toBe(true);
    expect(isSafeProductOgImageUrl("/uploads/products/front.avif")).toBe(true);
    expect(isSafeProductOgImageUrl("/uploads/products/spin.gif")).toBe(false);
    expect(isSafeProductOgImageUrl("/uploads/products/fit.mp4")).toBe(false);
    expect(isSafeProductOgImageUrl("/uploads/products/front.webp?token=abc")).toBe(false);
    expect(isSafeProductOgImageUrl("/uploads/products/private/front.webp")).toBe(false);
    expect(isSafeProductOgImageUrl("/uploads/products/front-signed.webp")).toBe(false);
  });

  it("does not create a fake srcSet when no real variants exist", () => {
    const media = { url: "/uploads/products/front.png" };

    expect(buildProductImageSrcSet(media)).toBeUndefined();
    expect(getProductMediaRenderPlan(media, "card")).toMatchObject({
      src: "/uploads/products/front.png",
      srcSet: undefined,
      loading: "lazy",
      decoding: "async",
      fetchPriority: "auto",
    });
  });

  it("uses real responsive candidates for card and detail while preserving the original for zoom", () => {
    const media = {
      url: "/uploads/products/front-original.webp",
      variants: [
        { url: "/uploads/products/front-320.webp", width: 320, height: 400 },
        { url: "/uploads/products/front-640.webp", width: 640, height: 800 },
        { url: "/uploads/products/front-1200.webp", width: 1200, height: 1500 },
      ],
    };

    expect(buildProductImageSrcSet(media)).toBe(
      "/uploads/products/front-320.webp 320w, /uploads/products/front-640.webp 640w, /uploads/products/front-1200.webp 1200w",
    );
    expect(getProductMediaRenderPlan(media, "card")).toMatchObject({
      src: "/uploads/products/front-640.webp",
      width: 640,
      height: 800,
      loading: "lazy",
      fetchPriority: "auto",
    });
    expect(getProductMediaRenderPlan(media, "detail")).toMatchObject({
      src: "/uploads/products/front-1200.webp",
      width: 1200,
      height: 1500,
      loading: "eager",
      fetchPriority: "high",
    });
    expect(getProductMediaRenderPlan(media, "zoom")).toMatchObject({
      src: "/uploads/products/front-original.webp",
      srcSet: undefined,
      zoomable: true,
    });
  });

  it("infers persisted variants only for versioned server-routed upload URLs", () => {
    const generatedMedia = {
      url: "/uploads/products/2026/06/id-camiseta-rare-v1-original.png",
    };

    expect(getProductMediaRenderPlan(generatedMedia, "card")).toMatchObject({
      src: "/uploads/products/2026/06/id-camiseta-rare-v1-thumbnail.webp",
      width: 640,
    });
    expect(getProductMediaRenderPlan(generatedMedia, "detail")).toMatchObject({
      src: "/uploads/products/2026/06/id-camiseta-rare-v1-medium.webp",
      width: 1200,
    });
    expect(getProductMediaRenderPlan(generatedMedia, "zoom")).toMatchObject({
      src: generatedMedia.url,
      srcSet: undefined,
    });
    expect(buildProductImageSrcSet(generatedMedia)).toBe(
      "/uploads/products/2026/06/id-camiseta-rare-v1-thumbnail.webp 640w, /uploads/products/2026/06/id-camiseta-rare-v1-medium.webp 1200w",
    );

    const legacyMedia = { url: "/uploads/products/2026/06/id-camiseta.png" };
    expect(getProductMediaRenderPlan(legacyMedia, "card")).toMatchObject({
      src: legacyMedia.url,
      srcSet: undefined,
    });
  });

  it("deduplicates explicit and inferred responsive candidates", () => {
    const media = {
      url: "/uploads/products/2026/06/id-camiseta-rare-v1-original.png",
      variants: [
        {
          url: "/uploads/products/2026/06/id-camiseta-rare-v1-thumbnail.webp",
          width: 640,
        },
      ],
    };

    expect(buildProductImageSrcSet(media)).toBe(
      "/uploads/products/2026/06/id-camiseta-rare-v1-thumbnail.webp 640w, /uploads/products/2026/06/id-camiseta-rare-v1-medium.webp 1200w",
    );
  });

  it("keeps video in detail and banner contexts but blocks it from card, zoom and OG plans", () => {
    const video = { url: "/uploads/products/fit.mp4" };

    expect(getProductMediaRenderPlan(video, "detail").renderAs).toBe("video");
    expect(getProductMediaRenderPlan(video, "banner").renderAs).toBe("video");
    expect(getProductMediaRenderPlan(video, "card").renderAs).toBe("placeholder");
    expect(getProductMediaRenderPlan(video, "zoom").renderAs).toBe("placeholder");
    expect(getProductMediaRenderPlan(video, "og").renderAs).toBe("placeholder");
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
