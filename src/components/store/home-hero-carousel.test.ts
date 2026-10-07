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
    title: "Streetwear importado",
    description: "Peças escolhidas a dedo.",
    ctaLabel: "Ver catálogo",
    href: "/",
    imageUrl: "",
    alt: "Banner de streetwear importado",
    active: true,
  },
  {
    id: "slide-2",
    eyebrow: "Drops",
    title: "Drops limitados",
    description: "Novas entradas.",
    ctaLabel: "Explorar",
    href: "/categoria/camisetas",
    imageUrl: "",
    alt: "Banner de drops limitados",
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

function mediaTag(html: string, type: "img" | "video") {
  const tag = html.match(new RegExp(`<${type}\\b[^>]*>`))?.[0];
  expect(tag).toBeDefined();
  return tag!;
}

function inlineStyle(tag: string) {
  const style = tag.match(/style="([^"]*)"/)?.[1];
  expect(style).toBeDefined();
  return Object.fromEntries(style!.split(";").filter(Boolean).map((declaration) => {
    const separator = declaration.indexOf(":");
    return [declaration.slice(0, separator), declaration.slice(separator + 1)];
  }));
}

describe("HomeHeroCarousel", () => {
  it("keeps small text and inactive indicators contrasted over the brightest possible banner", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: baseSlides }));
    expect(html).toContain('class="absolute inset-0 bg-black/60"');
    expect(html).toContain("text-white/90");
    expect(html).toContain("w-2.5 bg-white/60");

    const luminance = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const background = 255 * (1 - 0.6);
    const ratio = (opacity: number) => (luminance(255 * opacity + background * (1 - opacity)) + 0.05) / (luminance(background) + 0.05);
    expect(ratio(0.9)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(0.6)).toBeGreaterThanOrEqual(3);
  });

  it("renders the active hero slide with accessible controls and placeholder media", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: baseSlides }));

    expect(html).toContain('aria-label="Destaques da home RARE"');
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain("Streetwear importado");
    expect(html).toContain("Editorial streetwear");
    expect(html).toContain('aria-label="Slide anterior"');
    expect(html).toContain('aria-label="Próximo slide"');
    expect(html).toContain('aria-label="Ir para slide 1"');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain("data-motion-control");
    expect(html).toContain("block h-2.5 rounded-full");
    expect(html).not.toContain("Slide inativo");
  });

  it("does not render arrow or dot controls for one active slide", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: [baseSlides[0]] }));

    expect(html).toContain("Streetwear importado");
    expect(html).not.toContain('aria-label="Slide anterior"');
    expect(html).not.toContain('aria-label="Próximo slide"');
    expect(html).not.toContain('aria-label="Ir para slide 1"');
  });

  it("renders a premium fallback when there are no active slides", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: [] }));

    expect(html).toContain('aria-label="Destaque RARE"');
    expect(html).toContain("Editorial streetwear");
  });

  it("renders MP4 banners progressively with a poster when configured", () => {
    const html = renderToStaticMarkup(
      createElement(HomeHeroCarousel, {
        slides: [
          {
            id: "video-banner",
            title: "Drop em movimento",
            imageUrl: "https://media.rare.example/banners/drop.mp4",
            mobileImageUrl: "https://media.rare.example/banners/drop-poster.webp",
            alt: "Video do drop",
            active: true,
            imageFit: "contain",
            imagePositionX: 0,
            imagePositionY: 100,
            mobileImagePositionX: 100,
            mobileImagePositionY: 0,
          },
        ],
      }),
    );

    expect(html).toContain("<video");
    expect(html).toContain('src="https://media.rare.example/banners/drop.mp4"');
    expect(html).toContain('poster="https://media.rare.example/banners/drop-poster.webp"');
    expect(html).toContain('preload="metadata"');
    const video = mediaTag(html, "video");
    expect(video).not.toMatch(/\sautoplay(?:=|\s|>)/i);
    expect(inlineStyle(video)).toMatchObject({
      "object-fit": "contain",
      "--hero-position-desktop": "0% 100%",
      "--hero-position-mobile": "100% 0%",
    });
  });

  it("uses generated banner variants without affecting the original persisted URL", () => {
    const html = renderToStaticMarkup(
      createElement(HomeHeroCarousel, {
        slides: [
          {
            id: "optimized-banner",
            title: "Drop otimizado",
            imageUrl: "https://media.rare.example/banners/id-drop-rare-v1-original.png",
            alt: "Drop otimizado",
            active: true,
          },
        ],
      }),
    );

    expect(html).toContain('src="https://media.rare.example/banners/id-drop-rare-v1-medium.webp"');
    expect(html).toContain(
      'srcSet="https://media.rare.example/banners/id-drop-rare-v1-thumbnail.webp 640w, https://media.rare.example/banners/id-drop-rare-v1-medium.webp 1200w"',
    );
    expect(inlineStyle(mediaTag(html, "img"))).toMatchObject({
      "object-fit": "cover",
      "--hero-position-desktop": "50% 50%",
      "--hero-position-mobile": "50% 50%",
    });
  });

  it("serializes persisted desktop and mobile crop coordinates without replacing zero with defaults", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, {
      slides: [{
        ...baseSlides[0],
        imageUrl: "https://media.rare.example/banners/desktop.webp",
        mobileImageUrl: "https://media.rare.example/banners/mobile.webp",
        imageFit: "contain",
        imagePositionX: 0,
        imagePositionY: 100,
        mobileImagePositionX: 100,
        mobileImagePositionY: 0,
      }],
    }));

    const image = mediaTag(html, "img");
    expect(inlineStyle(image)).toMatchObject({
      "object-fit": "contain",
      "--hero-position-desktop": "0% 100%",
      "--hero-position-mobile": "100% 0%",
    });
    expect(image).toContain("object-[var(--hero-position-mobile)]");
    expect(image).toContain("md:object-[var(--hero-position-desktop)]");
    expect(html).toContain('<source media="(max-width: 767px)" srcSet="https://media.rare.example/banners/mobile.webp"');
  });

  it("prioritizes only the initial active hero image and leaves other slides unloaded on the server", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, {
      slides: [
        { ...baseSlides[0], imageUrl: "https://media.rare.example/banners/first.webp" },
        { ...baseSlides[1], imageUrl: "https://media.rare.example/banners/next.webp" },
        { ...baseSlides[2], imageUrl: "https://media.rare.example/banners/inactive.webp" },
      ],
    }));

    const image = mediaTag(html, "img");
    expect(image).toContain('loading="eager"');
    expect(image).toContain('fetchPriority="high"');
    expect((html.match(/<img\b/g) ?? [])).lengthOf(1);
    expect(html).not.toContain("next.webp");
    expect(html).not.toContain("inactive.webp");
  });

  it("keeps arrows and indicators at least 44px with visible focus styling", () => {
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides: baseSlides }));
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];

    expect(buttons).lengthOf(4);
    for (const button of buttons) {
      const classes = button.match(/class="([^"]*)"/)?.[1].split(" ") ?? [];
      expect(classes).toContain("h-11");
      expect(classes.some((token) => token === "w-11" || token === "w-12")).toBe(true);
      expect(classes.some((token) => token === "focus-visible:outline-2" || token === "focus-visible:ring-2")).toBe(true);
    }
  });

  it("bounds many slide indicators without shrinking targets or overlapping the arrows", () => {
    const slides = Array.from({ length: 10 }, (_, index) => ({ ...baseSlides[0], id: `slide-${index}` }));
    const html = renderToStaticMarkup(createElement(HomeHeroCarousel, { slides }));
    expect(html).toContain('class="store-shell absolute inset-x-0 bottom-5 z-30 flex items-center gap-4"');
    expect(html).toContain('class="scrollbar-none flex min-w-0 flex-1 touch-pan-x items-center overflow-x-auto"');
    expect(html).toContain("focus-visible:ring-inset");
    expect(html.match(/aria-label="Ir para slide \d+"/g)).toHaveLength(10);
    expect(html.match(/h-11 shrink-0/g)).toHaveLength(10);
  });
});
