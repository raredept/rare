import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFallbackHomeBannerSlides,
  getHomeBannerSlidesForStore,
  homeBannerInputSchema,
  isSafeBannerHref,
  normalizeBannerHref,
  normalizeHomeBannerSlide,
} from "@/lib/home-banners";

const mocks = vi.hoisted(() => ({
  prisma: {
    homeBannerSlide: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("home banner helpers", () => {
  it("returns active persisted banners ordered for the storefront", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([
      {
        id: "banner-2",
        eyebrow: "Drop",
        title: "Segundo",
        description: null,
        ctaLabel: "Comprar",
        href: "/categoria/camisetas",
        imageUrl: "https://media.rare.example/banners/segundo.webp",
        mobileImageUrl: null,
        alt: "Banner segundo",
        active: true,
        sortOrder: 20,
      },
      {
        id: "banner-1",
        eyebrow: "Rare",
        title: "Primeiro",
        description: null,
        ctaLabel: null,
        href: null,
        imageUrl: "",
        mobileImageUrl: null,
        alt: "Banner primeiro",
        active: true,
        sortOrder: 30,
      },
    ]);

    const slides = await getHomeBannerSlidesForStore();

    expect(mocks.prisma.homeBannerSlide.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    expect(slides.map((slide) => slide.id)).toEqual(["banner-2", "banner-1"]);
  });

  it("falls back to code slides when there are no persisted banners or the database fails", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([]);
    const emptySlides = await getHomeBannerSlidesForStore();

    mocks.prisma.homeBannerSlide.findMany.mockRejectedValueOnce(new Error("database unavailable"));
    const failedSlides = await getHomeBannerSlidesForStore();

    expect(emptySlides.map((slide) => slide.id)).toEqual(getFallbackHomeBannerSlides().map((slide) => slide.id));
    expect(failedSlides.map((slide) => slide.id)).toEqual(getFallbackHomeBannerSlides().map((slide) => slide.id));
  });

  it("does not normalize invalid active banner data for the public carousel", () => {
    const normalized = normalizeHomeBannerSlide({
      id: "bad-banner",
      eyebrow: null,
      title: "Banner ruim",
      description: null,
      ctaLabel: "Abrir",
      href: "javascript:alert(1)",
      imageUrl: "https://media.rare.example/banners/banner.webp",
      mobileImageUrl: null,
      alt: "Banner ruim",
      active: true,
      sortOrder: 0,
    });

    expect(normalized).toBeNull();
  });

  it("validates href and alt/imageUrl rules", () => {
    expect(isSafeBannerHref("/")).toBe(true);
    expect(isSafeBannerHref("/categoria/acessorios")).toBe(true);
    expect(isSafeBannerHref("/produto/camiseta-rare")).toBe(true);
    expect(isSafeBannerHref("https://raredept.com.br/categoria/acessorios")).toBe(true);
    expect(normalizeBannerHref("http://localhost:3000/categoria/acessorios")).toBe("/categoria/acessorios");
    expect(normalizeBannerHref("https://raredept.com.br/categoria/acessorios?ordem=novo#topo")).toBe(
      "/categoria/acessorios?ordem=novo#topo",
    );
    expect(isSafeBannerHref("javascript:alert(1)")).toBe(false);
    expect(isSafeBannerHref("https://evil.example/categoria/acessorios")).toBe(false);

    expect(
      homeBannerInputSchema.safeParse({
        imageUrl: "https://media.rare.example/banners/banner.webp",
        alt: "",
        active: true,
        sortOrder: 0,
      }).success,
    ).toBe(false);
  });

  it("stores same-origin absolute URLs as internal paths", () => {
    const parsed = homeBannerInputSchema.parse({
      ctaLabel: "Comprar",
      href: "https://raredept.com.br/categoria/camisetas",
      imageUrl: "",
      alt: "",
      active: true,
      sortOrder: 0,
    });

    expect(parsed.href).toBe("/categoria/camisetas");
  });
});
