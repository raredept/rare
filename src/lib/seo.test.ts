import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildCategoryMetadata,
  buildPageMetadata,
  buildProductMetadata,
  getPublicBaseUrl,
  getSocialImageForProduct,
  isSafePublicSocialImageUrl,
  RARE_DEFAULT_SITE_URL,
} from "@/lib/seo";

const productionEnv = {
  NODE_ENV: "production",
} satisfies Record<string, string>;

function getOpenGraphImageUrls(metadata: Metadata) {
  const images = metadata.openGraph?.images;
  const list = Array.isArray(images) ? images : images ? [images] : [];
  return list.map((image) => {
    if (typeof image === "string") return image;
    if (image instanceof URL) return image.toString();
    return String(image.url);
  });
}

describe("public SEO helpers", () => {
  it("normalizes absolute canonicals and never falls back to localhost in production", () => {
    expect(getPublicBaseUrl({ NODE_ENV: "production", APP_URL: "http://localhost:3000" })).toBe(RARE_DEFAULT_SITE_URL);
    expect(getPublicBaseUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(getPublicBaseUrl({ NODE_ENV: "test", APP_URL: "https://raredept.com.br/loja?token=hidden" })).toBe(
      "https://raredept.com.br",
    );
    expect(absoluteUrl("/categoria/tudo?q=camiseta", productionEnv)).toBe("https://raredept.com.br/categoria/tudo");
  });

  it("builds complete base metadata for public pages", () => {
    const metadata = buildPageMetadata({
      title: "Sobre a RARE",
      description: "Streetwear importado e drops selecionados.",
      path: "/sobre",
      env: productionEnv,
    });

    expect(metadata.title).toBe("Sobre a RARE");
    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/sobre" });
    expect(metadata.openGraph).toMatchObject({
      title: "Sobre a RARE | RARE",
      description: "Streetwear importado e drops selecionados.",
      url: "https://raredept.com.br/sobre",
      siteName: "RARE",
      locale: "pt_BR",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Sobre a RARE | RARE",
      description: "Streetwear importado e drops selecionados.",
    });
    expect(getOpenGraphImageUrls(metadata)).toEqual(["https://raredept.com.br/brand/rare-logo.png"]);
  });

  it("marks empty category metadata as noindex without blocking follow", () => {
    const metadata = buildCategoryMetadata(
      {
        kind: "category",
        slug: "cuecas",
        title: "Cuecas",
        description: "Peças disponíveis agora nesta categoria.",
        products: [],
      },
      productionEnv,
    );

    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/categoria/cuecas" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("keeps populated virtual catalog metadata indexable", () => {
    const metadata = buildCategoryMetadata(
      {
        kind: "grouped",
        slug: "tudo",
        title: "Catálogo completo",
        description: "Explore todas as peças da RARE por categoria.",
        sections: [{ total: 1, products: [{}] }],
      },
      productionEnv,
    );

    expect(metadata.alternates).toEqual({ canonical: "https://raredept.com.br/categoria/tudo" });
    expect(metadata.robots).toBeUndefined();
  });

  it("selects safe static product images and avoids video, GIF, signed or tokenized images", () => {
    const metadata = buildProductMetadata(
      {
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        shortDescription: "Camiseta importada selecionada.",
        images: [
          { url: "https://raredept.com.br/uploads/fit.mp4", alt: "Vídeo" },
          { url: "https://raredept.com.br/uploads/look.gif", alt: "GIF" },
          { url: "https://raredept.com.br/uploads/look.webp", alt: "Camiseta RARE" },
        ],
      },
      productionEnv,
    );

    expect(getOpenGraphImageUrls(metadata)).toEqual(["https://raredept.com.br/uploads/look.webp"]);
    expect(isSafePublicSocialImageUrl("https://raredept.com.br/uploads/look.mp4", productionEnv)).toBe(false);
    expect(isSafePublicSocialImageUrl("https://raredept.com.br/uploads/look.gif", productionEnv)).toBe(false);
    expect(isSafePublicSocialImageUrl("https://raredept.com.br/uploads/look.webp?token=abc", productionEnv)).toBe(false);
    expect(isSafePublicSocialImageUrl("https://raredept.com.br/private/look.webp", productionEnv)).toBe(false);
  });

  it("uses the persisted medium variant for product social metadata", () => {
    const metadata = buildProductMetadata(
      {
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        images: [
          {
            url: "https://media.rare.example/products/id-look-rare-v1-original.png",
            alt: "Camiseta RARE",
          },
        ],
      },
      productionEnv,
    );

    expect(getOpenGraphImageUrls(metadata)).toEqual([
      "https://media.rare.example/products/id-look-rare-v1-medium.webp",
    ]);
  });

  it("falls back to the store image when product media is absent or only video", () => {
    expect(
      getSocialImageForProduct([{ url: "https://raredept.com.br/uploads/drop.mp4", alt: "Vídeo" }], "Drop", productionEnv),
    ).toEqual({
      url: "https://raredept.com.br/brand/rare-logo.png",
      alt: "RARE",
    });

    const metadata = buildProductMetadata(
      {
        title: "Produto sem imagem",
        slug: "produto-sem-imagem",
        description: "Peça selecionada pela RARE.",
        images: [],
      },
      productionEnv,
    );

    expect(getOpenGraphImageUrls(metadata)).toEqual(["https://raredept.com.br/brand/rare-logo.png"]);
  });

  it("does not leak sensitive patterns through generated metadata", () => {
    const metadata = buildProductMetadata(
      {
        title: "Produto sk_live_test",
        slug: "produto-seguro",
        description:
          "DATABASE_URL sk_live_123456 whsec_123456 UPSTASH_REDIS_REST_TOKEN R2_SECRET SECRET_ACCESS_KEY Bearer abc.def",
        images: [{ url: "https://raredept.com.br/uploads/sk_test_secret.webp", alt: "whsec_123456" }],
      },
      {
        NODE_ENV: "production",
        APP_URL: "https://raredept.com.br?token=sk_live_hidden",
        R2_SECRET_ACCESS_KEY: "secret-not-used",
      },
    );
    const serialized = JSON.stringify(metadata);

    for (const forbidden of [
      "sk_live_",
      "sk_test_",
      "whsec_",
      "DATABASE_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "R2_SECRET",
      "SECRET_ACCESS_KEY",
      "Bearer",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
