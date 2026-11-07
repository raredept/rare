import Link from "next/link";
import { notFound } from "next/navigation";
import { PromotionForm } from "@/components/admin/promotion-form";
import { loadPromotionFormOptions, toFormValues } from "@/app/admin/(protected)/promotions/form-data";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const promotion = await prisma.promotion.findUnique({ where: { id }, include: { products: { select: { productId: true } }, categories: { select: { categoryId: true } } } });
  if (!promotion) notFound();
  const options = await loadPromotionFormOptions();
  return (
    <div>
      <Link href={`/admin/promotions/${promotion.id}`} className="text-xs font-black uppercase tracking-wide text-neutral-500 hover:text-white">← {promotion.name}</Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-950">Editar promoção</h1>
      {promotion.status === "ENDED" ? (
        <p className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-700">Promoção encerrada: não pode ser editada. Use “Duplicar” na página da promoção.</p>
      ) : (
        <PromotionForm values={toFormValues(promotion)} products={options.products} categories={options.categories} />
      )}
    </div>
  );
}
