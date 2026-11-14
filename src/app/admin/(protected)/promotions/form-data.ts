import type { Promotion } from "@prisma/client";
import type { PromotionFormValues } from "@/components/admin/promotion-form";
import { getAdminCategoryFilterLabel, sortAdminCategoryFilterOptions } from "@/lib/admin-category-options";
import { toBusinessInputValue } from "@/lib/business-time";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function loadPromotionFormOptions() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, title: true, priceInCents: true, active: true, categoryId: true, subcategoryId: true },
      orderBy: [{ active: "desc" }, { title: "asc" }],
      take: 2000,
    }),
    prisma.category.findMany({ include: { parent: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return {
    products,
    categories: sortAdminCategoryFilterOptions(categories).map((category) => ({ id: category.id, label: getAdminCategoryFilterLabel(category) })),
  };
}

export function toFormValues(promotion?: Promotion & { products: { productId: string }[]; categories: { categoryId: string }[] }): PromotionFormValues {
  if (!promotion) {
    return {
      name: "", slug: "", type: "PERCENTAGE", value: "", scope: "SELECTED_PRODUCTS", startsAt: "", endsAt: "", priority: 0, homepageFeatured: false,
      badgeText: "", headline: "", subheadline: "", ctaLabel: "", ctaHref: "", bannerImageUrl: "", bannerMobileImageUrl: "", bannerAlt: "", productIds: [], categoryIds: [],
    };
  }
  return {
    id: promotion.id,
    name: promotion.name,
    slug: promotion.slug,
    type: promotion.type,
    value: promotion.value === null ? "" : promotion.type === "PERCENTAGE" ? String(promotion.value) : formatMoney(promotion.value).replace(/[^\d,.]/g, ""),
    scope: promotion.scope,
    startsAt: toBusinessInputValue(promotion.startsAt),
    endsAt: toBusinessInputValue(promotion.endsAt),
    priority: promotion.priority,
    homepageFeatured: promotion.homepageFeatured,
    badgeText: promotion.badgeText ?? "",
    headline: promotion.headline ?? "",
    subheadline: promotion.subheadline ?? "",
    ctaLabel: promotion.ctaLabel ?? "",
    ctaHref: promotion.ctaHref ?? "",
    bannerImageUrl: promotion.bannerImageUrl ?? "",
    bannerMobileImageUrl: promotion.bannerMobileImageUrl ?? "",
    bannerAlt: promotion.bannerAlt ?? "",
    productIds: promotion.products.map((item) => item.productId),
    categoryIds: promotion.categories.map((item) => item.categoryId),
  };
}
