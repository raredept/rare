import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/product-card";
import { prisma } from "@/lib/prisma";
import { getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, { q }] = await Promise.all([params, searchParams]);
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category || !category.active) notFound();

  const products = await getProducts({ categorySlug: slug, query: q });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <div className="mb-10 border-b border-neutral-200 pb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Categoria</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{category.name}</h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">
          Seleção atualizada de produtos ativos nesta categoria.
        </p>
      </div>

      {products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-5 xl:gap-x-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <h2 className="text-lg font-black text-neutral-950">Nenhum produto nessa categoria</h2>
          <p className="mt-2 text-sm text-neutral-500">Novos importados podem ser cadastrados pelo admin.</p>
        </div>
      )}
    </div>
  );
}
