"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { homeBannerInputSchema } from "@/lib/home-banners";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function bannerListPath(params?: { editId?: string; success?: string; error?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.editId) searchParams.set("edit", params.editId);
  if (params?.success) searchParams.set("success", params.success);
  if (params?.error) searchParams.set("error", params.error);
  const query = searchParams.toString();
  return `/admin/banners${query ? `?${query}` : ""}`;
}

function redirectWithBannerError(message: string, editId?: string): never {
  redirect(bannerListPath({ editId, error: message }));
}

function revalidateBannerPaths() {
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

async function getNextSortOrder() {
  const lastBanner = await prisma.homeBannerSlide.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return (lastBanner?.sortOrder ?? -10) + 10;
}

async function normalizeSortOrdersWithout(idToRemove?: string) {
  const banners = await prisma.homeBannerSlide.findMany({
    where: idToRemove ? { id: { not: idToRemove } } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  return banners.map((banner, index) =>
    prisma.homeBannerSlide.update({
      where: { id: banner.id },
      data: { sortOrder: index * 10 },
    }),
  );
}

async function parseBannerForm(formData: FormData, editId?: string) {
  const fallbackSortOrder = text(formData, "sortOrder") || String(await getNextSortOrder());
  const parsed = homeBannerInputSchema.safeParse({
    eyebrow: text(formData, "eyebrow"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    ctaLabel: text(formData, "ctaLabel"),
    href: text(formData, "href"),
    imageUrl: text(formData, "imageUrl"),
    mobileImageUrl: text(formData, "mobileImageUrl"),
    alt: text(formData, "alt"),
    active: formData.get("active") === "on",
    sortOrder: Number(fallbackSortOrder),
  });

  if (!parsed.success) {
    redirectWithBannerError(parsed.error.issues[0]?.message ?? "Nao foi possivel salvar o banner.", editId);
  }

  return parsed.data;
}

export async function createBannerAction(formData: FormData) {
  await requireAdmin();
  const parsed = await parseBannerForm(formData);

  const banner = await prisma.homeBannerSlide.create({
    data: parsed,
  });

  revalidateBannerPaths();
  redirect(bannerListPath({ editId: banner.id, success: "banner-created" }));
}

export async function updateBannerAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) redirectWithBannerError("Banner nao encontrado.");

  const parsed = await parseBannerForm(formData, id);

  await prisma.homeBannerSlide.update({
    where: { id },
    data: parsed,
  });

  revalidateBannerPaths();
  redirect(bannerListPath({ editId: id, success: "banner-saved" }));
}

export async function toggleBannerActiveAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const active = text(formData, "active") === "true";

  const banner = await prisma.homeBannerSlide.update({
    where: { id },
    data: { active: !active },
  });

  revalidateBannerPaths();
  redirect(bannerListPath({ success: banner.active ? "banner-visible" : "banner-hidden" }));
}

export async function deleteBannerAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) redirectWithBannerError("Banner nao encontrado.");

  await prisma.$transaction([prisma.homeBannerSlide.delete({ where: { id } }), ...(await normalizeSortOrdersWithout(id))]);

  revalidateBannerPaths();
  redirect(bannerListPath({ success: "banner-removed" }));
}

async function moveBanner(id: string, direction: "up" | "down") {
  const banners = await prisma.homeBannerSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = banners.findIndex((banner) => banner.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= banners.length) {
    return false;
  }

  const reordered = [...banners];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

  await prisma.$transaction(
    reordered.map((banner, nextIndex) =>
      prisma.homeBannerSlide.update({
        where: { id: banner.id },
        data: { sortOrder: nextIndex * 10 },
      }),
    ),
  );

  return true;
}

export async function moveBannerUpAction(formData: FormData) {
  await requireAdmin();
  await moveBanner(text(formData, "id"), "up");
  revalidateBannerPaths();
  redirect(bannerListPath({ success: "banner-reordered" }));
}

export async function moveBannerDownAction(formData: FormData) {
  await requireAdmin();
  await moveBanner(text(formData, "id"), "down");
  revalidateBannerPaths();
  redirect(bannerListPath({ success: "banner-reordered" }));
}
