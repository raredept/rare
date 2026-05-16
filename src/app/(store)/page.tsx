import type { Metadata } from "next";
import { ArrowRight, CreditCard, Headphones, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { HomeHeroCarousel } from "@/components/store/home-hero-carousel";
import { ProductCard } from "@/components/store/product-card";
import { getHomeBannerSlidesForStore } from "@/lib/home-banners";
import { getFeaturedProducts, getHomeCategoryTiles, getProducts, getRecentProducts, type HomeCategoryTile, type StorefrontProduct } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "RARE — Streetwear importado e drops selecionados",
  },
  description: "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "RARE — Streetwear importado e drops selecionados",
    description: "Peças importadas, streetwear e acessórios selecionados para quem busca sair do comum.",
    type: "website",
  },
};

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

const trustItems = [
  {
    title: "Compra segura",
    text: "Ambiente protegido e fluxo oficial para finalizar o pedido.",
    icon: ShieldCheck,
  },
  {
    title: "Pix e cartão",
    text: "Pagamento por Pix ou cartão no checkout da loja.",
    icon: CreditCard,
  },
  {
    title: "Envio para todo o Brasil",
    text: "Frete e prazo calculados com CEP antes da finalização.",
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
];

function ProductGrid({ products, columns = "featured" }: { products: StorefrontProduct[]; columns?: "featured" | "recent" }) {
  const gridClass =
    columns === "featured"
      ? "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8"
      : "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-4 xl:gap-x-8";

  return (
    <div className={`${gridClass} lg:gap-x-6 lg:gap-y-10`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
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

function SearchResults({ products, query }: { products: StorefrontProduct[]; query: string }) {
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
        <ProductGrid products={products} />
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
  const searchQuery = q?.trim() ?? "";
  const isSearch = Boolean(searchQuery);

  if (isSearch) {
    const products = await getProducts({ query: searchQuery });
    return <SearchResults products={products} query={searchQuery} />;
  }

  const [heroSlides, categoryTiles, featuredProducts, recentProducts] = await Promise.all([
    getHomeBannerSlidesForStore(),
    getHomeCategoryTiles(),
    getFeaturedProducts({ limit: 5 }),
    getRecentProducts({ limit: 4 }),
  ]);
  const selectedFeaturedProducts = featuredProducts.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8 xl:px-10">
      <HomeHeroCarousel slides={heroSlides} />

      <section className="store-home-section mt-10 lg:mt-12" aria-labelledby="home-category-title">
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
                <p className="mt-1 text-sm font-semibold text-neutral-500">Bags, bonés, cuecas, meias, óculos e relógios para fechar o visual.</p>
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

      <section className="store-home-section mt-12 lg:mt-16" aria-labelledby="home-featured-title">
        <SectionHeading
          id="home-featured-title"
          eyebrow="Favoritos"
          title="Destaques do mês"
          description="Os favoritos da RARE agora."
          action={{ href: "/categoria/destaques", label: "Ver todos os destaques" }}
        />
        {selectedFeaturedProducts.length ? (
          <ProductGrid products={selectedFeaturedProducts} />
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

      <section className="store-home-section mt-12 grid gap-3 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3" aria-label="Benefícios da loja">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-lg border border-neutral-200 bg-white p-5">
              <Icon className="h-5 w-5 text-success" aria-hidden="true" />
              <h3 className="mt-4 text-base font-black text-neutral-950">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-neutral-500">{item.text}</p>
            </article>
          );
        })}
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
          <ProductGrid products={recentProducts} columns="recent" />
        </section>
      ) : null}

      <section className="store-home-section mt-12 overflow-hidden rounded-lg bg-black px-6 py-10 text-white sm:px-8 lg:mt-16 lg:px-10 lg:py-12">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-white/45">Drop RARE</p>
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
    </div>
  );
}
