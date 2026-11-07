"use client";

import { Search, ShoppingBag, UserRound, PackageCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCart, useCartDrawer } from "@/components/store/cart-context";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  // Layouts persist across navigation. Reset only the form's draft when the URL changes.
  return <CatalogSearchForm key={`${pathname}:${initialQuery}`} compact={compact} initialQuery={initialQuery} />;
}

function CatalogSearchForm({ compact, initialQuery }: { compact: boolean; initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" aria-label="Busca do catálogo" className="flex w-full items-center border-b border-white/35 transition-colors duration-150 focus-within:border-white">
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={compact ? "Buscar no catálogo" : "Buscar peças, marcas ou categorias"}
        aria-label="Buscar no catálogo"
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 min-w-0 flex-1 border-0 bg-transparent pr-3 text-base font-normal text-white outline-none placeholder:text-white/60 focus-visible:outline-none lg:text-sm"
      />
      <button type="submit" aria-label="Buscar no catálogo" className="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}

export function HeaderUtilities({ mobile = false }: { mobile?: boolean }) {
  const { count } = useCart();
  const { isOpen, openCart } = useCartDrawer();
  const pathname = usePathname();

  return (
    <div className={`flex items-center justify-end text-white ${mobile ? "gap-0" : "gap-3"}`}>
      <Link
        href="/minha-conta"
        className={`${mobile ? "flex h-11 w-11 items-center justify-center" : "hidden min-h-11 items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.12em] lg:flex"} text-white/75 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
        aria-label={mobile ? "Minha conta" : undefined}
        aria-current={pathname.startsWith("/minha-conta") && !pathname.includes("/pedidos") ? "page" : undefined}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
        {mobile ? <span className="sr-only">Conta</span> : "Conta"}
      </Link>
      <Link
        href="/minha-conta/pedidos"
        className="hidden min-h-11 items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/75 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:flex"
        aria-current={pathname.startsWith("/minha-conta/pedidos") ? "page" : undefined}
      >
        <PackageCheck className="h-4 w-4" aria-hidden="true" />
        Pedidos
      </Link>
      <button
        type="button"
        data-cart-trigger
        onClick={openCart}
        className="relative flex h-11 w-11 items-center justify-center text-white/85 transition-colors duration-150 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label={`Carrinho com ${count === 1 ? "1 item" : `${count} itens`}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        <span aria-live="polite" className="sr-only">
          {count === 1 ? "1 item no carrinho" : `${count} itens no carrinho`}
        </span>
        {count > 0 ? (
          <span aria-hidden="true" className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-neutral-100 px-1 text-[10px] font-semibold leading-none text-black">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
    </div>
  );
}
