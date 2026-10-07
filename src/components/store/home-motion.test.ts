import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeBrandsStrip } from "@/components/store/home-brands-strip";
import { HomeFeaturedCarousel, type HomeFeaturedSlide } from "@/components/store/home-featured-carousel";
import { HomeHeroCarousel } from "@/components/store/home-hero-carousel";
import { HomeMotionProvider, useHomeCarousel, useHomeMotion } from "@/components/store/home-motion";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

function MotionProbe({ count }: { count: number }) {
  const motion = useHomeMotion();
  const carousel = useHomeCarousel(count);
  return createElement("output", {
    "data-paused": motion.paused,
    "data-reduced-motion": motion.reducedMotion,
    "data-page-visible": motion.pageVisible,
    "data-playing": carousel.playing,
    "data-media-playing": carousel.mediaPlaying,
    "data-active-index": carousel.activeIndex,
  });
}

const product: HomeFeaturedSlide = {
  id: "single-featured",
  title: "Uma peça real",
  slug: "uma-peca-real",
  priceInCents: 15000,
  soldOut: false,
  image: { url: "/uploads/products/single.webp", alt: "Peça selecionada" },
};

describe("home shared motion server contract", () => {
  it.each([0, 1, 2])("starts safely without autoplay or browser access with %i slides", (count) => {
    const html = renderToStaticMarkup(createElement(HomeMotionProvider, null, createElement(MotionProbe, { count })));

    expect(html).toContain('data-paused="false"');
    expect(html).toContain('data-reduced-motion="true"');
    expect(html).toContain('data-page-visible="false"');
    expect(html).toContain('data-playing="false"');
    expect(html).toContain('data-media-playing="false"');
    expect(html).toContain('data-active-index="0"');
  });

  it.each([
    { count: 0, products: [] as HomeFeaturedSlide[] },
    { count: 1, products: [product] },
  ])("keeps one global control with no brands and $count featured products", ({ products }) => {
    const html = renderToStaticMarkup(createElement(HomeMotionProvider, null,
        createElement(HomeBrandsStrip, { key: "brands", brands: [] }),
        createElement(HomeHeroCarousel, {
          key: "hero",
          slides: [{
            id: "single-video",
            imageUrl: "https://media.rare.example/banners/hero.mp4",
            alt: "Editorial em vídeo",
            active: true,
          }],
        }),
        createElement(HomeFeaturedCarousel, { key: "featured", products }),
    ));

    expect((html.match(/data-motion-control/g) ?? [])).lengthOf(1);
    const control = (html.match(/<button\b[^>]*>/g) ?? []).find((tag) => tag.includes("data-motion-control"));
    expect(control).toContain('aria-label="Movimento reduzido da página"');
    expect(control).toContain('disabled=""');
    expect(control).toContain("min-h-11");
    expect(control).toContain("focus-visible:outline-2");
    expect(html).not.toMatch(/\sautoplay(?:=|\s|>)/i);
    expect(html).not.toContain('data-playing="true"');
    expect(html).not.toContain('aria-label="Próximo produto em destaque"');
    expect(html).not.toContain('aria-label="Próximo slide"');
    if (products.length) {
      expect(html).toContain('href="/produto/uma-peca-real"');
      expect(html).toContain('loading="lazy"');
    }
  });
});
