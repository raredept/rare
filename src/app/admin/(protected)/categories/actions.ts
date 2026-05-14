"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { categoryFormSchema } from "@/lib/validators";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

export async function saveCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const parsed = categoryFormSchema.parse({
    name: value(formData, "name"),
    slug: value(formData, "slug"),
    parentId: value(formData, "parentId") || undefined,
    sortOrder: Number(value(formData, "sortOrder") || 0),
    active: formData.get("active") === "on",
  });
  const slug = parsed.slug ? slugify(parsed.slug) : slugify(parsed.name);

  if (id) {
    await prisma.category.update({
      where: { id },
      data: {
        name: parsed.name,
        slug,
        parentId: parsed.parentId,
        sortOrder: parsed.sortOrder,
        active: parsed.active,
      },
    });
  } else {
    await prisma.category.create({
      data: {
        name: parsed.name,
        slug,
        parentId: parsed.parentId,
        sortOrder: parsed.sortOrder,
        active: parsed.active,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/categories");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  await prisma.category.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/categories");
}

export async function toggleCategoryActiveAction(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id");
  const active = value(formData, "active") === "true";
  await prisma.category.update({ where: { id }, data: { active: !active } });
  revalidatePath("/");
  revalidatePath("/admin/categories");
}
