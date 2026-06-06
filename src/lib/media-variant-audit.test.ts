import { describe, expect, it } from "vitest";
import {
  buildBannerMediaVariantAuditEntries,
  buildMediaVariantAuditReport,
  buildProductMediaVariantAuditEntries,
  maskMediaUrl,
} from "@/lib/media-variant-audit";

describe("media variant audit", () => {
  it("classifies versioned original media as complete with generated variants", () => {
    const report = buildMediaVariantAuditReport([
      {
        source: "product",
        field: "product-image",
        ownerId: "prod-complete",
        ownerTitle: "Produto completo",
        ownerActive: true,
        url: "https://media.rare.example/products/photo-rare-v1-original.jpg",
        usages: ["card", "detail", "zoom", "og"],
      },
    ]);

    expect(report.items[0]).toEqual(
      expect.objectContaining({
        status: "complete",
        hasVariants: true,
        candidateForManualReupload: false,
      }),
    );
    expect(report.summary.totalWithVariants).toBe(1);
  });

  it("classifies old static media without variants as legacy", () => {
    const report = buildMediaVariantAuditReport([
      {
        source: "product",
        field: "product-image",
        ownerId: "prod-legacy",
        ownerTitle: "Produto legado",
        ownerActive: false,
        url: "https://media.rare.example/products/legacy.webp",
        usages: ["detail", "zoom"],
      },
    ]);

    expect(report.items[0]).toEqual(expect.objectContaining({ status: "legacy", hasVariants: false }));
    expect(report.summary.totalWithoutVariants).toBe(1);
  });

  it("marks PNG and JPEG media without variants as manual reupload candidates", () => {
    const report = buildMediaVariantAuditReport([
      {
        source: "product",
        field: "product-image",
        ownerId: "prod-png",
        ownerTitle: "Produto PNG",
        ownerActive: true,
        url: "https://media.rare.example/products/heavy.png",
        knownSizeBytes: 2_500_000,
        usages: ["card", "detail", "zoom", "og"],
      },
      {
        source: "banner",
        field: "banner-desktop",
        ownerId: "banner-jpeg",
        ownerTitle: "Banner JPEG",
        ownerActive: true,
        url: "https://media.rare.example/banners/drop.jpeg",
        usages: ["banner"],
      },
    ]);

    expect(report.reuploadCandidates).toHaveLength(2);
    expect(report.reuploadCandidates[0]).toEqual(
      expect.objectContaining({
        candidateForManualReupload: true,
        largeOriginal: true,
      }),
    );
  });

  it("preserves GIF and MP4 originals instead of marking them for automatic processing", () => {
    const report = buildMediaVariantAuditReport([
      {
        source: "product",
        field: "product-image",
        ownerId: "prod-gif",
        ownerTitle: "Produto GIF",
        ownerActive: true,
        url: "https://media.rare.example/products/animation.gif",
        usages: ["card", "detail", "zoom"],
      },
      {
        source: "product",
        field: "product-image",
        ownerId: "prod-video",
        ownerTitle: "Produto Video",
        ownerActive: true,
        url: "https://media.rare.example/products/video.mp4",
        usages: ["detail"],
      },
    ]);

    expect(report.preservedOriginal).toHaveLength(2);
    expect(report.reuploadCandidates).toHaveLength(0);
    expect(report.items.map((item) => item.mediaType)).toEqual(["gif", "video"]);
  });

  it("masks URL query strings and signed-looking tokens", () => {
    const masked = maskMediaUrl("https://media.rare.example/products/photo.png?X-Amz-Signature=secret-token&token=abc");

    expect(masked).toContain("[signed-url]");
    expect(masked).toContain("photo.png");
    expect(masked).not.toContain("secret-token");
    expect(masked).not.toContain("token=abc");
    expect(masked).not.toContain("?");
  });

  it("does not fail when media size is unknown", () => {
    const report = buildMediaVariantAuditReport([
      {
        source: "banner",
        field: "banner-mobile",
        ownerId: "banner-unknown",
        ownerTitle: "Banner sem tamanho",
        ownerActive: true,
        url: "https://media.rare.example/banners/mobile.webp",
        usages: ["banner"],
      },
    ]);

    expect(report.items[0]).toEqual(expect.objectContaining({ sizeStatus: "unknown" }));
    expect(report.summary.totalUnknownSize).toBe(1);
  });

  it("prioritizes active product media used in cards over inactive legacy media", () => {
    const entries = buildProductMediaVariantAuditEntries([
      {
        id: "prod-active",
        title: "Produto ativo",
        slug: "produto-ativo",
        active: true,
        images: [{ url: "https://media.rare.example/products/active.png", sortOrder: 0 }],
      },
      {
        id: "prod-inactive",
        title: "Produto inativo",
        slug: "produto-inativo",
        active: false,
        images: [{ url: "https://media.rare.example/products/inactive.png", sortOrder: 0 }],
      },
    ]);
    const report = buildMediaVariantAuditReport(entries);

    expect(report.reuploadCandidates.find((item) => item.ownerId === "prod-active")).toEqual(
      expect.objectContaining({ priority: "high", usages: expect.arrayContaining(["card"]) }),
    );
    expect(report.reuploadCandidates.find((item) => item.ownerId === "prod-inactive")).toEqual(
      expect.objectContaining({ priority: "low" }),
    );
  });

  it("builds banner entries without requiring network or storage access", () => {
    const entries = buildBannerMediaVariantAuditEntries([
      {
        id: "banner-1",
        title: "Banner principal",
        active: true,
        sortOrder: 1,
        imageUrl: "https://media.rare.example/banners/desktop.png",
        mobileImageUrl: "https://media.rare.example/banners/mobile-rare-v1-original.png",
      },
    ]);
    const report = buildMediaVariantAuditReport(entries);

    expect(entries).toHaveLength(2);
    expect(report.summary.totalMedia).toBe(2);
    expect(report.summary.totalReuploadCandidates).toBe(1);
    expect(report.summary.totalWithVariants).toBe(1);
  });

  it("reports legacy media without treating it as an execution error", () => {
    expect(() =>
      buildMediaVariantAuditReport([
        {
          source: "product",
          field: "product-image",
          ownerId: "prod-legacy",
          ownerTitle: "Produto legado",
          ownerActive: true,
          url: "https://media.rare.example/products/legacy.jpg",
          usages: ["card", "detail", "zoom", "og"],
        },
      ]),
    ).not.toThrow();
  });
});
