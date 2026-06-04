import { getProductMediaTypeFromUrl, getProductVideoPoster } from "@/lib/product-media";
import { isVariantPurchasable } from "@/lib/stock";
import { hasCompleteProductShippingData } from "@/lib/validators";

export type CatalogIssueTone = "danger" | "warning" | "muted";

export type CatalogIssue = {
  id: string;
  type:
    | "active-product-no-stock"
    | "active-product-no-media"
    | "active-product-no-purchasable-variant"
    | "inactive-product-incomplete"
    | "active-category-empty"
    | "product-video-only"
    | "product-missing-shipping-data";
  scope: "Produto" | "Categoria";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: CatalogIssueTone;
};

export type CatalogIssueProduct = {
  id: string;
  title: string;
  active: boolean;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  images: Array<{ url: string }>;
  variants: Array<{ active: boolean; stock: number; reservedStock: number }>;
};

export type CatalogIssueCategory = {
  id: string;
  name: string;
  active: boolean;
  _count: {
    products: number;
    subcategoryProducts: number;
  };
};

type BuildCatalogIssuesInput = {
  products: CatalogIssueProduct[];
  categories: CatalogIssueCategory[];
};

function productHref(productId: string) {
  return `/admin/products/${productId}/edit`;
}

function categoryHref(categoryId: string) {
  return `/admin/categories/${categoryId}/edit`;
}

function addProductIssue(issues: CatalogIssue[], product: CatalogIssueProduct, issue: Omit<CatalogIssue, "id" | "scope" | "href" | "actionLabel">) {
  issues.push({
    ...issue,
    id: `${issue.type}:${product.id}`,
    scope: "Produto",
    href: productHref(product.id),
    actionLabel: "Editar produto",
  });
}

function getInactiveProductMissingParts(product: CatalogIssueProduct) {
  const missing: string[] = [];

  if (!product.images.length) missing.push("midia");
  if (!product.variants.length) missing.push("variacao");
  if (!hasCompleteProductShippingData(product)) missing.push("peso e medidas");

  return missing;
}

function collectProductIssues(products: CatalogIssueProduct[]) {
  const issues: CatalogIssue[] = [];

  for (const product of products) {
    const activeVariants = product.variants.filter((variant) => variant.active);
    const hasPurchasableVariant = product.variants.some((variant) => isVariantPurchasable(variant));
    const primaryMedia = product.images[0] ?? null;
    const primaryMediaType = primaryMedia ? getProductMediaTypeFromUrl(primaryMedia.url) : null;

    if (product.active && !hasPurchasableVariant) {
      if (activeVariants.length) {
        addProductIssue(issues, product, {
          type: "active-product-no-stock",
          tone: "danger",
          title: `${product.title} sem estoque disponivel`,
          description: "Produto ativo sem variacao ativa com estoque livre.",
        });
      } else {
        addProductIssue(issues, product, {
          type: "active-product-no-purchasable-variant",
          tone: "danger",
          title: `${product.title} sem variacao compravel`,
          description: "Produto ativo precisa de pelo menos uma variacao ativa e compravel.",
        });
      }
    }

    if (product.active && !primaryMedia) {
      addProductIssue(issues, product, {
        type: "active-product-no-media",
        tone: "warning",
        title: `${product.title} sem midia principal`,
        description: "Produto ativo aparece no catalogo sem imagem ou video principal.",
      });
    }

    if (!product.active) {
      const missingParts = getInactiveProductMissingParts(product);
      if (missingParts.length) {
        addProductIssue(issues, product, {
          type: "inactive-product-incomplete",
          tone: "muted",
          title: `${product.title} inativo com cadastro incompleto`,
          description: `Revise ${missingParts.join(", ")} antes de ativar o produto.`,
        });
      }
    }

    if (primaryMedia && product.images.length === 1 && primaryMediaType === "video" && !getProductVideoPoster(product.images, primaryMedia.url)) {
      addProductIssue(issues, product, {
        type: "product-video-only",
        tone: "warning",
        title: `${product.title} tem apenas video como midia`,
        description: "Inclua uma imagem de fallback para listagens e compartilhamento visual.",
      });
    }

    if (!hasCompleteProductShippingData(product)) {
      addProductIssue(issues, product, {
        type: "product-missing-shipping-data",
        tone: product.active ? "danger" : "warning",
        title: `${product.title} sem peso ou dimensoes completas`,
        description: "Complete peso, altura, largura e comprimento maiores que zero.",
      });
    }
  }

  return issues;
}

function collectCategoryIssues(categories: CatalogIssueCategory[]) {
  const issues: CatalogIssue[] = [];

  for (const category of categories) {
    const linkedProducts = category._count.products + category._count.subcategoryProducts;
    if (!category.active || linkedProducts > 0) continue;

    issues.push({
      id: `active-category-empty:${category.id}`,
      type: "active-category-empty",
      scope: "Categoria",
      tone: "warning",
      title: `${category.name} ativa sem produtos`,
      description: "Categoria ativa nao possui produtos vinculados ao catalogo publico.",
      href: categoryHref(category.id),
      actionLabel: "Editar categoria",
    });
  }

  return issues;
}

export function buildCatalogIssues({ products, categories }: BuildCatalogIssuesInput) {
  return [...collectProductIssues(products), ...collectCategoryIssues(categories)];
}
