import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/product-card";
import { getCategoryPageData, type StorefrontProduct } from "@/lib/storefront";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getCategoryPageData(slug);

  if (!pageData) {
    return {
      title: "Categoria não encontrada",
      robots: {
        index: false,
      },
    };
  }

  return {
    title: pageData.title,
    description: pageData.description,
    alternates: {
      canonical: `/categoria/${slug}`,
    },
    openGraph: {
      title: `${pageData.title} | RARE`,
      description: pageData.description,
      type: "website",
    },
  };
}

function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-5 xl:gap-x-8">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
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
  const [{ slug }, { q }] = await Promise.all([params, searchParams]);
  const pageData = await getCategoryPageData(slug, { query: q });

  if (!pageData) notFound();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 xl:px-10">
      <div className="mb-10 border-b border-neutral-200 pb-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">{pageData.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{pageData.title}</h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">{pageData.description}</p>
      </div>

      {pageData.kind === "grouped" ? (
        pageData.sections.length ? (
          <div className="grid gap-12 lg:gap-14">
            {pageData.sections.map((section) => (
              <section key={section.slug} className="store-catalog-section border-b border-neutral-200 pb-10 last:border-b-0 last:pb-0">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-neutral-950">{section.name}</h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                      {section.total} produto{section.total === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    href={section.href}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-neutral-300 px-4 text-xs font-black uppercase tracking-[0.16em] text-neutral-700 transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:border-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 active:translate-y-0"
                  >
                    {section.hasMore ? "Ver todos" : "Ver categoria"}
                  </Link>
                </div>
                <ProductGrid products={section.products} />
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
        <ProductGrid products={pageData.products} />
      ) : pageData.kind === "featured" ? (
        <EmptyState
          title="Nenhum destaque ativo no momento."
          description="Volte em breve ou explore o catálogo completo."
          actions={[{ href: "/categoria/tudo", label: "Ver catálogo completo", variant: "primary" }]}
        />
      ) : (
        <EmptyState
          title="Nada por aqui no momento."
          description="Essa categoria ainda não tem peças disponíveis, mas novos drops podem aparecer a qualquer hora."
        />
      )}
    </div>
  );
}
