import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  accessoryCatalogSubcategories,
  legacyAccessoryCategorySlugs,
  primaryCatalogCategories,
} from "../src/lib/catalog-categories";
import { getDatabaseUrl, isProductionEnv } from "../src/lib/env";
import { slugify } from "../src/lib/slug";

let prisma: PrismaClient;

const products = [
  {
    title: "Boné - SUPREME",
    brand: "SUPREME",
    category: "acessorios",
    subcategory: "bones",
    priceInCents: 29990,
    shortDescription: "Boné importado com modelagem clássica e acabamento premium.",
    description: "Boné SUPREME importado, ideal para compor looks streetwear com acabamento limpo e estrutura firme.",
    image: "/seed-products/bone-supreme.svg",
    variants: [{ size: "Unico", stock: 0 }],
    featured: true,
    sortOrder: 4,
  },
  {
    title: "Bermuda - ADIDAS",
    brand: "ADIDAS",
    category: "bermudas",
    priceInCents: 19990,
    shortDescription: "Bermuda importada ADIDAS com caimento confortável.",
    description: "Bermuda ADIDAS em estilo casual esportivo, pronta para uso diario com tecido leve e visual minimalista.",
    image: "/seed-products/bermuda-adidas.svg",
    variants: [
      { size: "M", stock: 5 },
      { size: "G", stock: 5 },
    ],
    featured: true,
    sortOrder: 2,
  },
  {
    title: "Conjunto - NIKE TECH",
    brand: "NIKE",
    category: "conjuntos",
    priceInCents: 59990,
    shortDescription: "Conjunto importado com visual técnico e urbano.",
    description: "Conjunto NIKE TECH com proposta streetwear, acabamento moderno e modelagem alinhada ao uso urbano.",
    image: "/seed-products/conjunto-nike-tech.svg",
    variants: [
      { size: "P", stock: 2 },
      { size: "M", stock: 2 },
      { size: "G", stock: 2 },
    ],
    featured: true,
    sortOrder: 3,
  },
  {
    title: "Calça - HIGH STRAPPED",
    brand: "HIGH",
    category: "calcas",
    priceInCents: 29990,
    shortDescription: "Calça HIGH STRAPPED com visual importado e detalhe de faixa.",
    description: "Calça HIGH STRAPPED com pegada street, bolsos funcionais e caimento estruturado.",
    image: "/seed-products/calca-high-strapped.svg",
    variants: [
      { size: "M", stock: 3 },
      { size: "G", stock: 3 },
    ],
    featured: true,
    sortOrder: 1,
  },
  {
    title: "Bolsa/Bag - SUPREME",
    brand: "SUPREME",
    category: "acessorios",
    subcategory: "bags",
    priceInCents: 39990,
    shortDescription: "Bolsa shoulder bag SUPREME para uso diario.",
    description: "Bolsa/Bag SUPREME compacta, importada e funcional para carregar itens essenciais no dia a dia.",
    image: "/seed-products/bolsa-bag-supreme.svg",
    variants: [{ size: "Unico", stock: 4 }],
    featured: true,
    sortOrder: 5,
  },
];

async function upsertCategory(name: string, slug: string, sortOrder: number, parentId?: string) {
  return prisma.category.upsert({
    where: { slug },
    update: { name, sortOrder, parentId, active: true },
    create: { name, slug, sortOrder, parentId, active: true },
  });
}

async function main() {
  if (isProductionEnv() && process.env.CONFIRM_PRODUCTION_SEED !== "true") {
    throw new Error("Demo seed is blocked in production. Set CONFIRM_PRODUCTION_SEED=true only after explicit approval.");
  }

  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  const createdCategories = new Map<string, { id: string }>();
  for (const category of primaryCatalogCategories) {
    const created = await upsertCategory(category.name, category.slug, category.sortOrder);
    createdCategories.set(category.slug, created);
  }

  const accessories = createdCategories.get("acessorios");
  if (!accessories) throw new Error("Accessories category missing.");

  for (const subcategory of accessoryCatalogSubcategories) {
    const created = await upsertCategory(subcategory.name, subcategory.slug, subcategory.sortOrder, accessories.id);
    createdCategories.set(subcategory.slug, created);
  }

  await prisma.category.updateMany({
    where: { slug: { in: [...legacyAccessoryCategorySlugs] } },
    data: { active: false, sortOrder: 90 },
  });

  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: product.category } });
    const subcategory = product.subcategory
      ? await prisma.category.findUniqueOrThrow({ where: { slug: product.subcategory } })
      : null;

    const slug = slugify(product.title);
    const savedProduct = await prisma.product.upsert({
      where: { slug },
      update: {
        title: product.title,
        brand: product.brand,
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        priceInCents: product.priceInCents,
        shortDescription: product.shortDescription,
        description: product.description,
        active: true,
        featured: product.featured,
        sortOrder: product.sortOrder,
      },
      create: {
        title: product.title,
        slug,
        brand: product.brand,
        categoryId: category.id,
        subcategoryId: subcategory?.id,
        priceInCents: product.priceInCents,
        shortDescription: product.shortDescription,
        description: product.description,
        active: true,
        featured: product.featured,
        sortOrder: product.sortOrder,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: savedProduct.id } });
    await prisma.productImage.create({
      data: {
        productId: savedProduct.id,
        url: product.image,
        alt: product.title,
        sortOrder: 0,
      },
    });

    for (const variant of product.variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_size: {
            productId: savedProduct.id,
            size: variant.size,
          },
        },
        update: {
          stock: variant.stock,
          reservedStock: 0,
          active: true,
        },
        create: {
          productId: savedProduct.id,
          size: variant.size,
          stock: variant.stock,
          active: true,
        },
      });
    }
  }

  await prisma.storeSettings.upsert({
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
}

main()
  .then(async () => {
    await prisma?.$disconnect();
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    await prisma?.$disconnect();
    process.exit(1);
  });
