import { ProductCard } from "@/components/store/product-card";
import { getProducts } from "@/lib/storefront";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q } = await searchParams;
  const products = await getProducts({ query: q });

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <section className="mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-8 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">
            {q ? "Busca" : "Curadoria RARE"}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">
          {q ? `Resultado para "${q}"` : "Produtos em destaque"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-neutral-500 lg:text-base">
            Importados selecionados, estoque controlado e pagamento seguro via Pix ou cartão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
          <span className="rounded-full border border-neutral-300 px-3 py-2">Streetwear</span>
          <span className="rounded-full border border-neutral-300 px-3 py-2">Premium</span>
          <span className="rounded-full border border-neutral-300 px-3 py-2">Drops selecionados</span>
        </div>
      </section>

      {products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-5 xl:gap-x-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <h2 className="text-lg font-black text-neutral-950">Nenhum produto encontrado</h2>
          <p className="mt-2 text-sm text-neutral-500">Tente buscar por outro nome, marca ou categoria.</p>
        </div>
      )}
    </div>
  );
}
