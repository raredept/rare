import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/auth";

// Every Admin page checks the session itself; the page logic is what is under test here.
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN" })) }));

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
  HomeBannerForm: ({ banner, error, nextSortOrder }: { banner?: { id: string }; error?: string; nextSortOrder: number }) =>
    createElement(
      "form",
      { "data-testid": "home-banner-form", "data-next-sort-order": nextSortOrder },
      banner ? `Editando ${banner.id}` : "Novo banner",
      error,
    ),
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
  it("renders the empty state and creation form with absent searchParams", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([]);

    const { default: BannersPage } = await import("@/app/admin/(protected)/banners/page");
    const element = await BannersPage({});
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Banners da Home");
    expect(html).toContain("Gerencie a vitrine, o acesso do cliente e o acesso Admin nesta mesma área.");
    expect(html).toContain("Nenhum banner cadastrado.");
    expect(html).toContain("Crie o primeiro banner para destacar drops e campanhas na home.");
    expect(html).toContain("Novo banner");
    expect(html).toContain('data-next-sort-order="0"');
    expect(requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.prisma.homeBannerSlide.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }, 30000);

  it("preserves editing, errors, banner cards and actions from promised searchParams", async () => {
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
    const element = await BannersPage({
      searchParams: Promise.resolve({ edit: "banner-1", error: "Revise <banner>" }),
    });
    const html = renderToStaticMarkup(element as ReactElement);

    expect(html).toContain("Total de banners");
    expect(html).toContain("Ativo");
    expect(html).toContain("Oculto");
    expect(html).toContain("Sem imagem");
    expect(html).toContain("Drop selecionado");
    expect(html).toContain("Editando banner-1");
    expect(html).toContain("Revise &lt;banner&gt;");
    expect(html).not.toContain("Revise <banner>");
    expect(html).toContain('data-next-sort-order="20"');
    expect(html).toContain("Remover");
    expect(html).toContain("Subir");
    expect(html).toContain("Descer");
    expect(requireAdmin).toHaveBeenCalledOnce();
  }, 30000);

  it("authorizes before loading banners with absent searchParams", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error("Unauthorized"));
    const { default: BannersPage } = await import("@/app/admin/(protected)/banners/page");

    await expect(BannersPage({})).rejects.toThrow("Unauthorized");
    expect(mocks.prisma.homeBannerSlide.findMany).not.toHaveBeenCalled();
  });
});
