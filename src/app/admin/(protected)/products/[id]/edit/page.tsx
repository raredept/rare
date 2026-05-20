import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { size: "asc" } },
      },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Editar produto</h1>
      <div className="mt-6">
        <ProductForm product={product} categories={categories} error={error} />
      </div>
    </div>
  );
}
