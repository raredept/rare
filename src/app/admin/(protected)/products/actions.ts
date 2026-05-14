"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeProductImageUrls, resolveProductImageSubmission } from "@/lib/admin-product-images";
import { parseMoneyToCents } from "@/lib/money";
import { requireAdmin } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/storage";
import { productFormSchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";

function productFormPath(productId: string | null) {
  return productId ? `/admin/products/${productId}/edit` : "/admin/products/new";
}

function redirectWithProductFormError(productId: string | null, message: string): never {
  redirect(`${productFormPath(productId)}?error=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseOptionalPositiveInt(formData: FormData, key: string) {
  const raw = getString(formData, key).trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : Number.NaN;
}

function parseImageUrls(formData: FormData) {
  return normalizeProductImageUrls(getString(formData, "imageUrls").split(/\r?\n/));
}

type ProductRevalidationData = {
  id: string;
  slug: string;
  category: { slug: string } | null;
  subcategory: { slug: string } | null;
};

function revalidateProductPaths(product: ProductRevalidationData, previousProduct?: ProductRevalidationData | null) {
  revalidatePath("/");
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
  sku: string | null;
};

function parseVariants(formData: FormData): ParsedVariant[] {
  const lines = getString(formData, "variants")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seenSizes = new Set<string>();

  return lines.map((line) => {
    const [sizePart, stockPart, skuPart] = line.split(":");
    const size = sizePart?.trim();
    const stock = Number(stockPart ?? 0);
    if (!size || !Number.isInteger(stock) || stock < 0) {
      throw new Error("Use uma variação por linha no formato Tamanho:Estoque ou Tamanho:Estoque:SKU.");
    }
    const normalizedSize = size.toLowerCase();
    if (seenSizes.has(normalizedSize)) {
      throw new Error("Existe variação duplicada. Use cada tamanho apenas uma vez.");
    }
    seenSizes.add(normalizedSize);
    return {
      size,
      stock,
      sku: skuPart?.trim() || null,
    };
  });
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
  await requireAdmin();

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
    weightGrams: parseOptionalPositiveInt(formData, "weightGrams"),
    lengthCm: parseOptionalPositiveInt(formData, "lengthCm"),
    widthCm: parseOptionalPositiveInt(formData, "widthCm"),
    heightCm: parseOptionalPositiveInt(formData, "heightCm"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
    sortOrder: Number(getString(formData, "sortOrder") || 0),
  });

  if (!parsedResult.success) {
    redirectWithProductFormError(productId, "Revise os campos obrigatórios do produto.");
  }

  const parsed = parsedResult.data;
  const slug = parsed.slug ? slugify(parsed.slug) : slugify(title);
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

  const savedProduct = await prisma.$transaction(async (tx) => {
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
            sortOrder: parsed.sortOrder,
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
            sortOrder: parsed.sortOrder,
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

  revalidateProductPaths(savedProduct, previousProduct);
  redirect(`/admin/products/${savedProduct.id}/edit?success=${productId ? "product-saved" : "product-created"}`);
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const active = getString(formData, "active") === "true";
  const product = await prisma.product.update({
    where: { id },
    data: { active: !active },
    include: {
      category: { select: { slug: true } },
      subcategory: { select: { slug: true } },
    },
  });
  revalidateProductPaths(product);
  redirect(`/admin/products?success=${product.active ? "product-visible" : "product-hidden"}`);
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
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
  redirect("/admin/products?success=product-deleted");
}
