import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage, { generateMetadata } from "@/app/(store)/produto/[slug]/page";
import { absoluteUrl } from "@/lib/seo";

const mocks = vi.hoisted(() => ({
  getAppUrl: vi.fn(),
  getProductBySlug: vi.fn(),
  getStoreSettings: vi.fn(),
  isProductVideoUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/components/store/product-detail-client", () => ({
  ProductDetailClient: ({
    product,
    productUrl,
    whatsappNumber,
    whatsappMessage,
  }: {
    product: { title: string };
    productUrl: string;
    whatsappNumber: string | null;
    whatsappMessage: string | null;
  }) =>
    createElement(
      "section",
      {
        "data-product-url": productUrl,
        "data-whatsapp-number": whatsappNumber ?? "",
        "data-whatsapp-message": whatsappMessage ?? "",
      },
      product.title,
    ),
}));

vi.mock("@/lib/env", () => ({
  getAppUrl: mocks.getAppUrl,
  isCheckoutEnabled: () => true,
}));

vi.mock("@/lib/product-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-media")>();
  return {
    ...actual,
    isProductVideoUrl: mocks.isProductVideoUrl,
  };
});

vi.mock("@/lib/settings", () => ({
  getStoreSettings: mocks.getStoreSettings,
}));

vi.mock("@/lib/storefront", () => ({
  getProductBySlug: mocks.getProductBySlug,
}));

const product = {
  id: "prod-1",
  title: "Camiseta RARE",
  slug: "camiseta-rare",
  shortDescription: "Camiseta importada selecionada.",
  description: "Descrição completa.",
  priceInCents: 19990,
  category: { name: "Camisetas", slug: "camisetas" },
  subcategory: null,
  images: [{ url: "https://raredept.com.br/uploads/camiseta-rare.webp", alt: "Camiseta RARE" }],
  variants: [{ id: "var-p", size: "P", stock: 2, reservedStock: 0, active: true }],
};

function getJsonLdScripts(html: string) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function getOpenGraphImageUrls(metadata: Awaited<ReturnType<typeof generateMetadata>>) {
  const images = metadata.openGraph?.images;
  const list = Array.isArray(images) ? images : images ? [images] : [];
  return list.map((image) => {
    if (typeof image === "string") return image;
    if (image instanceof URL) return image.toString();
    return String(image.url);
  });
}

describe("store product page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockReturnValue("https://raredept.com.br");
    mocks.getStoreSettings.mockResolvedValue({
      whatsappNumber: "5511999999999",
      whatsappDefaultMessage: "Tenho interesse.",
    });
    mocks.isProductVideoUrl.mockReturnValue(false);
  });

  it("renders a valid product page", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce(product);

    const element = await ProductPage({
      params: Promise.resolve({ slug: "camiseta-rare" }),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(mocks.getProductBySlug).toHaveBeenCalledWith("camiseta-rare");
    expect(mocks.getStoreSettings).toHaveBeenCalledOnce();
    expect(html).toContain("Camiseta RARE");
    expect(html).toContain('data-product-url="https://raredept.com.br/produto/camiseta-rare"');
    expect(html).toContain('data-whatsapp-number="5511999999999"');
    expect(html).toContain('type="application/ld+json"');

    const schemas = getJsonLdScripts(html);
    const productSchemas = schemas.filter((schema) => schema["@type"] === "Product");
    const breadcrumbSchemas = schemas.filter((schema) => schema["@type"] === "BreadcrumbList");

    expect(productSchemas).toHaveLength(1);
    expect(productSchemas[0]).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Camiseta RARE",
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: "199.90",
        availability: "https://schema.org/InStock",
        url: "https://raredept.com.br/produto/camiseta-rare",
      },
    });
    expect(breadcrumbSchemas).toHaveLength(1);
    expect(breadcrumbSchemas[0].itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Início", item: "https://raredept.com.br/" },
      { "@type": "ListItem", position: 2, name: "Camisetas", item: "https://raredept.com.br/categoria/camisetas" },
      { "@type": "ListItem", position: 3, name: "Camiseta RARE", item: "https://raredept.com.br/produto/camiseta-rare" },
    ]);
    expect(JSON.stringify(schemas)).not.toContain("5511999999999");
    expect(JSON.stringify(schemas)).not.toContain("Tenho interesse.");
  });

  it("calls notFound when the product slug does not exist", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce(null);

    await expect(
      ProductPage({
        params: Promise.resolve({ slug: "nao-existe" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getProductBySlug).toHaveBeenCalledWith("nao-existe");
    expect(mocks.getStoreSettings).not.toHaveBeenCalled();
  });

  it("generates metadata for a valid product", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce(product);

    const result = await generateMetadata({ params: Promise.resolve({ slug: "camiseta-rare" }) });
    const canonical = absoluteUrl("/produto/camiseta-rare");

    expect(result.title).toBe("Camiseta RARE");
    expect(result.description).toBe("Camiseta importada selecionada.");
    expect(result.alternates).toEqual({ canonical });
    expect(result.openGraph).toMatchObject({
      title: "Camiseta RARE | RARE",
      description: "Camiseta importada selecionada.",
      url: canonical,
      siteName: "RARE",
      locale: "pt_BR",
      type: "website",
    });
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Camiseta RARE | RARE",
      description: "Camiseta importada selecionada.",
    });
    expect(getOpenGraphImageUrls(result)).toEqual(["https://raredept.com.br/uploads/camiseta-rare.webp"]);
  });

  it("prefers static product images over GIF and video metadata images", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce({
      ...product,
      images: [
        { url: "https://raredept.com.br/uploads/camiseta-rare.mp4", alt: "Vídeo" },
        { url: "https://raredept.com.br/uploads/camiseta-rare.gif", alt: "GIF" },
        { url: "https://raredept.com.br/uploads/camiseta-rare.jpg", alt: "Camiseta RARE" },
      ],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "camiseta-rare" }) });

    expect(getOpenGraphImageUrls(result)).toEqual(["https://raredept.com.br/uploads/camiseta-rare.jpg"]);
  });

  it("does not use MP4 as product og:image when it is the only media", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce({
      ...product,
      images: [{ url: "https://raredept.com.br/uploads/camiseta-rare.mp4", alt: "Vídeo" }],
    });

    const result = await generateMetadata({ params: Promise.resolve({ slug: "camiseta-rare" }) });

    expect(getOpenGraphImageUrls(result)).toEqual([absoluteUrl("/brand/rare-logo.png")]);
    expect(JSON.stringify(result)).not.toContain(".mp4");
  });

  it("calls notFound while generating metadata for unknown products", async () => {
    mocks.getProductBySlug.mockResolvedValueOnce(null);

    await expect(generateMetadata({ params: Promise.resolve({ slug: "nao-existe" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getProductBySlug).toHaveBeenCalledWith("nao-existe");
  });
});

describe("store product and category 404 UIs", () => {
  it("renders the product-specific not found UI", async () => {
    const { default: ProductNotFound, metadata } = await import("@/app/(store)/produto/[slug]/not-found");

    const html = renderToStaticMarkup(createElement(ProductNotFound) as ReactElement);

    expect(metadata.title).toBe("Produto não encontrado");
    expect(metadata.robots).toEqual({ index: false });
    expect(html).toContain("Produto não encontrado");
    expect(html).toContain("Essa peça não está disponível no catálogo da RARE.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain('href="/categoria/destaques"');
  });

  it("renders the category-specific not found UI", async () => {
    const { default: CategoryNotFound, metadata } = await import("@/app/(store)/categoria/[slug]/not-found");

    const html = renderToStaticMarkup(createElement(CategoryNotFound) as ReactElement);

    expect(metadata.title).toBe("Categoria não encontrada");
    expect(metadata.robots).toEqual({ index: false });
    expect(html).toContain("Categoria não encontrada");
    expect(html).toContain("Essa seleção não existe no catálogo da RARE.");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain('href="/categoria/destaques"');
  });
});
