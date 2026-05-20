"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { categoryFormSchema } from "@/lib/validators";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function categoryFormPath(id: string) {
  return id ? `/admin/categories/${id}/edit` : "/admin/categories";
}

function redirectWithCategoryError(id: string): never {
  redirect(withAdminActionRefresh(`${categoryFormPath(id)}?error=category-save-failed`));
}

function revalidateCategoryPaths(currentSlug?: string, previousSlug?: string | null) {
  revalidatePath("/");
  revalidatePath("/admin/categories");
  if (currentSlug) revalidatePath(`/categoria/${currentSlug}`);
  if (previousSlug && previousSlug !== currentSlug) revalidatePath(`/categoria/${previousSlug}`);
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const parsedResult = categoryFormSchema.safeParse({
    name: value(formData, "name"),
    slug: value(formData, "slug"),
    parentId: value(formData, "parentId") || undefined,
    sortOrder: Number(value(formData, "sortOrder") || 0),
    active: formData.get("active") === "on",
  });

  if (!parsedResult.success) {
    redirectWithCategoryError(id);
  }

  const parsed = parsedResult.data;
  const slug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.name);
  const previousCategory = id ? await prisma.category.findUnique({ where: { id }, select: { slug: true } }) : null;

  const savedCategory = id
    ? await prisma.category.update({
        where: { id },
        data: {
          name: parsed.name,
          slug,
          parentId: parsed.parentId,
          sortOrder: parsed.sortOrder,
          active: parsed.active,
        },
      })
    : await prisma.category.create({
        data: {
          name: parsed.name,
          slug,
          parentId: parsed.parentId,
          sortOrder: parsed.sortOrder,
          active: parsed.active,
        },
      });

  revalidateCategoryPaths(savedCategory.slug, previousCategory?.slug);
  redirect(withAdminActionRefresh(id ? `/admin/categories/${savedCategory.id}/edit?success=category-saved` : "/admin/categories?success=category-created"));
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const category = await prisma.category.findUnique({ where: { id }, select: { slug: true } });
  await prisma.category.delete({ where: { id } });
  revalidateCategoryPaths(undefined, category?.slug);
  redirect(withAdminActionRefresh("/admin/categories?success=category-deleted"));
}

export async function toggleCategoryActiveAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const active = value(formData, "active") === "true";
  const category = await prisma.category.update({ where: { id }, data: { active: !active } });
  revalidateCategoryPaths(category.slug);
  redirect(withAdminActionRefresh(`/admin/categories?success=${category.active ? "category-visible" : "category-hidden"}`));
}
