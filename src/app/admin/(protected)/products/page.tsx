import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteProductAction, toggleProductActiveAction } from "@/app/admin/(protected)/products/actions";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ q?: string; category?: string; status?: string; featured?: string; stock?: string }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = await searchParams;
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const products = await prisma.product.findMany({
    where: {
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q.trim(), mode: "insensitive" } },
              { brand: { contains: filters.q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.category ? { OR: [{ categoryId: filters.category }, { subcategoryId: filters.category }] } : {}),
      ...(filters.status === "active" ? { active: true } : {}),
      ...(filters.status === "hidden" ? { active: false } : {}),
      ...(filters.featured === "true" ? { featured: true } : {}),
      ...(filters.stock === "low" ? { variants: { some: { stock: { lte: 3 } } } } : {}),
    },
    include: {
      category: true,
      subcategory: true,
      variants: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const visibleProducts =
    filters.stock === "out"
      ? products.filter((product) => product.variants.reduce((sum, variant) => sum + variant.stock - variant.reservedStock, 0) <= 0)
      : products;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Produtos</h1>
          <p className="mt-1 text-sm text-neutral-500">CRUD, destaque, status e estoque por tamanho.</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white">
          Novo produto
        </Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_180px_150px_150px_190px]">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar produto ou marca" className="admin-input" />
        <select name="category" defaultValue={filters.category ?? ""} className="admin-input">
          <option value="">Todas categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="admin-input">
          <option value="">Todos status</option>
          <option value="active">Ativos</option>
          <option value="hidden">Ocultos</option>
        </select>
        <select name="featured" defaultValue={filters.featured ?? ""} className="admin-input">
          <option value="">Destaque: todos</option>
          <option value="true">Somente destaque</option>
        </select>
        <div className="flex gap-2">
          <select name="stock" defaultValue={filters.stock ?? ""} className="admin-input">
            <option value="">Estoque: todos</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Esgotado</option>
          </select>
          <button className="rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
        </div>
      </form>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[1fr_140px_120px_110px_180px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Estoque</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {visibleProducts.map((product) => {
            const stock = product.variants.reduce((sum, variant) => sum + variant.stock - variant.reservedStock, 0);
            const soldOut = stock <= 0;
            const missingShippingData = !product.weightGrams || !product.lengthCm || !product.widthCm || !product.heightCm;
            return (
              <div key={product.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_140px_120px_110px_180px] lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-14 overflow-hidden rounded-md bg-neutral-100">
                    {product.images[0] ? <img src={product.images[0].url} alt={product.title} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div>
                    <p className="font-black text-neutral-950">{product.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={product.active ? "neutral" : "muted"}>{product.active ? "Ativo" : "Oculto"}</Badge>
                      {product.featured ? <Badge tone="dark">Destaque</Badge> : null}
                      {soldOut ? <Badge tone="danger">Esgotado</Badge> : null}
                      {!product.images[0] ? <Badge tone="muted">Sem imagem</Badge> : null}
                      {missingShippingData ? <Badge tone="muted">Sem dados de frete</Badge> : null}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-neutral-600">{product.subcategory?.name ?? product.category?.name ?? "-"}</span>
                <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(product.priceInCents)}</span>
                <span className="text-sm font-black text-neutral-950">{stock}</span>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/products/${product.id}/edit`} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black">
                    Editar
                  </Link>
                  <form action={toggleProductActiveAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="active" value={String(product.active)} />
                    <button className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black" type="submit">
                      {product.active ? "Ocultar" : "Ativar"}
                    </button>
                  </form>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <ConfirmButton
                      message="Excluir este produto? O histórico de pedidos será preservado por snapshot."
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                      type="submit"
                    >
                      Excluir
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" | "dark" | "danger" }) {
  const classes = {
    neutral: "border-neutral-300 text-neutral-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-500",
    dark: "border-neutral-950 bg-neutral-950 text-white",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
