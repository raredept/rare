import { Prisma } from "@prisma/client";
import { accessoryCatalogSubcategories } from "@/lib/catalog-categories";
import { prisma } from "@/lib/prisma";

export const productInclude = {
  category: true,
  subcategory: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { size: "asc" } },
} satisfies Prisma.ProductInclude;

const accessorySubcategoryOrder = new Map(accessoryCatalogSubcategories.map((category, index) => [category.slug, index]));

export async function getNavigationCategories() {
  const categories = await prisma.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      children: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return categories.map((category) => {
    if (category.slug !== "acessorios") return category;

    return {
      ...category,
      children: [...category.children].sort((first, second) => {
        const firstOrder = accessorySubcategoryOrder.get(first.slug) ?? Number.MAX_SAFE_INTEGER;
        const secondOrder = accessorySubcategoryOrder.get(second.slug) ?? Number.MAX_SAFE_INTEGER;
        return firstOrder - secondOrder || first.sortOrder - second.sortOrder || first.name.localeCompare(second.name);
      }),
    };
  });
}

export async function getProducts(params?: { query?: string; categorySlug?: string; featuredOnly?: boolean }) {
  const query = params?.query?.trim();
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(params?.featuredOnly ? { featured: true } : {}),
  };

  const and: Prisma.ProductWhereInput[] = [];

  if (query) {
    and.push({
      OR: [
      { title: { contains: query, mode: "insensitive" } },
      { brand: { contains: query, mode: "insensitive" } },
      { category: { name: { contains: query, mode: "insensitive" } } },
      { subcategory: { name: { contains: query, mode: "insensitive" } } },
      ],
    });
  }

  if (params?.categorySlug) {
    and.push({
      OR: [{ category: { slug: params.categorySlug } }, { subcategory: { slug: params.categorySlug } }],
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
}
