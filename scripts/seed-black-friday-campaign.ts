import "dotenv/config";
import { isProductionAppEnv } from "../src/lib/deployment-environment";

// Creates the "SALE BLACK FRIDAY" campaign as a DRAFT in the Central de Promoções, once.
// It sets no discount, no products and no dates: an administrator must fill those in and use the
// preview before activating. Nothing changes on the storefront until then. Idempotent by code.
//
//   npm run promotions:seed-black-friday            (staging/dev)
//   CONFIRM_PRODUCTION_SEED=true npm run promotions:seed-black-friday   (production)

const CODE = process.env.BLACK_FRIDAY_PROMOTION_CODE?.trim() || `black-friday-${new Date().getFullYear()}`;

async function main() {
  if (!/^[a-z0-9-]{3,60}$/.test(CODE)) throw new Error("BLACK_FRIDAY_PROMOTION_CODE must be lowercase letters, digits and dashes.");
  if (isProductionAppEnv() && process.env.CONFIRM_PRODUCTION_SEED !== "true") {
    throw new Error("Set CONFIRM_PRODUCTION_SEED=true to create the draft campaign in production.");
  }
  const { prisma } = await import("../src/lib/prisma");
  const { recordAdminAudit } = await import("../src/lib/admin-audit");
  try {
    const existing = await prisma.promotion.findUnique({ where: { slug: CODE }, select: { id: true, status: true } });
    if (existing) {
      console.log(JSON.stringify({ created: false, code: CODE, status: existing.status }));
      return;
    }
    const promotion = await prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          name: "SALE BLACK FRIDAY",
          slug: CODE,
          status: "DRAFT",
          type: "PERCENTAGE",
          value: null,
          scope: "SELECTED_PRODUCTS",
          homepageFeatured: true,
          badgeText: "Black Friday",
          headline: "SALE BLACK FRIDAY",
          ctaLabel: "Ver ofertas",
          ctaHref: "/categoria/tudo",
        },
      });
      await recordAdminAudit(tx, { actor: { id: null, label: "seed:black-friday" }, action: "promotion.created", entityType: "Promotion", entityId: created.id, after: { code: CODE, status: "DRAFT" } });
      return created;
    });
    console.log(JSON.stringify({ created: true, code: CODE, id: promotion.id, status: "DRAFT" }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
