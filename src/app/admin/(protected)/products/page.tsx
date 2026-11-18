import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { ReactNode } from "react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { deleteProductAction, moveProductInCatalogAction, toggleProductActiveAction } from "@/app/admin/(protected)/products/actions";
import { getAdminCategoryFilterLabel, sortAdminCategoryFilterOptions } from "@/lib/admin-category-options";
import { classifyProductImageUrl, getProductMediaLabel, getProductMediaTypeFromUrl } from "@/lib/admin-product-images";
import { formatMoney } from "@/lib/money";
import { normalizeAdminPage } from "@/lib/admin-pagination";
import { getAdminProductRows, getAdminProductSummary, getCatalogPositions, parseAdminProductStockFilter } from "@/lib/admin-products-data";
import { getInventoryIntegrityReport } from "@/lib/inventory-integrity";
import { STOCK_POLICY_LABELS, STOCK_STATE_LABELS, STOCK_STATE_TONES, type StockStateTone } from "@/lib/stock-policy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; category?: string | string[]; status?: string | string[]; featured?: string | string[]; stock?: string | string[] }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireAdmin("commerce.products");
  const filters = await searchParams;
  const page = normalizeAdminPage(filters.page);
  const query = typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : undefined;
  const status: "active" | "hidden" | undefined = filters.status === "active" || filters.status === "hidden" ? filters.status : undefined;
  const featured: "true" | undefined = filters.featured === "true" ? "true" : undefined;
  const stock = parseAdminProductStockFilter(filters.stock);
  const category = typeof filters.category === "string" ? filters.category.trim().slice(0, 100) || undefined : undefined;
  const normalizedFilters = { page, query, status, featured, stock, category };
  const [categories, productPage, summary, catalogPositions] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      include: { parent: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getAdminProductRows(normalizedFilters),
    getAdminProductSummary(),
    getCatalogPositions(),
  ]);
  const { products, hasNextPage, previousId, nextId } = productPage;
  // Hidden fields that bring the operator back to the same filtered page after ↑ / ↓.
  const returnParams = { page: page > 1 ? String(page) : undefined, q: query, category, status, featured, stock };
  // Stock state of the listed products only, read in one snapshot with their orders.
  const stockReport = await getInventoryIntegrityReport(products.map((product) => product.id));
  const stockByProduct = new Map(stockReport.products.map((entry) => [entry.productId, entry]));
  const stockBadgeTones: Record<StockStateTone, "neutral" | "muted" | "danger" | "warning"> = { ok: "neutral", warning: "warning", danger: "danger", muted: "muted" };
  const categoryFilterOptions = sortAdminCategoryFilterOptions(categories);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Catálogo</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Produtos</h1>
          <p className="mt-1 text-sm text-neutral-500">Gerencie imagens, status, destaque, categorias e estoque por variação.</p>
          <p className="mt-1 text-xs font-semibold text-neutral-500">
            A lista segue a ordem da loja: use ↑ ↓ ou o campo &quot;Posição no catálogo&quot; do produto. Na loja, peças esgotadas aparecem depois das disponíveis.
          </p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-black text-white">
          Novo produto
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Ativos" value={summary.active} />
        <SummaryMetric label="Ocultos" value={summary.hidden} />
        <SummaryMetric label="Reposição com estoque baixo" value={summary.lowStock} />
        <SummaryMetric label="Sem imagem" value={summary.missingImages} />
      </div>

      <form className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] xl:grid-cols-[minmax(0,1fr)_210px_150px_150px_190px]">
        <input name="q" defaultValue={query ?? ""} maxLength={100} aria-label="Buscar produto, marca ou SKU" placeholder="Buscar produto, marca ou SKU" className="admin-input" />
        <select aria-label="Filtrar por categoria" name="category" defaultValue={category ?? ""} className="admin-input">
          <option value="">Todas categorias</option>
          {categoryFilterOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {getAdminCategoryFilterLabel(category)}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por status" name="status" defaultValue={status ?? ""} className="admin-input">
          <option value="">Todos status</option>
          <option value="active">Ativos</option>
          <option value="hidden">Ocultos</option>
        </select>
        <select aria-label="Filtrar por destaque" name="featured" defaultValue={featured ?? ""} className="admin-input">
          <option value="">Destaque: todos</option>
          <option value="true">Somente destaque</option>
        </select>
        <div className="flex gap-2">
          <select aria-label="Filtrar por estoque" name="stock" defaultValue={stock ?? ""} className="admin-input">
            <option value="">Estoque: todos</option>
            <option value="low">Reposição: estoque baixo</option>
            <option value="out">Reposição: esgotado</option>
            <option value="unique">Peças únicas</option>
            <option value="unique-unavailable">Peças únicas vendidas ou reservadas</option>
          </select>
          <button className="min-h-11 rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_190px_120px_140px_190px] bg-black px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 xl:grid">
          <span>Produto</span>
          <span>Categoria</span>
          <span>Preço</span>
          <span>Estoque</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {products.map((product, index) => {
            const upNeighborId = products[index - 1]?.id ?? previousId;
            const downNeighborId = products[index + 1]?.id ?? nextId;
            const catalogPosition = catalogPositions.get(product.id);
            const stock = product.variants.reduce((sum, variant) => sum + variant.stock - variant.reservedStock, 0);
            const reservedStock = product.variants.reduce((sum, variant) => sum + variant.reservedStock, 0);
            const stockEntry = stockByProduct.get(product.id);
            const missingShippingData = !product.weightGrams || !product.lengthCm || !product.widthCm || !product.heightCm;
            const mainImage = product.images[0];
            const imageSource = mainImage ? classifyProductImageUrl(mainImage.url) : null;
            const mediaType = mainImage ? getProductMediaTypeFromUrl(mainImage.url) : null;
            return (
              <div
                key={product.id}
                id={`product-${product.id}`}
                // UIUX-ADMIN-004: below 1280 px two columns (category | price, stock | actions) instead of
                // one tall stack per product; secondary lines appear only on the wide table.
                className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 transition hover:bg-white/[0.03] sm:px-5 xl:grid-cols-[minmax(0,1fr)_190px_120px_140px_190px] xl:items-center xl:py-4"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-4 xl:col-span-1">
                  <div className="flex h-20 w-16 shrink-0 sm:h-24 sm:w-20 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-black">
                    {mainImage && mediaType === "video" ? (
                      <video src={mainImage.url} aria-label={product.title} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : mainImage ? (
                      <img src={mainImage.url} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-2 text-center text-[10px] font-black uppercase tracking-wide text-neutral-500">Sem imagem</span>
                    )}
                  </div>
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="font-black text-neutral-950">{product.title}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-500">{product.brand ?? "Marca não informada"}</p>
                    {product.variants.some((variant) => variant.sku) ? (
                      <p className="mt-1 font-mono text-[11px] font-semibold text-neutral-500" data-testid="product-row-skus">
                        {product.variants
                          .filter((variant) => variant.sku)
                          .map((variant) => (product.variants.length > 1 ? `${variant.size}: ${variant.sku}` : `SKU ${variant.sku}`))
                          .join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {catalogPosition ? <Badge tone="dark">{`Posição ${catalogPosition}`}</Badge> : null}
                      <Badge tone={product.active ? "neutral" : "muted"}>{product.active ? "Ativo" : "Oculto"}</Badge>
                      {product.featured ? (
                        <>
                          <Badge tone="dark">Destaque</Badge>
                          <Badge tone={product.featuredSortOrder ? "neutral" : "warning"}>
                            {product.featuredSortOrder ? `Ordem destaque: ${product.featuredSortOrder}` : "Destaque sem ordem"}
                          </Badge>
                        </>
                      ) : null}
                      <Badge tone="muted">{product.stockPolicy === "UNIQUE" ? "Peça única" : "Reposição"}</Badge>
                      {stockEntry ? <Badge tone={stockBadgeTones[STOCK_STATE_TONES[stockEntry.state]]}>{STOCK_STATE_LABELS[stockEntry.state]}</Badge> : null}
                      {!product.images[0] ? <Badge tone="muted">Sem imagem</Badge> : null}
                      {imageSource ? <Badge tone={imageSource === "Seed" ? "warning" : "muted"}>{imageSource}</Badge> : null}
                      {mediaType ? <Badge tone={mediaType === "video" ? "dark" : "muted"}>{getProductMediaLabel(mediaType)}</Badge> : null}
                      {missingShippingData ? <Badge tone="muted">Sem dados de frete</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-sm font-semibold text-neutral-600 [overflow-wrap:anywhere]">
                  <p>{product.category?.name ?? "Sem categoria"}</p>
                  <p className="mt-1 hidden text-xs text-neutral-500 xl:block">{product.subcategory ? `Subcategoria: ${product.subcategory.name}` : "Sem subcategoria"}</p>
                </div>
                <span className="whitespace-nowrap text-right text-sm font-black text-neutral-950 xl:text-left">{formatMoney(product.priceInCents)}</span>
                <div className="text-sm">
                  <p className="font-black text-neutral-950">{stock} disponível(is)</p>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">
                    {reservedStock} reservado(s) · {product.variants.length} variação(ões)
                  </p>
                  <p className="mt-1 hidden text-xs font-semibold text-neutral-500 xl:block">
                    Política: {STOCK_POLICY_LABELS[product.stockPolicy]}
                    {stockEntry && stockEntry.soldUnits > 0 ? ` · ${stockEntry.soldUnits} vendida(s)` : ""}
                  </p>
                  {stockEntry?.inconsistencyLabels.length ? (
                    <p className="mt-1 text-xs font-black text-red-200">{stockEntry.inconsistencyLabels.join(" · ")}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2 xl:justify-start">
                  <CatalogMoveButton productId={product.id} neighborId={upNeighborId} direction="up" title={product.title} returnParams={returnParams} />
                  <CatalogMoveButton productId={product.id} neighborId={downNeighborId} direction="down" title={product.title} returnParams={returnParams} />
                  <Link href={`/admin/products/${product.id}/edit`} className="inline-flex min-h-11 items-center rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black">
                    Editar
                  </Link>
                  <form action={toggleProductActiveAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="active" value={String(product.active)} />
                    <AdminSubmitButton
                      idleLabel={product.active ? "Ocultar" : "Ativar"}
                      pendingLabel={product.active ? "Ocultando..." : "Ativando..."}
                      className="min-h-11 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black"
                    />
                  </form>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <ConfirmButton
                      message="Excluir este produto? O histórico de pedidos será preservado por snapshot."
                      pendingChildren="Excluindo..."
                      className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
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
        {!products.length ? (
          <div className="border-t border-neutral-800 px-6 py-14 text-center">
            <h2 className="text-base font-black text-neutral-950">Nenhum produto encontrado</h2>
            <p className="mt-2 text-sm text-neutral-500">Revise a busca ou limpe os filtros para voltar a lista completa.</p>
          </div>
        ) : null}
        <AdminPagination
          basePath="/admin/products"
          page={page}
          hasNextPage={hasNextPage}
          params={{ q: query, category, status, featured, stock }}
        />
      </section>
    </div>
  );
}

function CatalogMoveButton({
  productId,
  neighborId,
  direction,
  title,
  returnParams,
}: {
  productId: string;
  neighborId: string | null;
  direction: "up" | "down";
  title: string;
  returnParams: Record<string, string | undefined>;
}) {
  const label = direction === "up" ? `Subir ${title} uma posição` : `Descer ${title} uma posição`;
  const className =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-neutral-700 px-3 py-2 text-sm font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-200";
  if (!neighborId) {
    return (
      <button type="button" disabled aria-label={label} title={label} className={className}>
        {direction === "up" ? "↑" : "↓"}
      </button>
    );
  }
  return (
    <form action={moveProductInCatalogAction}>
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="neighborId" value={neighborId} />
      <input type="hidden" name="direction" value={direction} />
      {Object.entries(returnParams).map(([key, value]) => (value ? <input key={key} type="hidden" name={`return_${key}`} value={value} /> : null))}
      <AdminSubmitButton idleLabel={direction === "up" ? "↑" : "↓"} pendingLabel="" ariaLabel={label} title={label} className={className} />
    </form>
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
    dark: "admin-chip-strong",
    danger: "border-red-400/30 bg-red-500/10 text-red-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
