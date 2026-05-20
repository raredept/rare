import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getDatabaseUrl } from "../src/lib/env";

const LEGACY_SLUG = "bolsas-bag";
const TARGET_SLUG = "bags";
const shouldWrite = process.env.CONFIRM_LEGACY_BAGS_REMAP === "true";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
});

async function main() {
  const [legacyCategory, targetCategory] = await Promise.all([
    prisma.category.findUnique({ where: { slug: LEGACY_SLUG }, select: { id: true, active: true } }),
    prisma.category.findUnique({ where: { slug: TARGET_SLUG }, select: { id: true, active: true } }),
  ]);

  if (!legacyCategory) {
    console.log(JSON.stringify({ ok: true, dryRun: !shouldWrite, message: "Legacy category not found." }, null, 2));
    return;
  }

  if (!targetCategory?.active) {
    throw new Error("Target category bags is missing or inactive. Aborting.");
  }

  const products = await prisma.product.findMany({
    where: { subcategoryId: legacyCategory.id },
    select: { id: true, slug: true, active: true },
    orderBy: [{ active: "desc" }, { slug: "asc" }],
  });

  if (!shouldWrite) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          legacySlug: LEGACY_SLUG,
          targetSlug: TARGET_SLUG,
          productsToRemap: products.length,
          activeProductsToRemap: products.filter((product) => product.active).length,
          productSlugs: products.map((product) => product.slug),
          nextStep: "Set CONFIRM_LEGACY_BAGS_REMAP=true to apply this remap in the selected environment.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const [remapped] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { subcategoryId: legacyCategory.id },
      data: { subcategoryId: targetCategory.id },
    }),
    prisma.category.update({
      where: { id: legacyCategory.id },
      data: { active: false, sortOrder: 90 },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        legacySlug: LEGACY_SLUG,
        targetSlug: TARGET_SLUG,
        productsRemapped: remapped.count,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Legacy bags remap failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
