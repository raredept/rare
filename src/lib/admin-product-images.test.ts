import { describe, expect, it } from "vitest";
import {
  abbreviateProductImageUrl,
  appendProductImageUrls,
  classifyProductImageUrl,
  clearProductImageUrls,
  getProductMediaLabel,
  getProductMediaTypeFromUrl,
  makeProductImagePrimary,
  moveProductImageUrl,
  normalizeProductImageUrls,
  removeProductImageUrl,
  resolveProductImageSubmission,
} from "@/lib/admin-product-images";

describe("admin product image helpers", () => {
  it("removes old image URLs from the submitted payload when replaceImages is active and a new upload exists", () => {
    const urls = resolveProductImageSubmission({
      existingImageUrls: ["/seed-products/bolsa-bag-supreme.svg", "/uploads/products/old.png"],
      uploadedUrls: ["https://media.rare.example/products/2026/05/new.webp"],
      replaceImages: true,
    });

    expect(urls).toEqual(["https://media.rare.example/products/2026/05/new.webp"]);
  });

  it("makes a replacement upload the principal image with sortOrder zero semantics", () => {
    const urls = resolveProductImageSubmission({
      existingImageUrls: ["/uploads/products/old-main.png"],
      uploadedUrls: ["/uploads/products/new-main.png", "/uploads/products/new-extra.png"],
      replaceImages: true,
    });

    expect(urls[0]).toBe("/uploads/products/new-main.png");
    expect(urls).not.toContain("/uploads/products/old-main.png");
  });

  it("keeps old images and appends upload URLs when replacement is disabled", () => {
    const urls = resolveProductImageSubmission({
      existingImageUrls: ["/uploads/products/current.png"],
      uploadedUrls: ["/uploads/products/extra.webp"],
      replaceImages: false,
    });

    expect(urls).toEqual(["/uploads/products/current.png", "/uploads/products/extra.webp"]);
  });

  it("clears, removes and promotes images without creating duplicates", () => {
    const current = ["/uploads/products/a.png", "/uploads/products/b.png", "/uploads/products/a.png"];

    expect(clearProductImageUrls()).toEqual([]);
    expect(removeProductImageUrl(current, "/uploads/products/a.png")).toEqual(["/uploads/products/b.png"]);
    expect(makeProductImagePrimary(current, "/uploads/products/b.png")).toEqual([
      "/uploads/products/b.png",
      "/uploads/products/a.png",
    ]);
  });

  it("moves media left and right while preserving sortOrder semantics", () => {
    const current = ["/uploads/products/a.png", "/uploads/products/b.gif", "/uploads/products/c.mp4"];

    expect(moveProductImageUrl(current, "/uploads/products/b.gif", "left")).toEqual([
      "/uploads/products/b.gif",
      "/uploads/products/a.png",
      "/uploads/products/c.mp4",
    ]);
    expect(moveProductImageUrl(current, "/uploads/products/b.gif", "right")).toEqual([
      "/uploads/products/a.png",
      "/uploads/products/c.mp4",
      "/uploads/products/b.gif",
    ]);
  });

  it("limits media payload to ten unique URLs", () => {
    const urls = Array.from({ length: 12 }, (_, index) => `/uploads/products/${index}.png`);

    expect(normalizeProductImageUrls([...urls, urls[0]])).toHaveLength(10);
    expect(appendProductImageUrls(urls.slice(0, 9), ["/uploads/products/extra.mp4", "/uploads/products/overflow.gif"])).toEqual([
      ...urls.slice(0, 9),
      "/uploads/products/extra.mp4",
    ]);
  });

  it("infers media type and labels from URLs", () => {
    expect(getProductMediaTypeFromUrl("/uploads/products/produto.jpg")).toBe("image");
    expect(getProductMediaTypeFromUrl("/uploads/products/produto.gif")).toBe("gif");
    expect(getProductMediaTypeFromUrl("https://media.rare.example/products/video.mp4?token=1")).toBe("video");
    expect(getProductMediaLabel("video")).toBe("Vídeo");
  });

  it("classifies admin image sources and abbreviates long URLs for display", () => {
    expect(classifyProductImageUrl("/seed-products/bag.svg")).toBe("Seed");
    expect(classifyProductImageUrl("/uploads/products/bag.png")).toBe("Local");
    expect(classifyProductImageUrl("https://media.rare.example/products/bag.webp")).toBe("R2");
    expect(abbreviateProductImageUrl("https://media.rare.example/products/2026/05/final-product-image.webp", 36)).toContain("...");
  });
});
