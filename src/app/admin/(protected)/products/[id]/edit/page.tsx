import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getCatalogPositions } from "@/lib/admin-products-data";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    draft_weightGrams?: string; draft_lengthCm?: string; draft_widthCm?: string; draft_heightCm?: string;
  }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  // Checked here, not only in the layout: layouts do not re-render on client
  // navigation, so every page verifies the session next to its data.
  await requireAdmin("commerce.products");
  const { id } = await params;
  const query = await searchParams;
  const { error } = query;
  const [product, categories, positions] = await Promise.all([
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
    getCatalogPositions(),
  ]);

  if (!product) notFound();
  const position = positions.get(product.id);

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Editar produto</h1>
      <div className="mt-6">
        <ProductForm
          product={product}
          categories={categories}
          error={error}
          catalogPosition={position ? { position, total: positions.size } : undefined}
          shippingDraft={{
            weightGrams: query.draft_weightGrams,
            lengthCm: query.draft_lengthCm,
            widthCm: query.draft_widthCm,
            heightCm: query.draft_heightCm,
          }}
        />
      </div>
    </div>
  );
}
