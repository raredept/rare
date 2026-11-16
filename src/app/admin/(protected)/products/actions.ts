"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAdminActionRefresh } from "@/lib/admin-action-refresh";
import { prisma } from "@/lib/prisma";
import { isAllowedProductMediaUrl, normalizeProductImageUrls, resolveProductImageSubmission } from "@/lib/admin-product-images";
import { parseMoneyToCents } from "@/lib/money";
import { requireAdmin } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/storage";
import { ACTIVE_PRODUCT_SHIPPING_DATA_ERROR, hasCompleteProductShippingData, productFormSchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";
import { PRODUCT_SLUG_TAKEN_MESSAGE, UNIQUE_STOCK_LIMIT_MESSAGE } from "@/lib/feedback-messages";
import { isUniqueViolationOn } from "@/lib/prisma-errors";
import { PRODUCT_SHIPPING_LIMITS, type ProductShippingField } from "@/lib/product-shipping-readiness";
import { parseAdminEntityId } from "@/lib/admin-action-input";
import { SKU_TAKEN_MESSAGE, findRepeatedSku, parseSkuInput } from "@/lib/sku";

function productFormPath(productId: string | null) {
  return productId ? `/admin/products/${productId}/edit` : "/admin/products/new";
}

type ShippingDraft = Record<ProductShippingField, string>;

function getShippingDraft(formData: FormData): ShippingDraft {
  return {
    weightGrams: getString(formData, "weightGrams").slice(0, 32),
    lengthCm: getString(formData, "lengthCm").slice(0, 32),
    widthCm: getString(formData, "widthCm").slice(0, 32),
    heightCm: getString(formData, "heightCm").slice(0, 32),
  };
}

function redirectWithProductFormError(productId: string | null, message: string, shippingDraft?: ShippingDraft): never {
  const params = [`error=${encodeURIComponent(message)}`];
  if (shippingDraft) {
    for (const [field, value] of Object.entries(shippingDraft)) params.push(`draft_${field}=${encodeURIComponent(value)}`);
  }
  redirect(withAdminActionRefresh(`${productFormPath(productId)}?${params.join("&")}`));
}

function redirectWithProductsListError(message: string): never {
  redirect(withAdminActionRefresh(`/admin/products?error=${encodeURIComponent(message)}`));
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseOptionalShippingInt(rawValue: string, field: ProductShippingField) {
  const raw = rawValue.trim();
  if (!raw) return { value: undefined };
  const normalized = raw.replace(",", ".");
  const value = Number(normalized);
  const limit = PRODUCT_SHIPPING_LIMITS[field];
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < limit.min || value > limit.max) {
    const labels: Record<ProductShippingField, string> = {
      weightGrams: "Peso",
      lengthCm: "Comprimento",
      widthCm: "Largura",
      heightCm: "Altura",
    };
    return { value: undefined, error: `${labels[field]} deve ser um número inteiro entre ${limit.min} e ${limit.max} ${limit.unit}.` };
  }
  return { value };
}

function parseOptionalFeaturedSortOrder(formData: FormData) {
  const raw = getString(formData, "featuredSortOrder").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return Number.NaN;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : Number.NaN;
}

function parseImageUrls(formData: FormData) {
  return normalizeProductImageUrls(getString(formData, "imageUrls").split(/\r?\n/));
}

async function validateActiveCategorySelection(productId: string | null, categoryId?: string, subcategoryId?: string) {
  const selectedIds = [categoryId, subcategoryId].filter(Boolean) as string[];
  if (!selectedIds.length) return;

  const categories = await prisma.category.findMany({
    where: { id: { in: selectedIds }, active: true },
    select: { id: true, parentId: true },
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  if (categoryId) {
    const category = categoryById.get(categoryId);
    if (!category || category.parentId) {
      redirectWithProductFormError(productId, "Selecione uma categoria ativa.");
    }
  }

  if (subcategoryId) {
    const subcategory = categoryById.get(subcategoryId);
    if (!subcategory || !subcategory.parentId) {
      redirectWithProductFormError(productId, "Selecione uma subcategoria ativa.");
    }
  }
}

type ProductRevalidationData = {
  id: string;
  slug: string;
  category: { slug: string } | null;
  subcategory: { slug: string } | null;
};

function revalidateProductPaths(product: ProductRevalidationData, previousProduct?: ProductRevalidationData | null) {
  revalidatePath("/");
  revalidatePath("/categoria/destaques");
  revalidatePath("/categoria/tudo");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${product.id}/edit`);
  revalidatePath(`/produto/${product.slug}`);

  if (previousProduct?.slug && previousProduct.slug !== product.slug) {
    revalidatePath(`/produto/${previousProduct.slug}`);
  }

  const categorySlugs = new Set(
    [product.category?.slug, product.subcategory?.slug, previousProduct?.category?.slug, previousProduct?.subcategory?.slug].filter(
      Boolean,
    ) as string[],
  );
  for (const slug of categorySlugs) {
    revalidatePath(`/categoria/${slug}`);
  }
}

type ParsedVariant = {
  size: string;
  stock: number;
  /** As typed. Normalized and validated by resolveVariantSkus once the current values are known. */
  rawSku: string;
  sku: string | null;
};

type RawVariantRow = { size: string; stock: string; sku: string };

/**
 * The form sends one row per variant (variantSize / variantStock / variantSku). The older
 * "Tamanho:Estoque:SKU" textarea ("variants") is still read when no row field is present.
 */
function readVariantRows(formData: FormData): { rows: RawVariantRow[]; legacy: boolean } {
  if (formData.has("variantSize")) {
    const sizes = formData.getAll("variantSize");
    const stocks = formData.getAll("variantStock");
    const skus = formData.getAll("variantSku");
    const rows = sizes.map((size, index) => ({
      size: typeof size === "string" ? size : "",
      stock: typeof stocks[index] === "string" ? (stocks[index] as string) : "",
      sku: typeof skus[index] === "string" ? (skus[index] as string) : "",
    }));
    // A row left completely blank (e.g. the empty row of a new product) is not a variant.
    return { rows: rows.filter((row) => row.size.trim() || row.stock.trim() || row.sku.trim()), legacy: false };
  }

  const rows = getString(formData, "variants")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [size = "", stock = "", sku = ""] = line.split(":");
      return { size, stock: stock || "0", sku };
    });
  return { rows, legacy: true };
}

function parseVariants(formData: FormData): ParsedVariant[] {
  const { rows, legacy } = readVariantRows(formData);
  const seenSizes = new Set<string>();

  return rows.map((row) => {
    const size = row.size.trim();
    const stockText = row.stock.trim();
    const stock = Number(stockText);
    if (!size || !/^\d+$/.test(stockText) || !Number.isSafeInteger(stock)) {
      throw new Error(
        legacy
          ? "Use uma variação por linha no formato Tamanho:Estoque ou Tamanho:Estoque:SKU."
          : "Informe tamanho e estoque (número inteiro, 0 ou mais) em cada variação.",
      );
    }
    const normalizedSize = size.toLowerCase();
    if (seenSizes.has(normalizedSize)) {
      throw new Error("Existe variação duplicada. Use cada tamanho apenas uma vez.");
    }
    seenSizes.add(normalizedSize);
    return {
      size,
      stock,
      rawSku: row.sku,
      sku: null,
    };
  });
}

/**
 * Normalizes every submitted SKU and checks it is free. The database unique index still decides
 * a race between two simultaneous saves (handled where the transaction fails).
 */
async function resolveVariantSkus(productId: string | null, variants: ParsedVariant[]): Promise<string | null> {
  const currentVariants = productId
    ? await prisma.productVariant.findMany({ where: { productId }, select: { size: true, sku: true } })
    : [];
  const currentSkuBySize = new Map(currentVariants.map((variant) => [variant.size, variant.sku]));

  for (const variant of variants) {
    const parsed = parseSkuInput(variant.rawSku, currentSkuBySize.get(variant.size));
    if (!parsed.ok) return parsed.error;
    variant.sku = parsed.sku;
  }

  if (findRepeatedSku(variants.map((variant) => variant.sku))) return SKU_TAKEN_MESSAGE;

  const skus = variants.map((variant) => variant.sku).filter((sku): sku is string => Boolean(sku));
  if (!skus.length) return null;
  // Variants of this same product are rewritten in the save itself, so only other products count.
  const owner = await prisma.productVariant.findFirst({
    where: { sku: { in: skus }, ...(productId ? { productId: { not: productId } } : {}) },
    select: { id: true },
  });
  return owner ? SKU_TAKEN_MESSAGE : null;
}

async function collectUploadedUrls(formData: FormData) {
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const urls: string[] = [];
  for (const file of files) {
    const saved = await saveUploadedImage(file);
    urls.push(saved.url);
  }
  return urls;
}

export async function saveProductAction(productId: string | null, formData: FormData) {
  await requireAdmin("commerce.products");
  const normalizedProductId = productId ? parseAdminEntityId(productId) : null;
  if (productId && !normalizedProductId) {
    redirectWithProductsListError("Produto inválido.");
  }
  productId = normalizedProductId;

  let variants: ParsedVariant[];
  try {
    variants = parseVariants(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Revise as variações informadas.";
    redirectWithProductFormError(productId, message);
  }

  if (!variants.length) {
    redirectWithProductFormError(productId, "Cadastre pelo menos uma variação.");
  }

  const title = getString(formData, "title");
  const active = formData.get("active") === "on";
  const featured = formData.get("featured") === "on";
  const featuredSortOrder = featured ? parseOptionalFeaturedSortOrder(formData) : null;
  const shippingDraft = getShippingDraft(formData);
  const shippingFields = {
    weightGrams: parseOptionalShippingInt(shippingDraft.weightGrams, "weightGrams"),
    lengthCm: parseOptionalShippingInt(shippingDraft.lengthCm, "lengthCm"),
    widthCm: parseOptionalShippingInt(shippingDraft.widthCm, "widthCm"),
    heightCm: parseOptionalShippingInt(shippingDraft.heightCm, "heightCm"),
  };
  const shippingFieldError = Object.values(shippingFields).find((result) => result.error)?.error;
  if (shippingFieldError) redirectWithProductFormError(productId, shippingFieldError, shippingDraft);
  const shippingData = {
    weightGrams: shippingFields.weightGrams.value,
    lengthCm: shippingFields.lengthCm.value,
    widthCm: shippingFields.widthCm.value,
    heightCm: shippingFields.heightCm.value,
  };

  if (typeof featuredSortOrder === "number" && Number.isNaN(featuredSortOrder)) {
    redirectWithProductFormError(productId, "Informe uma ordem de destaque inteira maior ou igual a 1, ou deixe em branco.");
  }

  if (active && !hasCompleteProductShippingData(shippingData)) {
    redirectWithProductFormError(productId, ACTIVE_PRODUCT_SHIPPING_DATA_ERROR, shippingDraft);
  }

  const parsedResult = productFormSchema.safeParse({
    title,
    slug: getString(formData, "slug"),
    shortDescription: getString(formData, "shortDescription"),
    description: getString(formData, "description"),
    brand: getString(formData, "brand") || undefined,
    categoryId: getString(formData, "categoryId") || undefined,
    subcategoryId: getString(formData, "subcategoryId") || undefined,
    priceInCents: parseMoneyToCents(formData.get("price")),
    compareAtPriceInCents: parseMoneyToCents(formData.get("compareAtPrice")) || undefined,
    weightGrams: shippingData.weightGrams,
    lengthCm: shippingData.lengthCm,
    widthCm: shippingData.widthCm,
    heightCm: shippingData.heightCm,
    active,
    featured,
    featuredSortOrder,
    sortOrder: Number(getString(formData, "sortOrder") || 0),
    stockPolicy: getString(formData, "stockPolicy") || undefined,
  });

  if (!parsedResult.success) {
    redirectWithProductFormError(productId, "Revise os campos obrigatórios do produto.");
  }

  const parsed = parsedResult.data;
  // A one-of-a-kind piece is one physical unit. More than one would make every "sold" / "reserved"
  // reading ambiguous, so it is refused here instead of surfacing later as an inconsistency.
  if (parsed.stockPolicy === "UNIQUE" && variants.reduce((total, variant) => total + variant.stock, 0) > 1) {
    redirectWithProductFormError(productId, UNIQUE_STOCK_LIMIT_MESSAGE, shippingDraft);
  }
  await validateActiveCategorySelection(productId, parsed.categoryId, parsed.subcategoryId);

  const slug = parsed.slug ? slugify(parsed.slug) : slugify(title);
  // Two products with the same title and no explicit slug collide here. Saying
  // so is the difference between a correctable form error and the store's
  // generic crash page, which also threw away everything the operator typed.
  const slugOwner = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== productId) {
    redirectWithProductFormError(productId, PRODUCT_SLUG_TAKEN_MESSAGE, shippingDraft);
  }
  const skuError = await resolveVariantSkus(productId, variants);
  if (skuError) redirectWithProductFormError(productId, skuError, shippingDraft);
  const previousProduct = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          slug: true,
          category: { select: { slug: true } },
          subcategory: { select: { slug: true } },
        },
      })
    : null;
  const existingImageUrls = parseImageUrls(formData);
  if (!existingImageUrls.every(isAllowedProductMediaUrl)) {
    redirectWithProductFormError(productId, "URL de mídia inválida. Use um caminho do site ou uma URL http(s).");
  }
  let uploadedUrls: string[];
  try {
    uploadedUrls = await collectUploadedUrls(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar imagem enviada.";
    redirectWithProductFormError(productId, message);
  }
  const imageUrls = resolveProductImageSubmission({
    existingImageUrls,
    uploadedUrls,
    replaceImages: formData.get("replaceImages") === "on",
  });

  let savedProduct;
  try {
    savedProduct = await prisma.$transaction(async (tx) => {
    const product = productId
      ? await tx.product.update({
          where: { id: productId },
          data: {
            title: parsed.title,
            slug,
            shortDescription: parsed.shortDescription,
            description: parsed.description,
            brand: parsed.brand,
            categoryId: parsed.categoryId,
            subcategoryId: parsed.subcategoryId,
            priceInCents: parsed.priceInCents,
            compareAtPriceInCents: parsed.compareAtPriceInCents,
            weightGrams: parsed.weightGrams,
            lengthCm: parsed.lengthCm,
            widthCm: parsed.widthCm,
            heightCm: parsed.heightCm,
            active: parsed.active,
            featured: parsed.featured,
            featuredSortOrder: parsed.featured ? parsed.featuredSortOrder : null,
            sortOrder: parsed.sortOrder,
            stockPolicy: parsed.stockPolicy,
          },
          include: {
            category: { select: { slug: true } },
            subcategory: { select: { slug: true } },
          },
        })
      : await tx.product.create({
          data: {
            title: parsed.title,
            slug,
            shortDescription: parsed.shortDescription,
            description: parsed.description,
            brand: parsed.brand,
            categoryId: parsed.categoryId,
            subcategoryId: parsed.subcategoryId,
            priceInCents: parsed.priceInCents,
            compareAtPriceInCents: parsed.compareAtPriceInCents,
            weightGrams: parsed.weightGrams,
            lengthCm: parsed.lengthCm,
            widthCm: parsed.widthCm,
            heightCm: parsed.heightCm,
            active: parsed.active,
            featured: parsed.featured,
            featuredSortOrder: parsed.featured ? parsed.featuredSortOrder : null,
            sortOrder: parsed.sortOrder,
            stockPolicy: parsed.stockPolicy,
          },
          include: {
            category: { select: { slug: true } },
            subcategory: { select: { slug: true } },
          },
        });

    await tx.productImage.deleteMany({ where: { productId: product.id } });
    if (imageUrls.length) {
      await tx.productImage.createMany({
        data: imageUrls.map((url, index) => ({
          productId: product.id,
          url,
          alt: parsed.title,
          sortOrder: index,
        })),
      });
    }

    const existingVariants = await tx.productVariant.findMany({ where: { productId: product.id } });
    const existingBySize = new Map(existingVariants.map((variant) => [variant.size, variant]));
    const submittedSizes = new Set(variants.map((variant) => variant.size));
    const submittedSkuBySize = new Map(variants.map((variant) => [variant.size, variant.sku]));

    // Release first the SKUs this save takes away (changed, cleared or variant removed), so a SKU
    // can move between sizes of the same product and a removed variant no longer holds one.
    const releasedSkuVariantIds = existingVariants
      .filter((variant) => variant.sku && variant.sku !== submittedSkuBySize.get(variant.size))
      .map((variant) => variant.id);
    if (releasedSkuVariantIds.length) {
      await tx.productVariant.updateMany({ where: { id: { in: releasedSkuVariantIds } }, data: { sku: null } });
    }

    for (const variant of variants) {
      const existing = existingBySize.get(variant.size);
      await tx.productVariant.upsert({
        where: {
          productId_size: {
            productId: product.id,
            size: variant.size,
          },
        },
        update: {
          sku: variant.sku,
          stock: Math.max(variant.stock, existing?.reservedStock ?? 0),
          active: true,
        },
        create: {
          productId: product.id,
          size: variant.size,
          sku: variant.sku,
          stock: variant.stock,
          active: true,
        },
      });
    }

    await tx.productVariant.updateMany({
      where: {
        productId: product.id,
        size: { notIn: [...submittedSizes] },
      },
      data: { active: false },
    });

    return product;
  });
  } catch (error) {
    // Another save claimed the slug or a SKU between the checks above and this write.
    if (isUniqueViolationOn(error, "slug")) redirectWithProductFormError(productId, PRODUCT_SLUG_TAKEN_MESSAGE, shippingDraft);
    if (isUniqueViolationOn(error, "sku")) redirectWithProductFormError(productId, SKU_TAKEN_MESSAGE, shippingDraft);
    throw error;
  }

  revalidateProductPaths(savedProduct, previousProduct);
  if (!productId) {
    redirect(withAdminActionRefresh("/admin/products/new?success=product-created"));
  }

  redirect(withAdminActionRefresh(`/admin/products/${savedProduct.id}/edit?success=product-saved`));
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin("commerce.products");
  const id = parseAdminEntityId(formData.get("id"));
  const active = getString(formData, "active") === "true";

  if (!id) redirectWithProductsListError("Produto inválido.");

  if (!active) {
    const productForActivation = await prisma.product.findUnique({
      where: { id },
      select: {
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
      },
    });

    if (!productForActivation || !hasCompleteProductShippingData(productForActivation)) {
      redirectWithProductsListError(ACTIVE_PRODUCT_SHIPPING_DATA_ERROR);
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: { active: !active },
    include: {
      category: { select: { slug: true } },
      subcategory: { select: { slug: true } },
    },
  });
  revalidateProductPaths(product);
  redirect(withAdminActionRefresh(`/admin/products?success=${product.active ? "product-visible" : "product-hidden"}`));
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin("commerce.products");
  const id = parseAdminEntityId(formData.get("id"));
  if (!id) redirectWithProductsListError("Produto inválido.");
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      category: { select: { slug: true } },
      subcategory: { select: { slug: true } },
    },
  });
  await prisma.product.delete({ where: { id } });
  if (product) {
    revalidateProductPaths(product);
  } else {
    revalidatePath("/");
    revalidatePath("/admin/products");
  }
  redirect(withAdminActionRefresh("/admin/products?success=product-deleted"));
}
