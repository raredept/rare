"use client";

import { Search, ShoppingBag, UserRound, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCart, useCartDrawer } from "@/components/store/cart-context";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="relative mx-auto w-full max-w-2xl">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar peças, marcas ou categorias"
        aria-label="Buscar no catálogo"
        className={`${compact ? "h-11" : "h-12"} w-full rounded-md border border-white/15 bg-white px-11 text-sm font-semibold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-white/50`}
      />
    </form>
  );
}

export function HeaderUtilities({ mobile = false }: { mobile?: boolean }) {
  const { count } = useCart();
  const { isOpen, openCart } = useCartDrawer();
  const pathname = usePathname();

  return (
    <div className={`flex items-center justify-end text-white ${mobile ? "gap-0" : "gap-2"}`}>
      <Link
        href="/minha-conta"
        className={`${mobile ? "store-icon-button border-transparent" : "hidden h-11 items-center gap-2 rounded-full px-3 text-xs font-bold uppercase tracking-wide lg:flex"} text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
        aria-label={mobile ? "Minha conta" : undefined}
        aria-current={pathname.startsWith("/minha-conta") && !pathname.includes("/pedidos") ? "page" : undefined}
      >
        <UserRound className="h-4 w-4" />
        {mobile ? <span className="sr-only">Conta</span> : "Conta"}
      </Link>
      <Link
        href="/minha-conta/pedidos"
        className="hidden h-11 items-center gap-2 rounded-full px-3 text-xs font-bold uppercase tracking-wide text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:flex"
      >
        <PackageCheck className="h-4 w-4" />
        Pedidos
      </Link>
      <button
        type="button"
        data-cart-trigger
        onClick={openCart}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label={`Carrinho com ${count === 1 ? "1 item" : `${count} itens`}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ShoppingBag className="h-5 w-5" />
        <span aria-live="polite" className="sr-only">
          {count === 1 ? "1 item no carrinho" : `${count} itens no carrinho`}
        </span>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
    </div>
  );
}
