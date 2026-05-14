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
  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
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
  const activeProducts = products.filter((product) => product.active).length;
  const hiddenProducts = products.length - activeProducts;
  const missingImages = products.filter((product) => !product.images[0]).length;
  const lowStockProducts = products.filter((product) => {
    const availableStock = product.variants.reduce((sum, variant) => sum + variant.stock - variant.reservedStock, 0);
    return availableStock > 0 && availableStock <= 3;
  }).length;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Produtos</h1>
          <p className="mt-1 text-sm text-neutral-500">Gerencie imagens, status, destaque, categorias e estoque por variacao.</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white">
          Novo produto
        </Link>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Ativos" value={activeProducts} />
        <SummaryMetric label="Ocultos" value={hiddenProducts} />
        <SummaryMetric label="Estoque baixo" value={lowStockProducts} />
        <SummaryMetric label="Sem imagem" value={missingImages} />
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_210px_150px_150px_190px]">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar produto ou marca" className="admin-input" />
        <select name="category" defaultValue={filters.category ?? ""} className="admin-input">
          <option value="">Todas categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.parent ? `${category.parent.name} / ${category.name}` : category.name}
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
        <div className="hidden grid-cols-[1fr_190px_120px_140px_190px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Estoque</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {visibleProducts.map((product) => {
            const stock = product.variants.reduce((sum, variant) => sum + variant.stock - variant.reservedStock, 0);
            const reservedStock = product.variants.reduce((sum, variant) => sum + variant.reservedStock, 0);
            const soldOut = stock <= 0;
            const missingShippingData = !product.weightGrams || !product.lengthCm || !product.widthCm || !product.heightCm;
            return (
              <div key={product.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_190px_120px_140px_190px] lg:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                    {product.images[0] ? (
                      <img src={product.images[0].url} alt={product.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-2 text-center text-[10px] font-black uppercase text-neutral-400">Sem imagem</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-neutral-950">{product.title}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-500">{product.brand ?? "Marca não informada"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone={product.active ? "neutral" : "muted"}>{product.active ? "Ativo" : "Oculto"}</Badge>
                      {product.featured ? <Badge tone="dark">Destaque</Badge> : null}
                      {soldOut ? <Badge tone="danger">Esgotado</Badge> : null}
                      {!product.images[0] ? <Badge tone="muted">Sem imagem</Badge> : null}
                      {missingShippingData ? <Badge tone="muted">Sem dados de frete</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-neutral-600">
                  <p>{product.category?.name ?? "Sem categoria"}</p>
                  <p className="mt-1 text-xs text-neutral-500">{product.subcategory ? `Subcategoria: ${product.subcategory.name}` : "Sem subcategoria"}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(product.priceInCents)}</span>
                <div className="text-sm">
                  <p className="font-black text-neutral-950">{stock} disponível(is)</p>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">
                    {reservedStock} reservado(s) · {product.variants.length} variação(ões)
                  </p>
                </div>
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
        {!visibleProducts.length ? (
          <div className="border-t border-neutral-200 px-6 py-14 text-center">
            <h2 className="text-base font-black text-neutral-950">Nenhum produto encontrado</h2>
            <p className="mt-2 text-sm text-neutral-500">Revise a busca ou limpe os filtros para voltar a lista completa.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xl font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" | "dark" | "danger" }) {
  const classes = {
    neutral: "border-emerald-200 bg-emerald-50 text-emerald-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-500",
    dark: "border-neutral-950 bg-neutral-950 text-white",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
