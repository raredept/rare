import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { buildProductShippingAudit } from "../src/lib/product-shipping-audit";
import { PRODUCT_SHIPPING_LIMITS } from "../src/lib/product-shipping-readiness";

type AuditArgs = { format: "text" | "json"; limit: number; page: number };

function argumentValue(argv: string[], name: string) {
  const inline = argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: string[]): AuditArgs {
  const format = argumentValue(argv, "--format") ?? "text";
  const limit = Number(argumentValue(argv, "--limit") ?? 50);
  const page = Number(argumentValue(argv, "--page") ?? 1);
  if (format !== "text" && format !== "json") throw new Error("--format deve ser text ou json.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("--limit deve ser um inteiro entre 1 e 200.");
  if (!Number.isInteger(page) || page < 1) throw new Error("--page deve ser um inteiro maior ou igual a 1.");
  return { format, limit, page };
}

function printText(report: ReturnType<typeof buildProductShippingAudit>, args: AuditArgs) {
  console.log("Product shipping readiness audit (read-only)");
  console.log(`Page: ${args.page}; limit: ${args.limit}; analyzed: ${report.analyzed}; catalog total: ${report.totalProducts}`);
  console.log(`Valid: ${report.summary.valid}`);
  console.log(`Using fallback: ${report.summary.usingFallback}`);
  console.log(`Missing weight: ${report.summary.missingWeight}`);
  console.log(`Missing dimensions: ${report.summary.missingDimensions}`);
  console.log(`Zero values: ${report.summary.zeroValues}`);
  console.log(`Negative values: ${report.summary.negativeValues}`);
  console.log(`Out of operational range: ${report.summary.outOfRange}`);
  console.log(`Ambiguous unit/non-integer: ${report.summary.unitAmbiguous}`);
  console.log(`Variant review recommended: ${report.summary.variantReview}`);
  console.log(`Ignored as no-shipping: ${report.summary.ignoredNoShipping}`);
  console.log(`Operational limits: ${PRODUCT_SHIPPING_LIMITS.weightGrams.max}g and ${PRODUCT_SHIPPING_LIMITS.lengthCm.max}cm per dimension.`);

  const issues = report.items.filter((item) => item.issueCodes.length);
  if (issues.length) {
    console.log("Products requiring review:");
    for (const item of issues) {
      console.log(`- ${item.slug} (${item.id}) active=${item.active} issues=${item.issueCodes.join(",")}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [totalProducts, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
      orderBy: { id: "asc" },
      skip: (args.page - 1) * args.limit,
      take: args.limit,
      select: {
        id: true,
        slug: true,
        active: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        variants: { where: { active: true }, select: { id: true } },
      },
    }),
  ]);
  const report = buildProductShippingAudit(
    products.map(({ variants, ...product }) => ({ ...product, activeVariantCount: variants.length })),
    totalProducts,
  );

  if (args.format === "json") console.log(JSON.stringify({ mode: "read-only", pagination: args, ...report }, null, 2));
  else printText(report, args);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message.split("\n", 1)[0] : "Product shipping audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
