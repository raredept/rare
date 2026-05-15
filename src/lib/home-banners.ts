import { z } from "zod";
import { getActiveHomeHeroSlides, homeHeroSlides, type HomeHeroSlide } from "@/lib/home-hero-slides";

export type HomeBannerSlide = HomeHeroSlide & {
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
};

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
};

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
};

const internalHrefPrefixes = ["/categoria/", "/produto/"];

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

export function isSafeBannerHref(value: string | undefined) {
  if (!value) return true;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;

  try {
    const url = new URL(value, "https://rare.local");
    if (url.origin !== "https://rare.local") return false;
    return url.pathname === "/" || url.pathname === "/cart" || internalHrefPrefixes.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

export function isSafeBannerImageUrl(value: string | undefined) {
  if (!value) return true;
  if (value.startsWith("/uploads/") || value.startsWith("/test-uploads/")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const homeBannerInputSchema = z
  .object({
    eyebrow: optionalText(80),
    title: optionalText(140),
    description: optionalText(320),
    ctaLabel: optionalText(60),
    href: optionalUrlText,
    imageUrl: z.string().trim().max(2048).default(""),
    mobileImageUrl: optionalUrlText,
    alt: z.string().trim().max(180).default(""),
    active: z.boolean(),
    sortOrder: z.coerce.number().int().min(0).max(999999),
  })
  .superRefine((value, context) => {
    if (value.imageUrl && !value.alt) {
      context.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Alt text e obrigatorio quando houver imagem.",
      });
    }

    if (!isSafeBannerImageUrl(value.imageUrl)) {
      context.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "URL da imagem desktop invalida.",
      });
    }

    if (!isSafeBannerImageUrl(value.mobileImageUrl)) {
      context.addIssue({
        code: "custom",
        path: ["mobileImageUrl"],
        message: "URL da imagem mobile invalida.",
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

export async function getHomeBannerSlidesForStore(): Promise<HomeHeroSlide[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const banners = await prisma.homeBannerSlide.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const slides = banners.map(normalizeHomeBannerSlide).filter((slide): slide is HomeBannerSlide => Boolean(slide));
    return slides.length ? slides : getFallbackHomeBannerSlides();
  } catch {
    return getFallbackHomeBannerSlides();
  }
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
