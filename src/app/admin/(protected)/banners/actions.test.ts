import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  prisma: {
    homeBannerSlide: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

function buildBannerFormData(overrides: Record<string, string | boolean> = {}) {
  const formData = new FormData();
  formData.set("eyebrow", "RARE");
  formData.set("title", "Drop novo");
  formData.set("description", "Campanha principal da home.");
  formData.set("ctaLabel", "Ver drop");
  formData.set("href", "/categoria/camisetas");
  formData.set("imageUrl", "https://media.rare.example/banners/drop.webp");
  formData.set("mobileImageUrl", "");
  formData.set("alt", "Banner do drop novo");
  formData.set("sortOrder", "10");
  formData.set("active", "on");

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "boolean") {
      if (value) formData.set(key, "on");
      else formData.delete(key);
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.prisma.homeBannerSlide.create.mockResolvedValue({ id: "banner-1" });
  mocks.prisma.homeBannerSlide.update.mockResolvedValue({ id: "banner-1", active: false });
  mocks.prisma.homeBannerSlide.delete.mockResolvedValue({ id: "banner-1" });
  mocks.prisma.homeBannerSlide.findMany.mockResolvedValue([]);
  mocks.prisma.$transaction.mockResolvedValue([]);
});

describe("home banner admin actions", () => {
  it("creates a banner, revalidates home/admin paths and redirects with success", async () => {
    const { createBannerAction } = await import("@/app/admin/(protected)/banners/actions");

    await expect(createBannerAction(buildBannerFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/admin/banners?edit=banner-1&success=banner-created",
    );

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.homeBannerSlide.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Drop novo",
        href: "/categoria/camisetas",
        imageUrl: "https://media.rare.example/banners/drop.webp",
        alt: "Banner do drop novo",
        active: true,
        sortOrder: 10,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/banners");
  }, 30000);

  it("rejects unsafe hrefs before persisting", async () => {
    const { createBannerAction } = await import("@/app/admin/(protected)/banners/actions");

    await expect(createBannerAction(buildBannerFormData({ href: "https://evil.example/campaign" }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/banners?error=Use+apenas+links+internos+seguros+da+loja.",
    );

    expect(mocks.prisma.homeBannerSlide.create).not.toHaveBeenCalled();
  }, 30000);

  it("normalizes same-store absolute hrefs before persisting", async () => {
    const { createBannerAction } = await import("@/app/admin/(protected)/banners/actions");

    await expect(createBannerAction(buildBannerFormData({ href: "https://raredept.com.br/categoria/camisetas" }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/banners?edit=banner-1&success=banner-created",
    );

    expect(mocks.prisma.homeBannerSlide.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        href: "/categoria/camisetas",
      }),
    });
  }, 30000);

  it("updates and toggles banners with revalidation", async () => {
    const { toggleBannerActiveAction, updateBannerAction } = await import("@/app/admin/(protected)/banners/actions");
    const formData = buildBannerFormData();
    formData.set("id", "banner-1");

    await expect(updateBannerAction(formData)).rejects.toThrow("NEXT_REDIRECT:/admin/banners?edit=banner-1&success=banner-saved");
    expect(mocks.prisma.homeBannerSlide.update).toHaveBeenCalledWith({
      where: { id: "banner-1" },
      data: expect.objectContaining({ title: "Drop novo" }),
    });

    const toggleData = new FormData();
    toggleData.set("id", "banner-1");
    toggleData.set("active", "true");
    await expect(toggleBannerActiveAction(toggleData)).rejects.toThrow("NEXT_REDIRECT:/admin/banners?success=banner-hidden");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  }, 30000);

  it("moves banners by rebuilding stable sort orders", async () => {
    mocks.prisma.homeBannerSlide.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const { moveBannerDownAction } = await import("@/app/admin/(protected)/banners/actions");
    const formData = new FormData();
    formData.set("id", "a");

    await expect(moveBannerDownAction(formData)).rejects.toThrow("NEXT_REDIRECT:/admin/banners?success=banner-reordered");

    expect(mocks.prisma.homeBannerSlide.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { sortOrder: 0 } });
    expect(mocks.prisma.homeBannerSlide.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { sortOrder: 10 } });
    expect(mocks.prisma.homeBannerSlide.update).toHaveBeenCalledWith({ where: { id: "c" }, data: { sortOrder: 20 } });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  }, 30000);
});
