"use client";

import { ChevronRight, Menu, PackageCheck, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { virtualCatalogCategories } from "@/lib/catalog-categories";
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
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

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
        className="store-icon-button border-white/15 text-white lg:hidden"
        aria-label="Abrir menu"
        aria-expanded={open}
        aria-controls="store-mobile-menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <button className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside
            ref={dialogRef}
            id="store-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-mobile-menu-title"
            className="store-mobile-menu absolute inset-y-0 left-0 flex w-[min(90vw,390px)] flex-col overflow-hidden bg-neutral-950 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/45">Navegação</p>
                <h2 id="store-mobile-menu-title" className="mt-1 text-2xl font-black tracking-tight">RARE</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="store-icon-button border-white/15" aria-label="Fechar menu">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5" onClick={(event) => { if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false); }}>
              <nav aria-label="Categorias mobile">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">Comprar por categoria</p>
                <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                  {[...virtualCatalogCategories, ...categories].map((category) => (
                    <div key={category.slug}>
                      <Link href={`/categoria/${category.slug}`} className="flex min-h-13 items-center justify-between gap-3 py-3 text-base font-black">
                        {category.name === "Destaque" ? "Destaques" : category.name}
                        <ChevronRight className="h-4 w-4 text-white/35" aria-hidden="true" />
                      </Link>
                      {"children" in category && category.children.length ? (
                        <div className="mb-3 grid grid-cols-2 gap-2 pl-3">
                          {category.children.map((child) => (
                            <Link key={child.id} href={`/categoria/${child.slug}`} className="min-h-11 rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-white/65">
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
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">Sua RARE</p>
                <div className="mt-3 grid gap-2">
                  <Link href="/minha-conta" className="flex min-h-12 items-center gap-3 rounded-md bg-white/[0.06] px-4 text-sm font-black"><UserRound className="h-4 w-4" /> Minha conta</Link>
                  <Link href="/minha-conta/pedidos" className="flex min-h-12 items-center gap-3 rounded-md bg-white/[0.06] px-4 text-sm font-black"><PackageCheck className="h-4 w-4" /> Meus pedidos</Link>
                  <button type="button" data-cart-trigger className="flex min-h-12 items-center gap-3 rounded-md bg-white/[0.06] px-4 text-left text-sm font-black" onClick={() => { setOpen(false); window.setTimeout(openCart, 180); }}>
                    <ShoppingBag className="h-4 w-4" /> Carrinho
                  </button>
                </div>
              </nav>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
