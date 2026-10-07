import { ArrowRight, Headphones, PackageSearch, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { HomeHeroCarousel } from "@/components/store/home-hero-carousel";
import { HomeMotionProvider } from "@/components/store/home-motion";
import { HomeBrandsStrip } from "@/components/store/home-brands-strip";
import { HomeFeaturedCarousel, type HomeFeaturedSlide } from "@/components/store/home-featured-carousel";
import { ProductCard } from "@/components/store/product-card";
import { getHomeBannerSlidesForStore } from "@/lib/home-banners";
import { buildPageMetadata, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, JsonLdScript } from "@/lib/structured-data";
import { getAvailableBrandsForStore, getFeaturedProducts, getHomeCategoryTiles, getProducts, getRecentProducts, type HomeCategoryTile, type StorefrontProduct } from "@/lib/storefront";
import { getStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";
import { getProductMediaTypeFromUrl } from "@/lib/product-media";
import { getAvailableStock } from "@/lib/stock";
import { getStoreSettings } from "@/lib/settings";

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

function ProductGrid({
  products,
  commerce,
  featured = false,
  priorityFirst = false,
  headingLevel = 2,
}: {
  products: StorefrontProduct[];
  commerce: StorefrontCommerceState;
  featured?: boolean;
  priorityFirst?: boolean;
  headingLevel?: 2 | 3;
}) {
  return (
    <div className={`grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 md:grid-cols-3 lg:gap-x-6 lg:gap-y-12 ${featured ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} commerce={commerce} priority={priorityFirst && index === 0} headingLevel={headingLevel}
          mediaSizes={featured ? "(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 20vw, 264px" : undefined} />
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
    <div className="mb-8 flex flex-col gap-5 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        <p className="store-section-label">{eyebrow}</p>
        <h2 id={id} className="store-section-title mt-3 text-neutral-950">
          {title}
        </h2>
        <p className="mt-4 text-sm font-normal leading-6 text-neutral-600 lg:text-base">{description}</p>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="store-section-link shrink-0"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function CategoryTile({ tile, index }: { tile: HomeCategoryTile; index: number }) {
  return (
    <Link
      href={tile.href}
      className="store-home-category group grid min-h-36 grid-cols-[2rem_1fr_auto] items-start gap-4 border-t border-neutral-400 py-7 transition-colors duration-150 hover:border-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950"
    >
      <span aria-hidden="true" className="pt-1 text-xs tabular-nums text-neutral-600">{String(index + 1).padStart(2, "0")}</span>
      <span>
        <span className="block text-2xl font-medium tracking-tight text-neutral-950 lg:text-3xl">{tile.name}</span>
        <span className="mt-3 block max-w-xs text-sm font-normal leading-6 text-neutral-600">{tile.description}</span>
        <span className="mt-5 block text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
          {tile.status === "available" ? `${tile.total} produto${tile.total === 1 ? "" : "s"}` : "Em breve"}
        </span>
      </span>
      <ArrowRight className="mt-1 h-5 w-5 text-neutral-600 group-hover:text-neutral-950" aria-hidden="true" />
    </Link>
  );
}

function SearchResults({ products, query, commerce }: { products: StorefrontProduct[]; query: string; commerce: StorefrontCommerceState }) {
  return (
    <div className="store-shell pb-16 pt-10 lg:pb-24 lg:pt-16">
      <section className="mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-8 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="store-section-label">Busca</p>
          <h1 className="store-display mt-4 break-words text-neutral-950">{`Resultado para "${query}"`}</h1>
          <p className="mt-4 max-w-2xl text-sm font-normal leading-6 text-neutral-600 lg:text-base">
            Peças encontradas pelo que você buscou.
          </p>
        </div>
      </section>

      {products.length ? (
        <ProductGrid products={products} commerce={commerce} />
      ) : (
        <div className="border-y border-neutral-300 px-6 py-20 text-center">
          <h2 className="store-section-title text-neutral-950">Nada encontrado por aqui.</h2>
          <p className="mt-4 text-sm text-neutral-600">Tente outro nome, marca ou categoria.</p>
          <Link
            href="/categoria/tudo"
            className="store-button-primary mt-8"
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

  const [heroSlides, categoryTiles, featuredProducts, recentProducts, brands, settings] = await Promise.all([
    getHomeBannerSlidesForStore(),
    getHomeCategoryTiles(),
    getFeaturedProducts({ limit: 8 }),
    getRecentProducts({ limit: 4 }),
    getAvailableBrandsForStore(),
    getStoreSettings(),
  ]);
  const selectedFeaturedProducts = featuredProducts.slice(0, 5);
  const featuredSlides: HomeFeaturedSlide[] = featuredProducts.flatMap((product) => {
    const image = product.images.find((media) => getProductMediaTypeFromUrl(media.url) === "image");
    if (!image) return [];
    return [{ id: product.id, title: product.title, slug: product.slug, priceInCents: product.priceInCents,
      soldOut: !product.variants.some((variant) => variant.active && getAvailableStock(variant.stock, variant.reservedStock) > 0),
      image: { url: image.url, alt: image.alt || product.title },
    }];
  });
  const appUrl = RARE_DEFAULT_SITE_URL;
  const organizationJsonLd = buildOrganizationJsonLd(appUrl, settings.instagramUrl);
  const websiteJsonLd = buildWebsiteJsonLd(appUrl);

  return (
    <HomeMotionProvider>
    <HomeBrandsStrip brands={brands} />
      <JsonLdScript id="rare-organization-json-ld" data={organizationJsonLd} />
      <JsonLdScript id="rare-website-json-ld" data={websiteJsonLd} />
      <h1 className="sr-only">RARE — streetwear importado e drops selecionados</h1>
      <HomeHeroCarousel slides={heroSlides} />
    <div className="store-shell pb-16 lg:pb-24">

      <section className="store-home-section store-editorial-section" aria-labelledby="home-featured-title">
        <SectionHeading
          id="home-featured-title"
          eyebrow="Favoritos"
          title="Destaques do mês"
          description="Os favoritos da RARE agora."
          action={{ href: "/categoria/destaques", label: "Ver todos os destaques" }}
        />
        {selectedFeaturedProducts.length ? (
          <ProductGrid products={selectedFeaturedProducts} commerce={commerce} featured headingLevel={3} />
        ) : (
          <div className="border-y border-neutral-300 px-6 py-16 text-center">
            <h3 className="text-lg font-medium text-neutral-950">Nenhum destaque ativo no momento.</h3>
            <p className="mt-2 text-sm font-normal text-neutral-600">Volte em breve ou explore o catálogo completo.</p>
            <Link href="/categoria/tudo" className="store-button-primary mt-6">
              Ver catálogo completo
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="home-limited-title" className="store-home-section store-editorial-section overflow-hidden bg-neutral-950 px-6 py-12 text-white sm:px-10 lg:px-16 lg:py-16">
        <div className={`grid items-center gap-8 lg:gap-12 ${featuredSlides.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]" : ""}`}>
        <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/80">Drop RARE</p>
        <div className="mt-5 flex flex-col gap-6">
          <div className="max-w-3xl">
            <h2 id="home-limited-title" className="store-display max-w-xl">Estoque limitado. Escolha sem pressa, mas não deixa passar.</h2>
            <p className="mt-6 max-w-2xl text-sm font-normal leading-6 text-white/80 sm:text-base">
              Quando uma peça sai, pode não voltar tão cedo.
            </p>
          </div>
          <Link
            href="/categoria/tudo"
            className="inline-flex min-h-12 w-fit items-center justify-center gap-3 border border-white bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors hover:bg-transparent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Ver catálogo completo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        </div>
        <HomeFeaturedCarousel products={featuredSlides} />
        </div>
      </section>

      <section className="store-home-section store-editorial-section" aria-labelledby="home-category-title">
        <SectionHeading
          id="home-category-title"
          eyebrow="Categorias"
          title="Escolha por categoria"
          description="Encontre camisetas, jaquetas, acessórios e peças para completar o visual."
        />
        <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {categoryTiles.primary.map((tile, index) => (
            <CategoryTile key={tile.slug} tile={tile} index={index} />
          ))}
        </div>

        {categoryTiles.accessories.length ? (
          <div className="mt-8 border-y border-neutral-300 py-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-medium tracking-tight text-neutral-950">Acessórios por tipo</h3>
                <p className="mt-2 text-sm font-normal text-neutral-600">Bags, bonés, cuecas, meias, óculos e relógios para fechar o visual.</p>
              </div>
              <Link href="/categoria/acessorios" className="store-section-link">
                Ver acessórios
              </Link>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {categoryTiles.accessories.map((tile) => (
                <Link
                  key={tile.slug}
                  href={tile.href}
                  className="inline-flex min-h-11 shrink-0 items-center gap-3 border-b border-neutral-400 px-3 text-sm font-medium text-neutral-950 transition-colors hover:border-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
                >
                  {tile.name}
                  <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-600">
                    {tile.status === "available" ? tile.total : "Em breve"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {recentProducts.length ? (
        <section className="store-home-section store-editorial-section" aria-labelledby="home-recent-title">
          <SectionHeading
            id="home-recent-title"
            eyebrow="Novidades"
            title="Chegou agora"
            description="Peças recém adicionadas ao catálogo."
            action={{ href: "/categoria/tudo", label: "Ver catálogo completo" }}
          />
          <ProductGrid products={recentProducts} commerce={commerce} headingLevel={3} />
        </section>
      ) : null}

      <section className="store-home-section store-editorial-section border-t border-neutral-300 pt-10" aria-label="Informações da loja">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {getTrustItems(commerce).map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="grid grid-cols-[24px_1fr] gap-4">
              <Icon className="h-5 w-5 text-neutral-950" aria-hidden="true" />
              <div><h3 className="text-sm font-medium text-neutral-950">{item.title}</h3>
              <p className="mt-2 text-sm font-normal leading-6 text-neutral-600">{item.text}</p></div>
            </article>
          );
        })}
        </div>
      </section>
    </div>
    </HomeMotionProvider>
  );
}
