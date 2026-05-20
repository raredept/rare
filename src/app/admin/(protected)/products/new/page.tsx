import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const { error } = await searchParams;
  const categories = await prisma.category.findMany({ orderBy: [{ name: "asc" }, { sortOrder: "asc" }] });

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Novo produto</h1>
      <div className="mt-6">
        <ProductForm categories={categories} error={error} />
      </div>
    </div>
  );
}
