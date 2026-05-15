import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeHeroCarousel } from "@/components/store/home-hero-carousel";
import type { HomeHeroSlide } from "@/lib/home-hero-slides";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const baseSlides = [
  {
    id: "slide-1",
    eyebrow: "RARE",
    title: "Curadoria streetwear",
    description: "Produtos selecionados.",
    ctaLabel: "Ver curadoria",
    href: "/",
    imageUrl: "",
    alt: "Banner de curadoria streetwear",
    active: true,
  },
  {
    id: "slide-2",
    eyebrow: "Drops",
    title: "Drops selecionados",
    description: "Novas entradas.",
    ctaLabel: "Explorar",
    href: "/categoria/camisetas",
    imageUrl: "",
    alt: "Banner de drops selecionados",
    active: true,
  },
  {
    id: "slide-inativo",
    title: "Slide inativo",
    imageUrl: "",
    alt: "Banner inativo",
    active: false,
  },
] satisfies HomeHeroSlide[];

describe("HomeHeroCarousel", () => {
  it("renders the active hero slide with accessible controls and placeholder media", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: baseSlides }));

    expect(html).toContain('aria-label="Destaques da home RARE"');
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain("Curadoria streetwear");
    expect(html).toContain("Editorial streetwear");
    expect(html).toContain('aria-label="Slide anterior"');
    expect(html).toContain('aria-label="Próximo slide"');
    expect(html).toContain('aria-label="Ir para slide 1"');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain("Slide inativo");
  });

  it("does not render arrow or dot controls for one active slide", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: [baseSlides[0]] }));

    expect(html).toContain("Curadoria streetwear");
    expect(html).not.toContain('aria-label="Slide anterior"');
    expect(html).not.toContain('aria-label="Próximo slide"');
    expect(html).not.toContain('aria-label="Ir para slide 1"');
  });

  it("renders a premium fallback when there are no active slides", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: [] }));

    expect(html).toContain('aria-label="Destaque RARE"');
    expect(html).toContain("Editorial streetwear");
  });
});
