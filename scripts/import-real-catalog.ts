import "dotenv/config";
import { access } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  accessoryCatalogSubcategories,
  legacyAccessoryCategorySlugs,
  primaryCatalogCategories,
} from "../src/lib/catalog-categories";
import { getDatabaseUrl, isProductionEnv } from "../src/lib/env";
import { DEFAULT_PRODUCT_PACKAGE, DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS } from "../src/lib/shipping";

type CatalogProduct = {
  title: string;
  slug: string;
  brand: string;
  categorySlug: string;
  subcategorySlug?: string;
  priceInCents: number;
  shortDescription: string;
  description: string;
  variants: { size: string; stock: number; sku: string }[];
  featured: boolean;
  sortOrder: number;
  image: {
    url: string;
    alt: string;
  };
};

const products: CatalogProduct[] = [
  {
    title: "Supreme Bag",
    slug: "supreme-bag",
    brand: "Supreme",
    categorySlug: "acessorios",
    subcategorySlug: "bags",
    priceInCents: 52999,
    shortDescription: "Shoulder bag Supreme com visual utilitário e pegada streetwear.",
    description:
      "Shoulder bag Supreme com visual utilitário e pegada streetwear. Modelo compacto em tecido resistente com padrão quadriculado, alça ajustável e fechamento com fivelas frontais. Ideal para o dia a dia, rolês e composições urbanas minimalistas.",
    variants: [{ size: "Único", stock: 1, sku: "RARE-SUPREME-BAG-UN" }],
    featured: true,
    sortOrder: 1,
    image: {
      url: "/uploads/products/bag-supreme.png",
      alt: "Supreme Bag",
    },
  },
  {
    title: "Boné Chrome Hearts",
    slug: "bone-chrome-hearts",
    brand: "Chrome Hearts",
    categorySlug: "acessorios",
    subcategorySlug: "bones",
    priceInCents: 23999,
    shortDescription: "Boné trucker Chrome Hearts na cor preta com estética street/luxury.",
    description:
      "Boné trucker Chrome Hearts na cor preta, com patch frontal bordado e detalhes em mesh respirável. Peça com estética street/luxury, trazendo personalidade e destaque para qualquer composição urbana.",
    variants: [{ size: "Único", stock: 1, sku: "RARE-CHROME-HEARTS-BONE-UN" }],
    featured: true,
    sortOrder: 2,
    image: {
      url: "/uploads/products/bone-chrome.png",
      alt: "Boné Chrome Hearts",
    },
  },
  {
    title: "Jaqueta Nike NOCTA",
    slug: "jaqueta-nike-nocta",
    brand: "Nike NOCTA",
    categorySlug: "jaquetas",
    priceInCents: 48999,
    shortDescription: "Jaqueta corta-vento com design esportivo e estética premium.",
    description:
      "Jaqueta Nike NOCTA corta-vento com design esportivo e estética premium inspirada no lifestyle urbano. Modelo leve, confortável e resistente, com detalhes contrastantes nas mangas e logo bordado no peito. Peça versátil que mistura performance e streetwear em um visual moderno e exclusivo.",
    variants: [{ size: "G", stock: 1, sku: "RARE-NIKE-NOCTA-G" }],
    featured: true,
    sortOrder: 3,
    image: {
      url: "/uploads/products/jaqueta-nocta.png",
      alt: "Jaqueta Nike NOCTA",
    },
  },
  {
    title: "Camiseta BAPE",
    slug: "camiseta-bape",
    brand: "BAPE",
    categorySlug: "camisetas",
    priceInCents: 31999,
    shortDescription: "Camiseta BAPE com estampa frontal em camuflado azul.",
    description:
      "Camiseta BAPE “A Bathing Ape” com estampa frontal icônica em camuflado azul. Modelo com pegada streetwear japonesa, confeccionado em algodão confortável e ideal para composições urbanas autênticas e modernas.",
    variants: [
      { size: "M", stock: 1, sku: "RARE-BAPE-M" },
      { size: "G", stock: 1, sku: "RARE-BAPE-G" },
    ],
    featured: true,
    sortOrder: 4,
    image: {
      url: "/uploads/products/camiseta-bape.png",
      alt: "Camiseta BAPE",
    },
  },
  {
    title: "Camiseta Hellstar",
    slug: "camiseta-hellstar",
    brand: "Hellstar",
    categorySlug: "camisetas",
    priceInCents: 28999,
    shortDescription: "Camiseta Hellstar oversized com estética Y2K e streetwear underground.",
    description:
      "Camiseta Hellstar com estampa gráfica em alta definição e estética inspirada na cultura Y2K e streetwear underground. Modelo oversized em algodão confortável, trazendo um visual marcante e moderno para composições urbanas autênticas.",
    variants: [{ size: "G", stock: 1, sku: "RARE-HELLSTAR-G" }],
    featured: true,
    sortOrder: 5,
    image: {
      url: "/uploads/products/camiseta-hellstar.png",
      alt: "Camiseta Hellstar",
    },
  },
];

const demoSlugsToHide = [
  "bone-supreme",
  "bermuda-adidas",
  "conjunto-nike-tech",
  "calca-high-strapped",
  "bolsa-bag-supreme",
];

let prisma: PrismaClient | null = null;

function getPublicFilePath(url: string) {
  if (!url.startsWith("/uploads/products/")) {
    throw new Error(`URL de imagem fora do diretorio permitido: ${url}`);
  }

  return path.join(process.cwd(), "public", ...url.split("/").filter(Boolean));
}

async function assertProductImagesExist() {
  const missingImages: string[] = [];

  for (const product of products) {
    try {
      await access(getPublicFilePath(product.image.url));
    } catch {
      missingImages.push(`${product.title}: ${product.image.url}`);
    }
  }

  if (missingImages.length) {
    throw new Error(`Imagens locais ausentes: ${missingImages.join("; ")}`);
  }
}

async function upsertCategory(tx: Prisma.TransactionClient, category: { name: string; slug: string; sortOrder: number }, parentId?: string) {
  return tx.category.upsert({
    where: { slug: category.slug },
    update: {
      name: category.name,
      parentId,
      sortOrder: category.sortOrder,
      active: true,
    },
    create: {
      name: category.name,
      slug: category.slug,
      parentId,
      sortOrder: category.sortOrder,
      active: true,
    },
  });
}

async function importCatalog() {
  if (isProductionEnv() && process.env.CONFIRM_REAL_CATALOG_IMPORT !== "true") {
    throw new Error("Importacao do catalogo real bloqueada em producao sem CONFIRM_REAL_CATALOG_IMPORT=true.");
  }

  await assertProductImagesExist();

  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  const result = await prisma.$transaction(async (tx) => {
    const categoryBySlug = new Map<string, { id: string }>();

    for (const category of primaryCatalogCategories) {
      const saved = await upsertCategory(tx, category);
      categoryBySlug.set(category.slug, saved);
    }

    const accessories = categoryBySlug.get("acessorios");
    if (!accessories) throw new Error("Categoria Acessórios nao encontrada.");

    for (const subcategory of accessoryCatalogSubcategories) {
      const saved = await upsertCategory(tx, subcategory, accessories.id);
      categoryBySlug.set(subcategory.slug, saved);
    }

    await tx.category.updateMany({
      where: { slug: { in: [...legacyAccessoryCategorySlugs] } },
      data: { active: false, sortOrder: 90 },
    });

    let productsUpserted = 0;
    let variantsUpserted = 0;
    let productImagesAttached = 0;
    let productImagesAlreadyLinked = 0;
    let primaryImageConflictsDemoted = 0;
    let duplicateExpectedImageRows = 0;

    for (const product of products) {
      const category = categoryBySlug.get(product.categorySlug);
      const subcategory = product.subcategorySlug ? categoryBySlug.get(product.subcategorySlug) : null;
      if (!category) throw new Error(`Categoria ausente para ${product.title}.`);
      if (product.subcategorySlug && !subcategory) throw new Error(`Subcategoria ausente para ${product.title}.`);

      const savedProduct = await tx.product.upsert({
        where: { slug: product.slug },
        update: {
          title: product.title,
          brand: product.brand,
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          priceInCents: product.priceInCents,
          shortDescription: product.shortDescription,
          description: product.description,
          weightGrams: DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
          lengthCm: DEFAULT_PRODUCT_PACKAGE.lengthCm,
          widthCm: DEFAULT_PRODUCT_PACKAGE.widthCm,
          heightCm: DEFAULT_PRODUCT_PACKAGE.heightCm,
          active: true,
          featured: product.featured,
          sortOrder: product.sortOrder,
        },
        create: {
          title: product.title,
          slug: product.slug,
          brand: product.brand,
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          priceInCents: product.priceInCents,
          shortDescription: product.shortDescription,
          description: product.description,
          weightGrams: DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS,
          lengthCm: DEFAULT_PRODUCT_PACKAGE.lengthCm,
          widthCm: DEFAULT_PRODUCT_PACKAGE.widthCm,
          heightCm: DEFAULT_PRODUCT_PACKAGE.heightCm,
          active: true,
          featured: product.featured,
          sortOrder: product.sortOrder,
        },
      });
      productsUpserted += 1;

      const demotedImages = await tx.productImage.updateMany({
        where: {
          productId: savedProduct.id,
          sortOrder: 0,
          url: { not: product.image.url },
        },
        data: { sortOrder: 1 },
      });
      primaryImageConflictsDemoted += demotedImages.count;

      const existingImages = await tx.productImage.findMany({
        where: {
          productId: savedProduct.id,
          url: product.image.url,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      if (existingImages.length) {
        await tx.productImage.updateMany({
          where: {
            productId: savedProduct.id,
            url: product.image.url,
          },
          data: {
            alt: product.image.alt,
            sortOrder: 0,
          },
        });
        productImagesAlreadyLinked += 1;
        duplicateExpectedImageRows += Math.max(0, existingImages.length - 1);
      } else {
        await tx.productImage.create({
          data: {
            productId: savedProduct.id,
            url: product.image.url,
            alt: product.image.alt,
            sortOrder: 0,
          },
        });
        productImagesAttached += 1;
      }

      const existingVariants = await tx.productVariant.findMany({
        where: { productId: savedProduct.id },
      });
      const existingBySize = new Map(existingVariants.map((variant) => [variant.size, variant]));
      const submittedSizes = new Set(product.variants.map((variant) => variant.size));

      for (const variant of product.variants) {
        const existing = existingBySize.get(variant.size);
        await tx.productVariant.upsert({
          where: {
            productId_size: {
              productId: savedProduct.id,
              size: variant.size,
            },
          },
          update: {
            sku: variant.sku,
            stock: Math.max(variant.stock, existing?.reservedStock ?? 0),
            active: true,
          },
          create: {
            productId: savedProduct.id,
            size: variant.size,
            sku: variant.sku,
            stock: variant.stock,
            active: true,
          },
        });
        variantsUpserted += 1;
      }

      await tx.productVariant.updateMany({
        where: {
          productId: savedProduct.id,
          size: { notIn: [...submittedSizes] },
        },
        data: { active: false },
      });
    }

    const hiddenBySlug = await tx.product.updateMany({
      where: { slug: { in: demoSlugsToHide } },
      data: {
        active: false,
        featured: false,
        sortOrder: 900,
      },
    });

    const hiddenBySeedImage = await tx.product.updateMany({
      where: {
        slug: { notIn: [...products.map((product) => product.slug), ...demoSlugsToHide] },
        images: {
          some: {
            url: { startsWith: "/seed-products/" },
          },
        },
      },
      data: {
        active: false,
        featured: false,
        sortOrder: 900,
      },
    });

    await tx.storeSettings.upsert({
      where: { id: "store" },
      update: {
        storeName: "RARE",
        whatsappDefaultMessage: "Ola, tenho interesse em um produto da RARE.",
      },
      create: {
        id: "store",
        storeName: "RARE",
        whatsappDefaultMessage: "Ola, tenho interesse em um produto da RARE.",
        manualShippingInCents: 0,
      },
    });

    return {
      productsUpserted,
      variantsUpserted,
      productImagesAttached,
      productImagesAlreadyLinked,
      primaryImageConflictsDemoted,
      duplicateExpectedImageRows,
      demoProductsHidden: hiddenBySlug.count + hiddenBySeedImage.count,
    };
  });

  console.log(
    [
      `Catalog import completed. Products: ${result.productsUpserted}.`,
      `Variants: ${result.variantsUpserted}.`,
      `Images attached: ${result.productImagesAttached}.`,
      `Images already linked: ${result.productImagesAlreadyLinked}.`,
      `Primary image conflicts demoted: ${result.primaryImageConflictsDemoted}.`,
      `Duplicate expected image rows observed: ${result.duplicateExpectedImageRows}.`,
      `Demo products hidden: ${result.demoProductsHidden}.`,
    ].join(" "),
  );
}

importCatalog()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Catalog import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
