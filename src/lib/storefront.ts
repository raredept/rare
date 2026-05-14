import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const productInclude = {
  category: true,
  subcategory: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { orderBy: { size: "asc" } },
} satisfies Prisma.ProductInclude;

export async function getNavigationCategories() {
  return prisma.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      children: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
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
