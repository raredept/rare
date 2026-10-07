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

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; brand?: string; page?: string }>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getCategoryPageData(slug);

  if (!pageData) {
    notFound();
  }

  return buildCategoryMetadata(pageData);
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
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12 xl:gap-x-8">
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
    <div className="border-y border-neutral-200 px-6 py-20 text-center sm:py-24">
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-normal leading-6 text-neutral-600">{description}</p>
      {actions.length ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.variant === "secondary"
                  ? "store-button-secondary"
                  : "store-button-primary"
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
  const [{ slug }, { q, brand, page }] = await Promise.all([params, searchParams]);
  const filters = { query: q, brand };
  const [pageData, navigableCategories] = await Promise.all([
    getCategoryPageData(slug, { ...filters, page: normalizeCatalogPage(page) }),
    getNavigationCategories(),
  ]);

  if (!pageData) notFound();
  const shortcuts = buildCatalogShortcuts(navigableCategories);
  const commerce = getStorefrontCommerceState();
  const totalProducts = pageData.kind === "grouped"
    ? pageData.sections.reduce((total, section) => total + section.total, 0)
    : pageData.products.length;

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(RARE_DEFAULT_SITE_URL, [
    { name: "Início", path: "/" },
    { name: pageData.title, path: `/categoria/${slug}` },
  ]);

  return (
    <div className="store-shell py-6 pb-16 sm:py-8 sm:pb-20 lg:py-10 lg:pb-24">
      <JsonLdScript id="rare-category-breadcrumb-json-ld" data={breadcrumbJsonLd} />
      <div className="mb-9 border-b border-neutral-200 pb-1 sm:mb-12">
        <nav aria-label="Breadcrumb" className="mb-6 flex min-h-11 items-center gap-2 text-xs font-normal text-neutral-600">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-neutral-950">Início</Link><span aria-hidden="true">/</span><span aria-current="page">{pageData.title}</span>
        </nav>
        <p className="store-section-label">{pageData.eyebrow}</p>
        <h1 className="mt-3 max-w-4xl break-words text-4xl font-semibold leading-none tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">{pageData.title}</h1>
        <p className="mt-5 max-w-2xl text-sm font-normal leading-7 text-neutral-600 sm:text-base">{pageData.description}</p>
        <p className="mt-7 text-xs font-medium text-neutral-600">{totalProducts} {totalProducts === 1 ? "produto" : "produtos"}{pageData.kind !== "grouped" ? ` nesta página · Página ${pageData.page}` : ""}</p>
        {q?.trim() || brand?.trim() ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-normal text-neutral-600">
          {q?.trim() ? <span>Busca: {q.trim()}</span> : null}{brand?.trim() ? <span>Marca: {brand.trim()}</span> : null}
          <Link href={buildCatalogPageHref(slug)} className="inline-flex min-h-11 items-center underline underline-offset-4">Limpar filtros</Link>
        </div> : null}
        <div className="scrollbar-none mt-7 flex gap-5 overflow-x-auto sm:gap-7" aria-label="Atalhos do catálogo">
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.slug === slug ? "page" : undefined} className={`inline-flex min-h-12 shrink-0 items-center border-b-2 text-xs font-medium uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 ${item.slug === slug ? "border-neutral-950 text-neutral-950" : "border-transparent text-neutral-600 hover:border-neutral-400 hover:text-neutral-950"}`}>{item.label}</Link>
          ))}
        </div>
      </div>

      {pageData.kind === "grouped" ? (
        pageData.sections.length ? (
          <div className="grid gap-14 lg:gap-20">
            {pageData.sections.map((section, sectionIndex) => (
              <section key={section.slug} className="store-catalog-section border-b border-neutral-200 pb-14 last:border-b-0 last:pb-0 lg:pb-20">
                <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
                  {/* min-w-0 + break-words: a long category name wraps instead of
                      pushing the link off a 320 px screen. */}
                  <div className="min-w-0">
                    <h2 className="break-words text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{section.name}</h2>
                    <p className="mt-2 text-xs font-normal text-neutral-600">
                      {section.total} produto{section.total === 1 ? "" : "s"}
                    </p>
                  </div>
                  {section.href ? (
                    <Link
                      href={section.href}
                      className="inline-flex min-h-11 shrink-0 items-center border-b border-neutral-950 text-xs font-medium uppercase tracking-[0.1em] text-neutral-950 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4"
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
          actions={[{ href: buildCatalogPageHref(slug, filters), label: "Voltar à primeira página", variant: "primary" }]} />
      ) : q?.trim() || brand?.trim() ? (
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
      {pageData.kind !== "grouped" && (pageData.page > 1 || pageData.hasMore) ? <nav aria-label="Paginação do catálogo" className="mt-12 flex flex-wrap items-center justify-center gap-4 border-t border-neutral-200 pt-8 sm:gap-8">
        {pageData.page > 1 ? <Link rel="prev" href={buildCatalogPageHref(slug, { ...filters, page: pageData.page - 1 })} className="inline-flex min-h-11 items-center border-b border-neutral-300 text-sm font-medium hover:border-neutral-950">Página anterior</Link> : null}
        <span className="px-2 text-sm font-normal text-neutral-600" aria-current="page">Página {pageData.page}</span>
        {pageData.hasMore ? <Link rel="next" href={buildCatalogPageHref(slug, { ...filters, page: pageData.page + 1 })} className="inline-flex min-h-11 items-center border-b border-neutral-300 text-sm font-medium hover:border-neutral-950">Próxima página</Link> : null}
      </nav> : null}
    </div>
  );
}
