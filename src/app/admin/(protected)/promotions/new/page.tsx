import Link from "next/link";
import { PromotionForm } from "@/components/admin/promotion-form";
import { loadPromotionFormOptions, toFormValues } from "@/app/admin/(protected)/promotions/form-data";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPromotionPage() {
  await requireAdmin();
  const options = await loadPromotionFormOptions();
  return (
    <div>
      <Link href="/admin/promotions" className="text-xs font-black uppercase tracking-wide text-neutral-500 hover:text-white">← Promoções</Link>
      <h1 className="mt-2 text-2xl font-black text-neutral-950">Nova promoção</h1>
      <p className="mt-1 text-sm text-neutral-500">Toda promoção nasce como rascunho e só afeta preços depois de ativada.</p>
      <PromotionForm values={toFormValues()} products={options.products} categories={options.categories} />
    </div>
  );
}
