import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{
    error?: string; refresh?: string; success?: string;
    draft_weightGrams?: string; draft_lengthCm?: string; draft_widthCm?: string; draft_heightCm?: string;
  }>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const params = await searchParams;
  const { error, refresh, success } = params;
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Novo produto</h1>
      <div className="mt-6">
        <ProductForm
          key={`new-product-${success ?? "idle"}-${refresh ?? "initial"}`}
          categories={categories}
          error={error}
          shippingDraft={{
            weightGrams: params.draft_weightGrams,
            lengthCm: params.draft_lengthCm,
            widthCm: params.draft_widthCm,
            heightCm: params.draft_heightCm,
          }}
        />
      </div>
    </div>
  );
}
