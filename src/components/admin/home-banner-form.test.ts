import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeBannerForm } from "@/components/admin/home-banner-form";

vi.mock("@/app/admin/(protected)/banners/actions", () => ({
  createBannerAction: "/admin/banners/create",
  updateBannerAction: "/admin/banners/update",
}));

describe("HomeBannerForm", () => {
  it("renders banner fields, static image upload controls and desktop/mobile previews", () => {
    const html = renderToStaticMarkup(
      createElement(HomeBannerForm, {
        nextSortOrder: 10,
        banner: {
          id: "banner-1",
          eyebrow: "RARE",
          title: "Drop selecionado",
          description: "Campanha principal da home.",
          ctaLabel: "Ver drop",
          href: "/categoria/camisetas",
          imageUrl: "https://media.rare.example/banners/drop.webp",
          mobileImageUrl: "https://media.rare.example/banners/drop-mobile.webp",
          alt: "Banner do drop selecionado",
          active: true,
          sortOrder: 10,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Editar banner");
    expect(html).toContain("Imagem desktop");
    expect(html).toContain("Imagem mobile opcional");
    expect(html).toContain("accept=\"image/jpeg,image/png,image/webp\"");
    expect(html).toContain("Preview desktop");
    expect(html).toContain("Preview mobile");
    expect(html).toContain("Avançado: URLs manuais");
    expect(html).toContain("Salvar banner");
    expect(html).toContain("JPG, PNG ou WEBP até 100 MB.");
    expect(html).toContain("1920x650 desktop e 1080x1350 mobile");
  });

  it("shows an active placeholder warning when a banner has no image", () => {
    const html = renderToStaticMarkup(createElement(HomeBannerForm, { nextSortOrder: 0 }) as ReactElement);

    expect(html).toContain("Novo banner");
    expect(html).toContain("Banner ativo sem imagem usa o placeholder premium da home.");
    expect(html).toContain("Placeholder RARE");
  });
});
