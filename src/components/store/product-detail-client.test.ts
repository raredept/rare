import { createElement, createRef, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { calculateProductLensPosition, ProductDetailClient, ProductImageZoomDialog } from "@/components/store/product-detail-client";
import { formatMoney } from "@/lib/money";
import { buildStorefrontCommerceState } from "@/lib/storefront-commerce";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    addItem: vi.fn(),
  }),
  useCartDrawer: () => ({
    openCart: vi.fn(),
  }),
}));

const product = {
  id: "prod-1",
  title: "Camiseta RARE",
  slug: "camiseta-rare",
  shortDescription: "Camiseta importada selecionada.",
  description: "Descrição completa.",
  priceInCents: 19990,
  images: [],
  variants: [{ id: "var-p", size: "P", stock: 2, reservedStock: 0, active: true }],
};

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

describe("ProductDetailClient", () => {
  it("keeps the magnifying lens inside the image and exposes the exact pointer coordinates", () => {
    const position = calculateProductLensPosition(
      { clientX: 500, clientY: 300 },
      { left: 100, top: 100, width: 800, height: 1000 },
    );

    expect(position.left).toBe(296);
    expect(position.top).toBe(96);
    expect(position.pointerX).toBe(400);
    expect(position.pointerY).toBe(200);

    expect(
      calculateProductLensPosition(
        { clientX: 100, clientY: 100 },
        { left: 100, top: 100, width: 800, height: 1000 },
      ),
    ).toMatchObject({ left: 0, top: 0, pointerX: 0, pointerY: 0 });
  });

  it("renders product trust signals, stock copy, policy links, and media fallback", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product,
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(html).toContain("Produto sem imagem");
    expect(html).toContain("2 unidades disponíveis");
    expect(html).toContain("Frete e prazo");
    expect(html).toContain("Descrição completa.");
    expect(html).toContain('href="/politica-de-envio"');
    expect(html).toContain("Compra segura");
    expect(html).toContain("Estoque limitado");
    expect(html).toContain('href="/trocas-e-devolucoes"');
    expect(html).toContain("Troca e devolução em até 7 dias");
    expect(html).toContain("Atendimento direto");
    expect(html).toContain("Fale com a RARE pelo WhatsApp");
  });

  it("renders the zoom dialog above the storefront shell and constrains the image to the viewport", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImageZoomDialog, {
        productTitle: "Camiseta RARE",
        zoomedImage: { url: "/uploads/camiseta-rare.webp", alt: "Camiseta RARE" },
        zoomedImagePosition: 0,
        zoomableImageCount: 2,
        hasZoomNavigation: true,
        closeRef: createRef<HTMLButtonElement>(),
        onClose: vi.fn(),
        onPrevious: vi.fn(),
        onNext: vi.fn(),
      }) as ReactElement,
    );

    expect(html).toContain("z-[90]");
    expect(html).toContain("h-dvh");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("max-h-full");
    expect(html).toContain("1 / 2");
  });

  it("renders the summary near the price and moves the full description to a details section", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [{ url: "/uploads/camiseta-rare.webp", alt: "Camiseta RARE" }],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );
    const titleIndex = html.indexOf("<h1");
    const descriptionIndex = html.indexOf("Camiseta importada selecionada.");
    const priceIndex = html.indexOf(formatMoney(product.priceInCents));

    expect(html).toContain("cursor-zoom-in");
    expect(html).toContain("motion-safe:md:group-hover:scale-[1.08]");
    expect(html).toContain('aria-label="Ampliar imagem do produto"');
    expect(html).toContain("Passe o mouse para ampliar");
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchPriority="high"');
    expect(html).not.toContain("absolute inset-2");
    expect(titleIndex).toBeGreaterThanOrEqual(0);
    expect(descriptionIndex).toBeGreaterThan(titleIndex);
    expect(priceIndex).toBeGreaterThan(descriptionIndex);
    expect(countOccurrences(html, "Descrição completa.")).toBe(1);
    expect(html).toContain("Detalhes do produto");
    expect(html).toContain("Camiseta importada selecionada.");
  });

  it("disables purchase actions and removes payment promises when checkout is paused", () => {
    const html = renderToStaticMarkup(createElement(ProductDetailClient, {
      product,
      productUrl: "https://raredept.com.br/produto/camiseta-rare",
      whatsappMessage: "Tenho interesse.",
      commerce: buildStorefrontCommerceState(false),
    }) as ReactElement);
    expect(html).toContain("Compras temporariamente pausadas");
    expect(html).toContain("nenhum pagamento será solicitado");
    expect(html).not.toContain("Pix ou cartão disponíveis");
    expect(html).toContain("disabled");
  });

  it("falls back to the short description and does not render an empty description block", () => {
    const htmlWithShortDescription = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          description: "",
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(htmlWithShortDescription).toContain("Camiseta importada selecionada.");

    const htmlWithoutDescription = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          shortDescription: "",
          description: "",
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(htmlWithoutDescription).not.toContain("whitespace-pre-line");
    expect(htmlWithoutDescription).not.toContain(">Detalhes<");
  });

  it("does not expose the image zoom action for MP4 media", () => {
    const html = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [{ url: "/uploads/camiseta-rare.mp4", alt: "Vídeo do produto" }],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );

    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).not.toContain('aria-label="Ampliar imagem do produto"');
    expect(html).not.toContain("motion-safe:md:group-hover:scale-[1.08]");
  });

  it("uses responsive detail variants without replacing the original zoom source", () => {
    const responsiveImage = {
      url: "/uploads/camiseta-original.webp",
      alt: "Camiseta RARE",
      variants: [
        { url: "/uploads/camiseta-640.webp", width: 640, height: 800 },
        { url: "/uploads/camiseta-1200.webp", width: 1200, height: 1500 },
      ],
    };
    const detailHtml = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [responsiveImage],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );
    const zoomHtml = renderToStaticMarkup(
      createElement(ProductImageZoomDialog, {
        productTitle: "Camiseta RARE",
        zoomedImage: responsiveImage,
        zoomedImagePosition: 0,
        zoomableImageCount: 1,
        hasZoomNavigation: false,
        closeRef: createRef<HTMLButtonElement>(),
        onClose: vi.fn(),
        onPrevious: vi.fn(),
        onNext: vi.fn(),
      }) as ReactElement,
    );

    expect(detailHtml).toContain('src="/uploads/camiseta-1200.webp"');
    expect(detailHtml).toContain(
      'srcSet="/uploads/camiseta-640.webp 640w, /uploads/camiseta-1200.webp 1200w"',
    );
    expect(zoomHtml).toContain('src="/uploads/camiseta-original.webp"');
    expect(zoomHtml).not.toContain("srcSet=");
  });

  it("infers the medium detail source while keeping the versioned original for zoom", () => {
    const responsiveImage = {
      url: "/uploads/products/2026/06/id-camiseta-rare-v1-original.png",
      alt: "Camiseta RARE",
    };
    const detailHtml = renderToStaticMarkup(
      createElement(ProductDetailClient, {
        product: {
          ...product,
          images: [responsiveImage],
        },
        productUrl: "https://raredept.com.br/produto/camiseta-rare",
        whatsappNumber: "5511999999999",
        whatsappMessage: "Tenho interesse.",
      }) as ReactElement,
    );
    const zoomHtml = renderToStaticMarkup(
      createElement(ProductImageZoomDialog, {
        productTitle: "Camiseta RARE",
        zoomedImage: responsiveImage,
        zoomedImagePosition: 0,
        zoomableImageCount: 1,
        hasZoomNavigation: false,
        closeRef: createRef<HTMLButtonElement>(),
        onClose: vi.fn(),
        onPrevious: vi.fn(),
        onNext: vi.fn(),
      }) as ReactElement,
    );

    expect(detailHtml).toContain('src="/uploads/products/2026/06/id-camiseta-rare-v1-medium.webp"');
    expect(zoomHtml).toContain('src="/uploads/products/2026/06/id-camiseta-rare-v1-original.png"');
    expect(zoomHtml).not.toContain("srcSet=");
  });
});
