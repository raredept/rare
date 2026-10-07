import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginBannerPanel } from "@/components/store/login-banner-panel";
import type { HomeBannerSlide } from "@/lib/home-banners";

const banner: HomeBannerSlide = {
  id: "banner-fixture",
  active: true,
  sortOrder: 0,
  eyebrow: "Conta",
  title: "Título do banner",
  description: "Descrição do banner",
  ctaLabel: "Ver catálogo",
  href: "/categoria/tudo",
  imageUrl: "/fixture-desktop.jpg",
  mobileImageUrl: "/fixture-mobile.jpg",
  alt: "Banner de teste",
  imageFit: "contain",
  imagePositionX: 25,
  imagePositionY: 75,
  mobileImagePositionX: 40,
  mobileImagePositionY: 60,
};

describe("LoginBannerPanel", () => {
  it("preserves the administrative appearance when the variant is omitted", () => {
    const html = renderToStaticMarkup(createElement(LoginBannerPanel, { banner }));
    const explicitDefault = renderToStaticMarkup(createElement(LoginBannerPanel, { banner, variant: "default" }));

    expect(html).toBe(explicitDefault);
    expect(html).toContain('class="relative isolate flex min-h-64 flex-col justify-end overflow-hidden bg-black p-7 text-white sm:p-9 lg:min-h-full"');
    expect(html).toContain('class="text-xs font-black uppercase tracking-widest text-white/80"');
    expect(html).toContain('class="mt-3 max-w-xs text-2xl font-black leading-tight tracking-tight sm:text-3xl"');
    expect(html).toContain('class="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/85"');
    expect(html).toContain('class="mt-4 inline-flex min-h-11 items-center rounded-md border border-white/70 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"');
  });

  it("uses the optional editorial storefront appearance without changing media or its framing", () => {
    const html = renderToStaticMarkup(createElement(LoginBannerPanel, { banner, variant: "storefront" }));

    expect(html).toContain("min-h-72");
    expect(html).not.toContain("font-black");
    expect(html).not.toContain("rounded-md");
    expect(html).toContain('href="/categoria/tudo"');
    expect(html).toContain('media="(max-width: 1023px)" srcSet="/fixture-mobile.jpg"');
    expect(html).toContain('src="/fixture-desktop.jpg"');
    expect(html).toContain('alt="Banner de teste"');
    expect(html).toContain('width="800" height="1000" loading="eager" decoding="async"');
    expect(html).toContain("object-fit:contain;--login-position-desktop:25% 75%;--login-position-mobile:40% 60%");
  });

  it("keeps the optimized local fallback in both variants", () => {
    const fallback = { ...banner, imageUrl: "/brand/rare-logo.png", mobileImageUrl: undefined };
    const defaultHtml = renderToStaticMarkup(createElement(LoginBannerPanel, { banner: fallback }));
    const storefrontHtml = renderToStaticMarkup(createElement(LoginBannerPanel, { banner: fallback, variant: "storefront" }));

    for (const html of [defaultHtml, storefrontHtml]) {
      expect(html).toContain('data-nimg="fill"');
      expect(html).toContain('sizes="(min-width: 1024px) 480px, 100vw"');
      expect(html).toContain("rare-logo.png");
      expect(html).not.toContain("<source");
    }
  });
});
