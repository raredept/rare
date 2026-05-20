import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{ error?: string; refresh?: string; success?: string }>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const { error, refresh, success } = await searchParams;
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Novo produto</h1>
      <div className="mt-6">
        <ProductForm key={`new-product-${success ?? "idle"}-${refresh ?? "initial"}`} categories={categories} error={error} />
      </div>
    </div>
  );
}
