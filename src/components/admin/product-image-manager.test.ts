import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductImageManager } from "@/components/admin/product-image-manager";

describe("ProductImageManager", () => {
  it("renders media gallery, replacement controls and advanced manual URLs collapsed by default", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImageManager, {
        images: [
          { url: "/seed-products/bolsa-bag-supreme.svg" },
          { url: "/uploads/products/look.gif" },
          { url: "https://media.rare.example/products/video.mp4" },
        ],
      }) as ReactElement,
    );

    expect(html).toContain("Mídia do produto");
    expect(html).toContain("3/10 mídias adicionadas");
    expect(html).toContain("Capa atual");
    expect(html).toContain("CAPA");
    expect(html).toContain("Substituir mídias antigas por este upload");
    expect(html).toContain("checked=\"\"");
    expect(html).toContain("Limpar mídias antigas");
    expect(html).toContain("Avançado: URLs manuais");
    expect(html).not.toContain("open=\"\"");
    expect(html).toContain("JPG, PNG, WEBP, GIF ou MP4 até 4 MB por arquivo.");
    expect(html).toContain("Seed");
    expect(html).toContain("GIF");
    expect(html).toContain("Vídeo");
  });

  it("does not preselect replacement mode for a new product", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImageManager, {
        images: [],
      }) as ReactElement,
    );

    expect(html).toContain("0/10 mídias adicionadas");
    expect(html).toContain("Nenhuma mídia principal");
    expect(html).not.toContain("checked=\"\"");
  });
});
