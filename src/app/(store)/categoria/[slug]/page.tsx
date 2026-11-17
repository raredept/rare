import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/product-card";
import { buildCategoryMetadata, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbListJsonLd, JsonLdScript } from "@/lib/structured-data";
import { getCategoryPageData, getNavigationCategories, type StorefrontProduct } from "@/lib/storefront";
import { buildCatalogShortcuts } from "@/lib/catalog-shortcuts";
import { getStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";
import { buildCatalogPageHref, normalizeCatalogPage } from "@/lib/catalog-pagination";
import { buildCatalogHref, formatPriceBand, hasActiveRefinements, parseCatalogRefinements } from "@/lib/catalog-refinements";
import { CatalogToolbar } from "@/components/store/catalog-toolbar";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; page?: string; size?: string; price?: string; available?: string; promo?: string; sort?: string }>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getCategoryPageData(slug);

  if (!pageData) {
    notFound();
  }

  // Metadata always reads the unfiltered page; "filtered" only exists with refinements, kept for the type.
  return buildCategoryMetadata(pageData.kind === "filtered" ? { ...pageData, kind: "category" } : pageData);
}

function ProductGrid({
  products,
  commerce,
  priorityFirst = false,
  headingLevel = 2,
}: {
  products: StorefrontProduct[];
  commerce: StorefrontCommerceState;
  priorityFirst?: boolean;
  headingLevel?: 2 | 3;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-5 xl:gap-x-8">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} commerce={commerce} priority={priorityFirst && index === 0} headingLevel={headingLevel} />
      ))}
    </div>
  );
}

type EmptyStateAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

const defaultEmptyActions: EmptyStateAction[] = [
  { href: "/categoria/tudo", label: "Ver catálogo completo", variant: "primary" },
  { href: "/categoria/destaques", label: "Ver destaques da loja", variant: "secondary" },
];

function EmptyState({
  title,
  description,
  actions = defaultEmptyActions,
}: {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
      <h2 className="text-lg font-black text-neutral-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold text-neutral-500">{description}</p>
      {actions.length ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.variant === "secondary"
                  ? "inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-5 text-xs font-black uppercase tracking-[0.16em] text-neutral-800 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
                  : "inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
              }
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const { q, brand, page } = search;
  const filters = { query: q, brand };
  const refinements = parseCatalogRefinements(search);
  const [pageData, navigableCategories] = await Promise.all([
    getCategoryPageData(slug, { ...filters, page: normalizeCatalogPage(page) }, refinements),
    getNavigationCategories(),
  ]);

  if (!pageData) notFound();
  const shortcuts = buildCatalogShortcuts(navigableCategories);
  const commerce = getStorefrontCommerceState();
  // The real total of the scope with its filters (UIUX-CATALOG-001), not "N on this page".
  const totalProducts = "total" in pageData && typeof pageData.total === "number"
    ? pageData.total
    : pageData.kind === "grouped"
      ? pageData.sections.reduce((total, section) => total + section.total, 0)
      : pageData.products.length;
  const facets = "facets" in pageData && pageData.facets ? pageData.facets : null;
  const urlState = { ...filters, ...refinements };
  const anyFilter = Boolean(q?.trim() || brand?.trim()) || hasActiveRefinements(refinements);
  const chips = [
    q?.trim() ? { label: `Busca: ${q.trim()}`, href: buildCatalogHref(slug, { ...urlState, query: undefined }) } : null,
    brand?.trim() ? { label: `Marca: ${brand.trim()}`, href: buildCatalogHref(slug, { ...urlState, brand: undefined }) } : null,
    refinements.size ? { label: `Tamanho: ${refinements.size}`, href: buildCatalogHref(slug, { ...urlState, size: undefined }) } : null,
    refinements.price ? { label: formatPriceBand(refinements.price), href: buildCatalogHref(slug, { ...urlState, price: undefined }) } : null,
    refinements.available ? { label: "Disponível agora", href: buildCatalogHref(slug, { ...urlState, available: false }) } : null,
    refinements.promo ? { label: "Em promoção", href: buildCatalogHref(slug, { ...urlState, promo: false }) } : null,
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(RARE_DEFAULT_SITE_URL, [
    { name: "Início", path: "/" },
    { name: pageData.title, path: `/categoria/${slug}` },
  ]);

  return (
    <div className="store-shell py-8 lg:py-12">
      <JsonLdScript id="rare-category-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs font-bold text-neutral-500">
          <Link href="/" className="inline-flex min-h-6 items-center hover:text-neutral-950">Início</Link><span aria-hidden="true">/</span><span aria-current="page">{pageData.title}</span>
        </nav>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">{pageData.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{pageData.title}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">{pageData.description}</p>
        {/* UIUX-NAV-001: from 1024 px the header already lists every category; this quick bar is the
            only category navigation below that, so it stays there (and only there). */}
        <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Atalhos do catálogo">
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.slug === slug ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.12em] ${item.slug === slug ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-black"}`}>{item.label}</Link>
          ))}
        </div>
        <div className="mt-5">
          <CatalogToolbar slug={slug} query={q?.trim() || undefined} brand={brand?.trim() || undefined} refinements={refinements} facets={facets} total={totalProducts} />
        </div>
        {chips.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
            {chips.map((chip) => (
              <Link key={chip.label} href={chip.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-800 hover:bg-neutral-200" aria-label={`Remover filtro ${chip.label}`}>
                {chip.label}
                <span aria-hidden="true">×</span>
              </Link>
            ))}
            <Link href={buildCatalogPageHref(slug)} className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-neutral-600 underline underline-offset-4">Limpar filtros</Link>
          </div>
        ) : null}
      </div>

      {pageData.kind === "grouped" ? (
        pageData.sections.length ? (
          <div className="grid gap-12 lg:gap-14">
            {pageData.sections.map((section, sectionIndex) => (
              <section key={section.slug} className="store-catalog-section border-b border-neutral-200 pb-10 last:border-b-0 last:pb-0">
                <div className="mb-5 flex items-end justify-between gap-4">
                  {/* min-w-0 + break-words: a long category name wraps instead of
                      pushing the link off a 320 px screen. */}
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-black tracking-tight text-neutral-950">{section.name}</h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                      {section.total} produto{section.total === 1 ? "" : "s"}
                    </p>
                  </div>
                  {section.href ? (
                    <Link
                      href={section.href}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-neutral-300 px-4 text-xs font-black uppercase tracking-[0.16em] text-neutral-700 transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:border-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 active:translate-y-0"
                    >
                      {section.hasMore ? "Ver todos" : "Ver categoria"}
                    </Link>
                  ) : null}
                </div>
                <ProductGrid products={section.products} commerce={commerce} priorityFirst={sectionIndex === 0} headingLevel={3} />
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nada por aqui no momento."
            description="O catálogo ainda não tem peças ativas, mas novos drops podem aparecer a qualquer hora."
            actions={[]}
          />
        )
      ) : pageData.products.length ? (
        <ProductGrid products={pageData.products} commerce={commerce} priorityFirst />
      ) : pageData.page > 1 ? (
        <EmptyState title="Nenhum produto nesta página." description="Volte à primeira página para explorar esta seleção."
          actions={[{ href: buildCatalogHref(slug, { ...urlState, page: 1 }), label: "Voltar à primeira página", variant: "primary" }]} />
      ) : anyFilter ? (
        <EmptyState title="Nenhum produto encontrado." description="Tente outro termo ou remova os filtros."
          actions={[{ href: buildCatalogPageHref(slug), label: "Limpar filtros", variant: "primary" }]} />
      ) : pageData.kind === "featured" ? (
        <EmptyState
          title="Nenhum destaque ativo no momento."
          description="Volte em breve ou explore o catálogo completo."
          actions={[{ href: "/categoria/tudo", label: "Ver catálogo completo", variant: "primary" }]}
        />
      ) : (
        <EmptyState
          title="Nada por aqui no momento."
          description="Essa categoria ainda não tem peças publicadas, mas novos drops podem aparecer a qualquer hora."
        />
      )}
      {pageData.kind !== "grouped" && (pageData.page > 1 || pageData.hasMore) ? <nav aria-label="Paginação do catálogo" className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-neutral-200 pt-6">
        {pageData.page > 1 ? <Link rel="prev" href={buildCatalogHref(slug, { ...urlState, page: pageData.page - 1 })} className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-5 text-sm font-bold hover:border-black">Página anterior</Link> : null}
        <span className="px-2 text-sm font-bold" aria-current="page">Página {pageData.page}</span>
        {pageData.hasMore ? <Link rel="next" href={buildCatalogHref(slug, { ...urlState, page: pageData.page + 1 })} className="inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-5 text-sm font-bold hover:border-black">Próxima página</Link> : null}
      </nav> : null}
    </div>
  );
}
