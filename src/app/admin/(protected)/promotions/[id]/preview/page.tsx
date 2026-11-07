import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeCampaign } from "@/components/store/home-campaign";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { priceProduct, type PromotionRule } from "@/lib/promotions/engine";
import { toPromotionRule } from "@/lib/promotions/store";
import { productInclude } from "@/lib/storefront";
import { buildStorefrontCommerceState } from "@/lib/storefront-commerce";

export const dynamic = "force-dynamic";

// Admin-only preview. It renders the campaign exactly as the storefront component does, with
// prices computed AS IF this promotion were active now, without changing its status: nothing here
// becomes public. Mobile is a 390 px frame (the component uses container queries).

export default async function PromotionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } },
  });
  if (!promotion) notFound();

  const now = new Date();
  const rule: PromotionRule = { ...toPromotionRule(promotion), status: "ACTIVE", startsAt: null, endsAt: null };
  const targetWhere = promotion.scope === "ALL_PRODUCTS"
    ? {}
    : promotion.scope === "SELECTED_PRODUCTS"
      ? { id: { in: promotion.products.map((item) => item.productId) } }
      : { OR: [{ categoryId: { in: promotion.categories.map((item) => item.categoryId) } }, { subcategoryId: { in: promotion.categories.map((item) => item.categoryId) } }] };
  const rows = await prisma.product.findMany({ where: { AND: [{ active: true }, targetWhere] }, include: productInclude, take: 8 });
  const products = rows.map((row) => ({ ...row, pricing: priceProduct([rule], row, now) })).filter((row) => row.pricing.promotion);
  const commerce = buildStorefrontCommerceState(true);

  return (
    <div>
      <Link href={`/admin/promotions/${promotion.id}`} className="text-xs font-black uppercase tracking-wide text-neutral-500 hover:text-white">← {promotion.name}</Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-950">Pré-visualização</h1>
      <p className="mt-1 text-sm text-neutral-500">Somente para o Admin. A promoção não é publicada por esta tela{promotion.homepageFeatured ? "" : " — e não está marcada para a home"}. Contador oculto na prévia.</p>
      <section className="mt-6" aria-label="Prévia desktop">
        <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">Desktop</h2>
        <div className="admin-light-scope rounded-lg bg-neutral-50 p-4 text-neutral-950"><HomeCampaign campaign={promotion} products={products} commerce={commerce} preview headingId="preview-desktop-title" /></div>
      </section>
      <section className="mt-8" aria-label="Prévia mobile">
        <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">Mobile (390 px)</h2>
        <div className="admin-light-scope w-[390px] max-w-full rounded-lg bg-neutral-50 p-2 text-neutral-950"><HomeCampaign campaign={promotion} products={products} commerce={commerce} preview headingId="preview-mobile-title" /></div>
      </section>
    </div>
  );
}
