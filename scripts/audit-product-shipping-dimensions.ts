import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { DEFAULT_PRODUCT_PACKAGE, DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS } from "../src/lib/shipping";

async function main() {
  const missingWhere = {
    OR: [
      { weightGrams: null },
      { lengthCm: null },
      { widthCm: null },
      { heightCm: null },
      { weightGrams: { lte: 0 } },
      { lengthCm: { lte: 0 } },
      { widthCm: { lte: 0 } },
      { heightCm: { lte: 0 } },
    ],
  };

  const [totalProducts, missingProductsCount, productsMissingDimensions] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: missingWhere }),
    prisma.product.findMany({
      where: missingWhere,
      orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        slug: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
      },
    }),
  ]);

  console.log("Product shipping dimensions audit (dry-run)");
  console.log(`Products checked: ${totalProducts}`);
  console.log(`Products missing weight/dimensions: ${missingProductsCount}`);
  console.log(
    `Fallback used by shipping calculator: ${DEFAULT_PRODUCT_PACKAGE_WEIGHT_GRAMS}g, ` +
      `${DEFAULT_PRODUCT_PACKAGE.heightCm}x${DEFAULT_PRODUCT_PACKAGE.widthCm}x${DEFAULT_PRODUCT_PACKAGE.lengthCm}cm.`,
  );

  if (productsMissingDimensions.length) {
    console.log("Sample products to review:");
    for (const product of productsMissingDimensions) {
      console.log(
        `- ${product.slug} (${product.id}): weight=${product.weightGrams ?? "null"}g, ` +
          `height=${product.heightCm ?? "null"}cm, width=${product.widthCm ?? "null"}cm, length=${product.lengthCm ?? "null"}cm`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Product shipping dimensions audit failed.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
