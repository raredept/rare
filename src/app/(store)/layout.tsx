import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "@/components/store/cart-context";
import { StoreHeader } from "@/components/store/header";
import { RouteProgress } from "@/components/store/route-progress";
import { getNavigationCategories } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const categories = await getNavigationCategories();
  const year = new Date().getFullYear();

  return (
    <CartProvider>
      <div className="storefront-motion-root flex min-h-screen flex-col bg-neutral-50">
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <StoreHeader categories={categories} />
        <main className="flex-1 bg-neutral-50">{children}</main>
        <footer className="border-t border-white/10 bg-black text-white">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8 lg:py-12 xl:px-10">
            <div>
              <p className="text-2xl font-black tracking-[0.2em]">RARE</p>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/60">
                Curadoria streetwear e importados selecionados em uma experiência de compra limpa, segura e direta.
              </p>
            </div>

            <nav aria-label="Categorias do rodapé">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Categorias</p>
              <div className="mt-4 grid gap-3 text-sm font-bold text-white/75">
                <Link href="/" className="inline-flex min-h-11 items-center transition hover:text-white">
                  Tudo
                </Link>
                {categories.map((category) => (
                  <Link key={category.id} href={`/categoria/${category.slug}`} className="inline-flex min-h-11 items-center transition hover:text-white">
                    {category.name}
                  </Link>
                ))}
              </div>
            </nav>

            <nav aria-label="Atendimento e políticas">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Atendimento</p>
              <div className="mt-4 grid gap-3 text-sm font-bold text-white/75">
                <Link href="/trocas-e-devolucoes" className="inline-flex min-h-11 items-center transition hover:text-white">
                  Trocas e devoluções
                </Link>
                <Link href="/minha-conta" className="inline-flex min-h-11 items-center transition hover:text-white">
                  Minha conta
                </Link>
                <Link href="/cart" className="inline-flex min-h-11 items-center transition hover:text-white">
                  Carrinho
                </Link>
              </div>
            </nav>
          </div>
          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-xs font-bold uppercase tracking-[0.16em] text-white/45 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
              <p>© {year} RARE</p>
              <p>Pix e cartão via Stripe. Envio para todo o Brasil.</p>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
