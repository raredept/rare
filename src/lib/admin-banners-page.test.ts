import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/admin/home-banner-form", () => ({
  HomeBannerForm: ({ banner }: { banner?: { id: string } }) =>
    createElement("form", { "data-testid": "home-banner-form" }, banner ? `Editando ${banner.id}` : "Novo banner"),
}));

vi.mock("@/app/admin/(protected)/banners/actions", () => ({
  deleteBannerAction: "/admin/banners/delete",
  moveBannerDownAction: "/admin/banners/down",
  moveBannerUpAction: "/admin/banners/up",
  toggleBannerActiveAction: "/admin/banners/toggle",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin banners page", () => {
  it("renders the empty state and creation form", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([]);

    const { default: BannersPage } = await import("@/app/admin/(protected)/banners/page");
    const element = await BannersPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Banners da Home");
    expect(html).toContain("Gerencie os slides principais exibidos na vitrine.");
    expect(html).toContain("Nenhum banner cadastrado.");
    expect(html).toContain("Crie o primeiro banner para destacar drops e campanhas na home.");
    expect(html).toContain("Novo banner");
  }, 30000);

  it("renders banner list cards with status, thumbnails and actions", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([
      {
        id: "banner-1",
        eyebrow: "RARE",
        title: "Drop selecionado",
        description: "Campanha principal da home.",
        ctaLabel: "Ver drop",
        href: "/categoria/camisetas",
        imageUrl: "https://media.rare.example/banners/drop.webp",
        mobileImageUrl: null,
        alt: "Banner do drop selecionado",
        active: true,
        sortOrder: 0,
      },
      {
        id: "banner-2",
        eyebrow: null,
        title: null,
        description: null,
        ctaLabel: null,
        href: null,
        imageUrl: "",
        mobileImageUrl: null,
        alt: "Banner sem imagem",
        active: false,
        sortOrder: 10,
      },
    ]);

    const { default: BannersPage } = await import("@/app/admin/(protected)/banners/page");
    const element = await BannersPage({ searchParams: Promise.resolve({ edit: "banner-1" }) });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Total de banners");
    expect(html).toContain("Ativo");
    expect(html).toContain("Oculto");
    expect(html).toContain("Sem imagem");
    expect(html).toContain("Drop selecionado");
    expect(html).toContain("Editando banner-1");
    expect(html).toContain("Remover");
    expect(html).toContain("Subir");
    expect(html).toContain("Descer");
  }, 30000);
});
