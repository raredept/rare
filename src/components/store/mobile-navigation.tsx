"use client";

import { ChevronRight, Menu, PackageCheck, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { virtualCatalogCategories } from "@/lib/catalog-categories";
import { sortByPreferredCategoryOrder } from "@/lib/catalog-shortcuts";
import { useCartDrawer } from "@/components/store/cart-context";

type NavigationCategory = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

const focusableSelector = "a[href],button:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function MobileNavigation({ categories }: { categories: NavigationCategory[] }) {
  const [open, setOpen] = useState(false);
  const { openCart } = useCartDrawer();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const orderedCategories = sortByPreferredCategoryOrder(categories);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center text-white/85 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
        aria-label="Abrir menu"
        aria-expanded={open}
        aria-controls="store-mobile-menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <div
            ref={dialogRef}
            id="store-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-mobile-menu-title"
            className="store-mobile-menu absolute inset-y-0 left-0 flex w-[min(90vw,390px)] flex-col overflow-hidden border-r border-white/15 bg-black text-neutral-100"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">Navegação</p>
                <h2 id="store-mobile-menu-title" className="mt-2 text-2xl font-medium tracking-[0.08em]">RARE</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center text-white/85 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="Fechar menu">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5" onClick={(event) => { if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false); }}>
              <nav aria-label="Categorias mobile">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">Explorar catálogo</p>
                <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                  {[...virtualCatalogCategories, ...orderedCategories].map((category) => (
                    <div key={category.slug}>
                      <Link href={`/categoria/${category.slug}`} className="flex min-h-14 items-center justify-between gap-3 py-3 text-lg font-medium text-white/90 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                        {category.name === "Destaque" ? "Destaques" : category.name}
                        <ChevronRight className="h-4 w-4 text-white/35" aria-hidden="true" />
                      </Link>
                      {"children" in category && category.children.length ? (
                        <div className="mb-4 grid border-l border-white/20 pl-4">
                          {category.children.map((child) => (
                            <Link key={child.id} href={`/categoria/${child.slug}`} className="flex min-h-11 items-center py-2 text-sm font-normal text-white/70 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </nav>

              <nav aria-label="Conta mobile" className="mt-7">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">Sua RARE</p>
                <div className="mt-3 grid divide-y divide-white/10 border-y border-white/10">
                  <Link href="/minha-conta" className="flex min-h-12 items-center gap-3 text-sm font-normal text-white/80 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><UserRound className="h-4 w-4" aria-hidden="true" /> Minha conta</Link>
                  <Link href="/minha-conta/pedidos" className="flex min-h-12 items-center gap-3 text-sm font-normal text-white/80 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><PackageCheck className="h-4 w-4" aria-hidden="true" /> Meus pedidos</Link>
                  <button type="button" data-cart-trigger className="flex min-h-12 items-center gap-3 text-left text-sm font-normal text-white/80 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => { setOpen(false); window.setTimeout(openCart, 180); }}>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Carrinho
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
