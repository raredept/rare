"use client";

import { Search, ShoppingBag, UserRound, PackageCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCart, useCartDrawer } from "@/components/store/cart-context";

export function SearchBar() {
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
    <form onSubmit={onSubmit} className="relative mx-auto w-full max-w-2xl">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="O que você procura?"
        className="h-12 w-full rounded-full border border-white/20 bg-white px-11 text-sm font-semibold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:ring-2 focus:ring-white/50"
      />
    </form>
  );
}

export function HeaderUtilities() {
  const { count } = useCart();
  const { isOpen, openCart } = useCartDrawer();

  return (
    <div className="flex items-center justify-end gap-2 text-white">
      <Link
        href="/minha-conta"
        className="hidden h-11 items-center gap-2 rounded-full px-3 text-xs font-bold uppercase tracking-wide text-white/80 transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:flex"
      >
        <UserRound className="h-4 w-4" />
        Conta
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
        onClick={openCart}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label={`Carrinho com ${count} item(s)`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ShoppingBag className="h-5 w-5" />
        <span aria-live="polite" className="sr-only">
          {count} item(s) no carrinho
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
