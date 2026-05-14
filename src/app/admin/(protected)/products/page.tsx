import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteProductAction, toggleProductActiveAction } from "@/app/admin/(protected)/products/actions";
import { classifyProductImageUrl, getProductMediaLabel, getProductMediaTypeFromUrl } from "@/lib/admin-product-images";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Catalogo</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Produtos</h1>
          <p className="mt-1 text-sm text-neutral-500">Gerencie imagens, status, destaque, categorias e estoque por variacao.</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white">
          Novo produto
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Ativos" value={activeProducts} />
        <SummaryMetric label="Ocultos" value={hiddenProducts} />
        <SummaryMetric label="Estoque baixo" value={lowStockProducts} />
        <SummaryMetric label="Sem imagem" value={missingImages} />
      </div>

      <form className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] md:grid-cols-[1fr_210px_150px_150px_190px]">
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

      <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
        <div className="hidden grid-cols-[1fr_190px_120px_140px_190px] bg-black px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
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
            const lowStock = stock > 0 && stock <= 3;
            const missingShippingData = !product.weightGrams || !product.lengthCm || !product.widthCm || !product.heightCm;
            const mainImage = product.images[0];
            const imageSource = mainImage ? classifyProductImageUrl(mainImage.url) : null;
            const mediaType = mainImage ? getProductMediaTypeFromUrl(mainImage.url) : null;
            return (
              <div
                key={product.id}
                className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.03] lg:grid-cols-[1fr_190px_120px_140px_190px] lg:items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-black">
                    {mainImage && mediaType === "video" ? (
                      <video src={mainImage.url} aria-label={product.title} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : mainImage ? (
                      <img src={mainImage.url} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-2 text-center text-[10px] font-black uppercase tracking-wide text-neutral-500">Sem imagem</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-neutral-950">{product.title}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-500">{product.brand ?? "Marca não informada"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone={product.active ? "neutral" : "muted"}>{product.active ? "Ativo" : "Oculto"}</Badge>
                      {product.featured ? <Badge tone="dark">Destaque</Badge> : null}
                      {soldOut ? <Badge tone="danger">Esgotado</Badge> : null}
                      {lowStock ? <Badge tone="warning">Estoque baixo</Badge> : null}
                      {!product.images[0] ? <Badge tone="muted">Sem imagem</Badge> : null}
                      {imageSource ? <Badge tone={imageSource === "Seed" ? "warning" : "muted"}>{imageSource}</Badge> : null}
                      {mediaType ? <Badge tone={mediaType === "video" ? "dark" : "muted"}>{getProductMediaLabel(mediaType)}</Badge> : null}
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
                  <Link href={`/admin/products/${product.id}/edit`} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black">
                    Editar
                  </Link>
                  <form action={toggleProductActiveAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="active" value={String(product.active)} />
                    <AdminSubmitButton
                      idleLabel={product.active ? "Ocultar" : "Ativar"}
                      pendingLabel={product.active ? "Ocultando..." : "Ativando..."}
                      className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black"
                    />
                  </form>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <ConfirmButton
                      message="Excluir este produto? O histórico de pedidos será preservado por snapshot."
                      pendingChildren="Excluindo..."
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="border-t border-neutral-800 px-6 py-14 text-center">
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-4 py-3 shadow-[0_14px_45px_rgba(0,0,0,0.22)]">
      <p className="text-xl font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" | "dark" | "danger" | "warning" }) {
  const classes = {
    neutral: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    muted: "border-neutral-700 bg-neutral-900 text-neutral-400",
    dark: "border-white bg-white text-black",
    danger: "border-red-400/30 bg-red-500/10 text-red-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
