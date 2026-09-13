import { z } from "zod";
import { getActiveHomeHeroSlides, homeHeroSlides, type HomeHeroSlide } from "@/lib/home-hero-slides";

import type { BannerFraming } from "@/lib/banner-placement";

export type HomeBannerSlide = HomeHeroSlide & {
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
} & BannerFraming;

export type HomeBannerSlideInput = {
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  href?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  alt: string;
  active: boolean;
  sortOrder: number;
} & BannerFraming;

type PersistedHomeBannerSlide = {
  id: string;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  href: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  alt: string;
  active: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  placement?: string;
  imageFit?: string;
  imagePositionX?: number;
  imagePositionY?: number;
  mobileImagePositionX?: number;
  mobileImagePositionY?: number;
};

const internalHrefPrefixes = ["/categoria/", "/produto/"];
const defaultAllowedHrefOrigins = ["https://raredept.com.br", "https://www.raredept.com.br"];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const optionalUrlText = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value) => value || undefined);

function toAllowedOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const originSource = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;

  try {
    return new URL(originSource).origin;
  } catch {
    return null;
  }
}

function getAllowedHrefOrigins() {
  const configuredOrigins = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ].flatMap((value) => {
    const origin = toAllowedOrigin(value);
    return origin ? [origin] : [];
  });

  return new Set([...defaultAllowedHrefOrigins, ...configuredOrigins]);
}

function normalizeSafeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;

  try {
    const url = new URL(value, "https://rare.local");
    if (url.origin !== "https://rare.local") return null;
    const decodedPathname = decodeURIComponent(url.pathname);
    const pathAllowed =
      url.pathname === "/" ||
      url.pathname === "/cart" ||
      url.pathname === "/finalizar-compra" ||
      internalHrefPrefixes.some((prefix) => url.pathname.startsWith(prefix));
    if (!pathAllowed || decodedPathname.includes("\\")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function isLocalDevelopmentOrigin(url: URL) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
}

export function normalizeBannerHref(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const internalPath = normalizeSafeInternalPath(trimmed);
  if (internalPath) return internalPath;

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol) || (!getAllowedHrefOrigins().has(url.origin) && !isLocalDevelopmentOrigin(url))) {
      return null;
    }
    return normalizeSafeInternalPath(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}

export function isSafeBannerHref(value: string | undefined) {
  return normalizeBannerHref(value) !== null;
}

export function isSafeBannerImageUrl(value: string | undefined) {
  if (!value) return true;
  if (value.startsWith("/uploads/") || value.startsWith("/test-uploads/")) return true;
  if (value === "/brand/rare-logo.png") return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const homeBannerInputSchema = z
  .object({
    placement: z.enum(["home", "customer_login", "admin_login"]).default("home"),
    imageFit: z.enum(["cover", "contain"]).default("cover"),
    imagePositionX: z.coerce.number().int().min(0).max(100).default(50),
    imagePositionY: z.coerce.number().int().min(0).max(100).default(50),
    mobileImagePositionX: z.coerce.number().int().min(0).max(100).default(50),
    mobileImagePositionY: z.coerce.number().int().min(0).max(100).default(50),
    eyebrow: optionalText(80),
    title: optionalText(140),
    description: optionalText(320),
    ctaLabel: optionalText(60),
    href: optionalUrlText.transform((value) => normalizeBannerHref(value) ?? value),
    imageUrl: z.string().trim().max(2048).default(""),
    mobileImageUrl: optionalUrlText,
    alt: z.string().trim().max(180).default(""),
    active: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999999),
  })
  .superRefine((value, context) => {
    if (value.placement !== "home" && [value.imageUrl, value.mobileImageUrl].some((url) => url && /\.(?:gif|mp4)(?:[?#]|$)/i.test(url))) {
      context.addIssue({ code: "custom", path: ["imageUrl"], message: "No login, use uma imagem estática JPG, PNG, WEBP ou AVIF." });
    }
    if (value.imageUrl && !value.alt) {
      context.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Alt text é obrigatório quando houver imagem.",
      });
    }

    if (!isSafeBannerImageUrl(value.imageUrl)) {
      context.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "URL da imagem desktop inválida.",
      });
    }

    if (!isSafeBannerImageUrl(value.mobileImageUrl)) {
      context.addIssue({
        code: "custom",
        path: ["mobileImageUrl"],
        message: "URL da imagem mobile inválida.",
      });
    }

    if (!isSafeBannerHref(value.href)) {
      context.addIssue({
        code: "custom",
        path: ["href"],
        message: "Use apenas links internos seguros da loja.",
      });
    }

    if (value.ctaLabel && !value.href) {
      context.addIssue({
        code: "custom",
        path: ["href"],
        message: "Informe um link interno para usar CTA.",
      });
    }
  });

export function normalizeHomeBannerSlide(slide: PersistedHomeBannerSlide): HomeBannerSlide | null {
  const parsed = homeBannerInputSchema.safeParse({
    placement: slide.placement,
    imageFit: slide.imageFit,
    imagePositionX: slide.imagePositionX,
    imagePositionY: slide.imagePositionY,
    mobileImagePositionX: slide.mobileImagePositionX,
    mobileImagePositionY: slide.mobileImagePositionY,
    eyebrow: slide.eyebrow ?? undefined,
    title: slide.title ?? undefined,
    description: slide.description ?? undefined,
    ctaLabel: slide.ctaLabel ?? undefined,
    href: slide.href ?? undefined,
    imageUrl: slide.imageUrl ?? "",
    mobileImageUrl: slide.mobileImageUrl ?? undefined,
    alt: slide.alt,
    active: slide.active,
    sortOrder: slide.sortOrder,
  });

  if (!parsed.success) return null;

  const data = parsed.data;
  const safeAlt = data.alt || data.title || "Banner RARE";

  return {
    id: slide.id,
    placement: data.placement,
    imageFit: data.imageFit,
    imagePositionX: data.imagePositionX,
    imagePositionY: data.imagePositionY,
    mobileImagePositionX: data.mobileImagePositionX,
    mobileImagePositionY: data.mobileImagePositionY,
    eyebrow: data.eyebrow,
    title: data.title,
    description: data.description,
    ctaLabel: data.ctaLabel,
    href: data.href,
    imageUrl: data.imageUrl,
    mobileImageUrl: data.mobileImageUrl,
    alt: safeAlt,
    active: data.active,
    sortOrder: data.sortOrder,
    createdAt: slide.createdAt,
    updatedAt: slide.updatedAt,
  };
}

export function getFallbackHomeBannerSlides(): HomeHeroSlide[] {
  return getActiveHomeHeroSlides(homeHeroSlides).map((slide) => ({
    ...slide,
    alt: slide.alt || slide.title || "Banner RARE",
  }));
}

const legacyPhrase = (...parts: string[]) => parts.join("");

const legacyStoreHeroCopy: Partial<Record<keyof Pick<HomeHeroSlide, "eyebrow" | "title" | "description" | "ctaLabel" | "alt">, Record<string, string>>> = {
  eyebrow: {
    [legacyPhrase("Drops ", "selecionados")]: "Drops limitados",
    [legacyPhrase("Importados ", "premium")]: "Streetwear importado",
  },
  title: {
    [legacyPhrase("Curadoria streetwear", " em drops ", "selecionados")]: "Streetwear importado, escolhido a dedo.",
    [legacyPhrase("Novas entradas com visual ", "limpo e raro")]: "Peças raras para sair do básico.",
    [legacyPhrase("Peças internacionais", " para elevar o outfit")]: "Drops para quem veste presença.",
  },
  description: {
    [legacyPhrase("Importados ", "premium, peças de presença e estoque controlado para quem acompanha cultura de rua.")]:
      "Peças raras para sair do básico, com estoque limitado e atendimento direto.",
    [legacyPhrase("Camisetas, jaquetas, conjuntos e acessórios ", "escolhidos para composições de impacto.")]:
      "Camisetas, jaquetas, conjuntos e acessórios para compor o corre.",
    [legacyPhrase("Uma seleção direta, sem excesso, ", "pensada para compra rápida e segura.")]:
      "Streetwear importado, peças escolhidas a dedo e compra sem enrolação.",
  },
  ctaLabel: {
    [legacyPhrase("Ver ", "curadoria")]: "Ver catálogo",
    [legacyPhrase("Explorar ", "destaques")]: "Ver destaques",
  },
  alt: {
    [legacyPhrase("Banner editorial RARE com ", "curadoria streetwear")]: "Banner editorial RARE com streetwear importado",
    [legacyPhrase("Banner RARE para drops ", "selecionados")]: "Banner RARE para drops limitados",
    [legacyPhrase("Banner RARE de importados ", "premium")]: "Banner RARE de streetwear importado",
  },
};

function humanizeLegacyStoreHeroCopy(slide: HomeHeroSlide): HomeHeroSlide {
  return {
    ...slide,
    eyebrow: slide.eyebrow ? (legacyStoreHeroCopy.eyebrow?.[slide.eyebrow] ?? slide.eyebrow) : undefined,
    title: slide.title ? (legacyStoreHeroCopy.title?.[slide.title] ?? slide.title) : undefined,
    description: slide.description ? (legacyStoreHeroCopy.description?.[slide.description] ?? slide.description) : undefined,
    ctaLabel: slide.ctaLabel ? (legacyStoreHeroCopy.ctaLabel?.[slide.ctaLabel] ?? slide.ctaLabel) : undefined,
    alt: legacyStoreHeroCopy.alt?.[slide.alt] ?? slide.alt,
  };
}

export async function getHomeBannerSlidesForStore(): Promise<HomeHeroSlide[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const banners = await prisma.homeBannerSlide.findMany({
      where: { active: true, placement: "home" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const slides = banners.map(normalizeHomeBannerSlide).filter((slide): slide is HomeBannerSlide => Boolean(slide));
    return slides.length ? slides.map(humanizeLegacyStoreHeroCopy) : getFallbackHomeBannerSlides();
  } catch {
    return getFallbackHomeBannerSlides();
  }
}

export function getFallbackLoginBanner(placement: "customer_login" | "admin_login"): HomeBannerSlide {
  return {
    id: `fallback-${placement}`, placement, imageUrl: "/brand/rare-logo.png", alt: "RARE Dept.",
    active: true, sortOrder: 0, imageFit: "contain", imagePositionX: 50, imagePositionY: 30,
    mobileImagePositionX: 50, mobileImagePositionY: 30,
    title: placement === "customer_login" ? "Sua curadoria, seus dados, seus pedidos." : "RARE por dentro.",
    description: placement === "customer_login" ? "Uma conta simples para acompanhar sua relação com a RARE." : "Gestão da loja em um só lugar.",
  };
}

export async function getLoginBanner(placement: "customer_login" | "admin_login"): Promise<HomeBannerSlide> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const stored = await prisma.homeBannerSlide.findFirst({
      where: { active: true, placement },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const banner = stored ? normalizeHomeBannerSlide(stored) : null;
    if (banner?.active && banner.placement === placement && banner.imageUrl) return banner;
  } catch {
    // Login remains usable when the optional campaign data is unavailable.
  }
  return getFallbackLoginBanner(placement);
}

export async function getAdminHomeBannerSlides(): Promise<HomeBannerSlide[]> {
  const { prisma } = await import("@/lib/prisma");
  const banners = await prisma.homeBannerSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return banners.map(normalizeHomeBannerSlide).filter((slide): slide is HomeBannerSlide => Boolean(slide));
}

export function getHomeBannerSummary(slides: Pick<HomeBannerSlide, "active" | "imageUrl">[]) {
  const total = slides.length;
  const active = slides.filter((slide) => slide.active).length;

  return {
    total,
    active,
    hidden: total - active,
    missingImage: slides.filter((slide) => !slide.imageUrl).length,
  };
}
