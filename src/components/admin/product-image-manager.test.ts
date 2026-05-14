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
    expect(html).toContain("Limpar mídias antigas");
    expect(html).toContain("Avançado: URLs manuais");
    expect(html).not.toContain("open=\"\"");
    expect(html).toContain("JPG, PNG e WEBP até 5 MB. GIF até 10 MB. MP4 até 30 MB.");
    expect(html).toContain("Seed");
    expect(html).toContain("GIF");
    expect(html).toContain("Vídeo");
  });
});
