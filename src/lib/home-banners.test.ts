import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFallbackHomeBannerSlides,
  getHomeBannerSlidesForStore,
  getLoginBanner,
  homeBannerInputSchema,
  isSafeBannerHref,
  normalizeBannerHref,
  normalizeHomeBannerSlide,
} from "@/lib/home-banners";

const mocks = vi.hoisted(() => ({
  prisma: {
    homeBannerSlide: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
  it("selects only the active banner for the requested login destination and preserves framing", async () => {
    mocks.prisma.homeBannerSlide.findFirst.mockResolvedValueOnce({
      id: "login-art", placement: "admin_login", imageFit: "contain", imagePositionX: 20, imagePositionY: 70,
      mobileImagePositionX: 80, mobileImagePositionY: 10, imageUrl: "/brand/rare-logo.png", mobileImageUrl: null,
      eyebrow: null, title: "Acesso RARE", description: null, ctaLabel: null, href: null,
      alt: "Logo RARE", active: true, sortOrder: 0,
    });
    expect(await getLoginBanner("admin_login")).toMatchObject({ id: "login-art", imageFit: "contain", imagePositionX: 20, mobileImagePositionY: 10 });
    expect(mocks.prisma.homeBannerSlide.findFirst).toHaveBeenCalledWith({
      where: { active: true, placement: "admin_login" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("keeps login usable with its approved public fallback when campaign data is absent or unavailable", async () => {
    mocks.prisma.homeBannerSlide.findFirst.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Unavailable"));
    for (const destination of ["customer_login", "admin_login"] as const) {
      expect(await getLoginBanner(destination)).toMatchObject({ placement: destination, imageUrl: "/brand/rare-logo.png", imageFit: "contain" });
    }
  });

  it("rejects unsupported login animation, invalid destination and framing outside the image", () => {
    const input = { placement: "customer_login", imageUrl: "/uploads/banner.png", alt: "Banner", active: true, sortOrder: 0 };
    expect(homeBannerInputSchema.safeParse(input).success).toBe(true);
    for (const patch of [{ placement: "private" }, { imagePositionX: 101 }, { imagePositionY: -1 }, { imagePositionY: 4.5 }, { imageUrl: "/uploads/banner.gif" }, { mobileImageUrl: "/uploads/banner.mp4" }]) {
      expect(homeBannerInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });

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
      where: { active: true, placement: "home" },
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
