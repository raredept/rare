import { ArrowRight, Headphones, PackageSearch, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { HomeHeroCarousel } from "@/components/store/home-hero-carousel";
import { ProductCard } from "@/components/store/product-card";
import { getHomeBannerSlidesForStore } from "@/lib/home-banners";
import { buildPageMetadata, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, JsonLdScript } from "@/lib/structured-data";
import { getFeaturedProducts, getHomeCategoryTiles, getProducts, getRecentProducts, type HomeCategoryTile, type StorefrontProduct } from "@/lib/storefront";
import { getStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "RARE — Streetwear importado e drops selecionados",
  description: "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.",
  path: "/",
  absoluteTitle: true,
});

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

function getTrustItems(commerce: StorefrontCommerceState) {
  return [
  { title: commerce.checkoutStatusTitle, text: commerce.checkoutStatusText, icon: commerce.checkoutEnabled ? ShieldCheck : PackageSearch },
  { title: commerce.paymentTitle, text: commerce.paymentText, icon: Headphones },
  {
    title: commerce.checkoutEnabled ? "Envio para todo o Brasil" : "Operação de envio pausada",
    text: commerce.checkoutEnabled ? "Frete e prazo calculados com CEP antes da finalização." : "Condições de envio voltarão a ser exibidas quando as compras forem reabertas.",
    icon: Truck,
  },
  {
    title: "Peças escolhidas a dedo",
    text: "Drops limitados para quem quer sair do comum.",
    icon: Sparkles,
  },
  {
    title: "Atendimento direto",
    text: "Suporte para dúvidas sobre produto, pedido e pós-compra.",
    icon: Headphones,
  },
  {
    title: "Trocas e devoluções",
    text: "Política pública com regras claras para análise e solicitação.",
    icon: RotateCcw,
  },
] as const;
}

function ProductGrid({ products, commerce, columns = "featured", priorityFirst = false }: { products: StorefrontProduct[]; commerce: StorefrontCommerceState; columns?: "featured" | "recent"; priorityFirst?: boolean }) {
  const gridClass =
    columns === "featured"
      ? "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8"
      : "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4 xl:gap-x-8";

  return (
    <div className={`${gridClass} lg:gap-x-6 lg:gap-y-10`}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} commerce={commerce} priority={priorityFirst && index === 0} />
      ))}
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</p>
        <h2 id={id} className="mt-3 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-neutral-500 lg:text-base">{description}</p>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 text-xs font-black uppercase tracking-[0.16em] text-neutral-700 transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:border-neutral-950 hover:bg-neutral-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 active:translate-y-0"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function CategoryTile({ tile }: { tile: HomeCategoryTile }) {
  return (
    <Link
      href={tile.href}
      className="store-home-category group flex min-h-40 flex-col justify-between rounded-lg border border-neutral-200 bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-neutral-950/35 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 active:translate-y-0"
    >
      <span>
        <span className="block text-xl font-black tracking-tight text-neutral-950">{tile.name}</span>
        <span className="mt-3 block text-sm font-semibold leading-6 text-neutral-500">{tile.description}</span>
      </span>
      <span className="mt-6 flex items-center justify-between gap-4">
        <span className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          {tile.status === "available" ? `${tile.total} produto${tile.total === 1 ? "" : "s"}` : "Em breve"}
        </span>
        <ArrowRight className="h-4 w-4 text-neutral-400 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-neutral-950" aria-hidden="true" />
      </span>
    </Link>
  );
}

function SearchResults({ products, query, commerce }: { products: StorefrontProduct[]; query: string; commerce: StorefrontCommerceState }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8 xl:px-10">
      <section className="mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-8 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Busca</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 lg:text-5xl">{`Resultado para "${query}"`}</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-neutral-500 lg:text-base">
            Peças encontradas pelo que você buscou.
          </p>
        </div>
      </section>

      {products.length ? (
        <ProductGrid products={products} commerce={commerce} />
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
          <h2 className="text-lg font-black text-neutral-950">Nada encontrado por aqui.</h2>
          <p className="mt-2 text-sm text-neutral-500">Tente outro nome, marca ou categoria.</p>
          <Link
            href="/categoria/tudo"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 text-xs font-black uppercase tracking-[0.16em] text-white"
          >
            Ver catálogo completo
          </Link>
        </div>
      )}
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { q } = await searchParams;
  const commerce = getStorefrontCommerceState();
  const searchQuery = q?.trim() ?? "";
  const isSearch = Boolean(searchQuery);

  if (isSearch) {
    const products = await getProducts({ query: searchQuery });
    return <SearchResults products={products} query={searchQuery} commerce={commerce} />;
  }

  const [heroSlides, categoryTiles, featuredProducts, recentProducts] = await Promise.all([
    getHomeBannerSlidesForStore(),
    getHomeCategoryTiles(),
    getFeaturedProducts({ limit: 5 }),
    getRecentProducts({ limit: 4 }),
  ]);
  const selectedFeaturedProducts = featuredProducts.slice(0, 5);
  const appUrl = RARE_DEFAULT_SITE_URL;
  const organizationJsonLd = buildOrganizationJsonLd(appUrl);
  const websiteJsonLd = buildWebsiteJsonLd(appUrl);

  return (
    <div className="store-shell pb-12 pt-5 lg:pb-16 lg:pt-8">
      <JsonLdScript id="rare-organization-json-ld" data={organizationJsonLd} />
      <JsonLdScript id="rare-website-json-ld" data={websiteJsonLd} />
      <h1 className="sr-only">RARE — streetwear importado e drops selecionados</h1>
      <HomeHeroCarousel slides={heroSlides} />

      <section className="store-home-section mt-12 lg:mt-16" aria-labelledby="home-featured-title">
        <SectionHeading
          id="home-featured-title"
          eyebrow="Favoritos"
          title="Destaques do mês"
          description="Os favoritos da RARE agora."
          action={{ href: "/categoria/destaques", label: "Ver todos os destaques" }}
        />
        {selectedFeaturedProducts.length ? (
          <ProductGrid products={selectedFeaturedProducts} commerce={commerce} priorityFirst />
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center">
            <h3 className="text-lg font-black text-neutral-950">Nenhum destaque ativo no momento.</h3>
            <p className="mt-2 text-sm font-semibold text-neutral-500">Volte em breve ou explore o catálogo completo.</p>
            <Link href="/categoria/tudo" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-black px-5 text-xs font-black uppercase tracking-[0.16em] text-white">
              Ver catálogo completo
            </Link>
          </div>
        )}
      </section>

      {recentProducts.length ? (
        <section className="store-home-section mt-12 lg:mt-16" aria-labelledby="home-recent-title">
          <SectionHeading
            id="home-recent-title"
            eyebrow="Novidades"
            title="Chegou agora"
            description="Peças recém adicionadas ao catálogo."
            action={{ href: "/categoria/tudo", label: "Ver catálogo completo" }}
          />
          <ProductGrid products={recentProducts} commerce={commerce} columns="recent" />
        </section>
      ) : null}

      <section className="store-home-section mt-12 overflow-hidden rounded-lg bg-black px-6 py-10 text-white sm:px-8 lg:mt-16 lg:px-10 lg:py-12">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-white/65">Drop RARE</p>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Estoque limitado. Escolha sem pressa, mas não deixa passar.</h2>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/62 sm:text-base">
              Quando uma peça sai, pode não voltar tão cedo.
            </p>
          </div>
          <Link
            href="/categoria/tudo"
            className="inline-flex min-h-12 w-fit items-center justify-center gap-2 rounded-full border border-white/30 bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-black transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-0"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="store-home-section mt-12 lg:mt-16" aria-labelledby="home-category-title">
        <SectionHeading
          id="home-category-title"
          eyebrow="Categorias"
          title="Escolha por categoria"
          description="Encontre camisetas, jaquetas, acessórios e peças para completar o visual."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {categoryTiles.primary.map((tile) => (
            <CategoryTile key={tile.slug} tile={tile} />
          ))}
        </div>

        {categoryTiles.accessories.length ? (
          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-100/70 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-neutral-950">Acessórios por tipo</h3>
                <p className="mt-1 text-sm font-semibold text-neutral-600">Bags, bonés, cuecas, meias, óculos e relógios para fechar o visual.</p>
              </div>
              <Link href="/categoria/acessorios" className="text-xs font-black uppercase tracking-[0.16em] text-neutral-700 hover:text-neutral-950">
                Ver acessórios
              </Link>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {categoryTiles.accessories.map((tile) => (
                <Link
                  key={tile.slug}
                  href={tile.href}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-black text-neutral-800 transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 active:translate-y-0"
                >
                  {tile.name}
                  <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {tile.status === "available" ? tile.total : "Em breve"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="store-home-section mt-12 border-y border-neutral-200 py-8 lg:mt-16" aria-label="Informações da loja">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {getTrustItems(commerce).map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="grid grid-cols-[24px_1fr] gap-4">
              <Icon className="h-5 w-5 text-success" aria-hidden="true" />
              <div><h3 className="text-sm font-black text-neutral-950">{item.title}</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-neutral-500">{item.text}</p></div>
            </article>
          );
        })}
        </div>
      </section>
    </div>
  );
}
