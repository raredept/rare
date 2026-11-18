import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogEmptyState, CatalogProductGrid } from "@/components/store/catalog-grid";
import { CatalogToolbar } from "@/components/store/catalog-toolbar";
import { buildCatalogPageHref, normalizeCatalogPage } from "@/lib/catalog-pagination";
import { buildCatalogHref, formatPriceBand, parseCatalogRefinements } from "@/lib/catalog-refinements";
import { getCollectionHref } from "@/lib/promotions/collections";
import { buildCollectionMetadata, getListingIndexState, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { getCollectionPageData, getPublicCollection } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import { buildBreadcrumbListJsonLd, JsonLdScript } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ brand?: string; page?: string; size?: string; price?: string; available?: string; sort?: string }>;
};

// RARE-COLLECTIONS-CART-01: a promotion shown as a storefront collection. Only public while the
// promotion is effectively ACTIVE and wins at least one active product; otherwise a real 404.
// RARE-SEO-GOOGLE-01: promotional and short-lived, so `noindex, follow` and out of the sitemap
// (buildCollectionMetadata); filtered/paginated variants follow the catalog listing rules.
export async function generateMetadata({ params, searchParams }: Pick<CollectionPageProps, "params"> & Partial<Pick<CollectionPageProps, "searchParams">>): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const collection = await getPublicCollection(slug);
  if (!collection) notFound();
  return buildCollectionMetadata(collection, getListingIndexState(search));
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const brand = search.brand?.trim() || undefined;
  const pageData = await getCollectionPageData(slug, { brand, page: normalizeCatalogPage(search.page) }, parseCatalogRefinements(search));
  if (!pageData) notFound();

  const { collection, refinements, facets, total } = pageData;
  const commerce = getStorefrontCommerceState();
  const urlState = { brand, ...refinements };
  const href = (state: Parameters<typeof buildCatalogHref>[1]) => buildCatalogHref(slug, state, "/colecao");
  const chips = [
    brand ? { label: `Marca: ${brand}`, href: href({ ...urlState, brand: undefined }) } : null,
    refinements.size ? { label: `Tamanho: ${refinements.size}`, href: href({ ...urlState, size: undefined }) } : null,
    refinements.price ? { label: formatPriceBand(refinements.price), href: href({ ...urlState, price: undefined }) } : null,
    refinements.available ? { label: "Disponível agora", href: href({ ...urlState, available: false }) } : null,
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(RARE_DEFAULT_SITE_URL, [
    { name: "Início", path: "/" },
    { name: collection.label, path: getCollectionHref(collection.slug) },
  ]);

  return (
    <div className="store-shell py-8 lg:py-12">
      <JsonLdScript id="rare-collection-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs font-bold text-neutral-500">
          <Link href="/" className="inline-flex min-h-6 items-center hover:text-neutral-950">Início</Link><span aria-hidden="true">/</span><span aria-current="page">{collection.label}</span>
        </nav>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-red-700">{collection.badgeText || "Coleção RARE"}</p>
        <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{collection.label}</h1>
        {collection.description ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">{collection.description}</p> : null}
        <div className="mt-5">
          <CatalogToolbar slug={slug} brand={brand} refinements={refinements} facets={facets} total={total} basePath="/colecao" />
        </div>
        {chips.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
            {chips.map((chip) => (
              <Link key={chip.label} href={chip.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-800 hover:bg-neutral-200" aria-label={`Remover filtro ${chip.label}`}>
                {chip.label}
                <span aria-hidden="true">×</span>
              </Link>
            ))}
            <Link href={buildCatalogPageHref(slug, {}, "/colecao")} className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-neutral-600 underline underline-offset-4">Limpar filtros</Link>
          </div>
        ) : null}
      </div>

      {pageData.products.length ? (
        <CatalogProductGrid products={pageData.products} commerce={commerce} priorityFirst />
      ) : pageData.page > 1 ? (
        <CatalogEmptyState title="Nenhum produto nesta página." description="Volte à primeira página para explorar esta coleção."
          actions={[{ href: href({ ...urlState, page: 1 }), label: "Voltar à primeira página", variant: "primary" }]} />
      ) : (
        <CatalogEmptyState title="Nenhum produto encontrado." description="Remova os filtros para ver toda a coleção."
          actions={[{ href: buildCatalogPageHref(slug, {}, "/colecao"), label: "Limpar filtros", variant: "primary" }]} />
      )}
      {pageData.page > 1 || pageData.hasMore ? (
        <nav aria-label="Paginação da coleção" className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-neutral-200 pt-6">
          {pageData.page > 1 ? <Link rel="prev" href={href({ ...urlState, page: pageData.page - 1 })} className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-5 text-sm font-bold hover:border-black">Página anterior</Link> : null}
          <span className="px-2 text-sm font-bold" aria-current="page">Página {pageData.page}</span>
          {pageData.hasMore ? <Link rel="next" href={href({ ...urlState, page: pageData.page + 1 })} className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-5 text-sm font-bold hover:border-black">Próxima página</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
