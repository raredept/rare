import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isUniqueViolationOn } from "@/lib/prisma-errors";
import { normalizeSku } from "@/lib/sku";

// RARE-ORDER-ITEM-IMAGE-SKU-AUDIT-01: on a DISPOSABLE database already migrated, two concurrent
// transactions write the same SKU (typed as "SKU-A", "sku-a" and " SKU-A") to two different
// variants. Exactly one must persist; the loser must be a unique violation the app recognises.
//
//   QA_SKU_DATABASE_URL=postgresql://...localhost.../disposable npx tsx scripts/qa-sku-concurrency.ts

const url = process.env.QA_SKU_DATABASE_URL;
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error("QA_SKU_DATABASE_URL must point at a local disposable database.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const run = Date.now().toString(36);

async function main() {
  const products = await Promise.all(
    ["a", "b"].map((key) =>
      prisma.product.create({
        data: {
          title: `QA concorrência ${key} ${run}`,
          slug: `qa-sku-race-${key}-${run}`,
          description: "QA",
          shortDescription: "QA",
          priceInCents: 1000,
          variants: { create: { size: "Único", stock: 1 } },
        },
        include: { variants: true },
      }),
    ),
  );
  const [first, second] = products.map((product) => product.variants[0]);
  const typed = ["SKU-A", "sku-a", " SKU-A "].map(normalizeSku);
  if (new Set(typed).size !== 1) throw new Error(`normalization differs: ${JSON.stringify(typed)}`);
  const sku = `${typed[0]}-${run.toUpperCase()}`;

  let results: PromiseSettledResult<unknown>[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await prisma.productVariant.updateMany({ where: { id: { in: [first.id, second.id] } }, data: { sku: null } });
    // Both writes run inside their own transaction and are released at the same moment.
    results = await Promise.allSettled(
      [first.id, second.id].map((id) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_sleep(0.05)`;
          return tx.productVariant.update({ where: { id }, data: { sku } });
        }),
      ),
    );
    const holders = await prisma.productVariant.count({ where: { sku } });
    const rejected = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];
    if (holders !== 1 || rejected.length !== 1) {
      const reasons = rejected.map((result) => (result.reason instanceof Error ? result.reason.message.split(/\r?\n/).slice(-2).join(" ") : String(result.reason)));
      throw new Error(`attempt ${attempt}: holders=${holders} rejected=${rejected.length} ${JSON.stringify(reasons)}`);
    }
    if (!isUniqueViolationOn(rejected[0].reason, "sku")) throw new Error(`attempt ${attempt}: loser is not a recognised SKU violation`);
  }

  await prisma.product.deleteMany({ where: { id: { in: products.map((product) => product.id) } } });
  console.log(`QA_SKU_CONCURRENCY PASS attempts=20 holdersPerAttempt=1 loserRecognisedAsSkuViolation=true normalizedInputs=${JSON.stringify(["SKU-A", "sku-a", " SKU-A "])}->${typed[0]}`);
}

main()
  .catch((error) => {
    console.error("QA_SKU_CONCURRENCY FAIL", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
