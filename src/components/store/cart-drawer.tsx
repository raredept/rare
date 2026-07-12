"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useCart, useCartDrawer, type CartItem } from "@/components/store/cart-context";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { formatMoney } from "@/lib/money";
import { buildStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function CartDrawer({ commerce = buildStorefrontCommerceState(true) }: { commerce?: StorefrontCommerceState }) {
  const { items, count, subtotalInCents, updateQuantity, removeItem } = useCart();
  const { isOpen, closeCart } = useCartDrawer();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousPathnameRef = useRef(pathname);
  const itemLabel = count === 1 ? "1 item" : `${count} itens`;

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    closeCart();
  }, [closeCart, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCart();
        return;
      }

      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );
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
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
  }, [closeCart, isOpen]);

  const drawerTotal = useMemo(() => formatMoney(subtotalInCents), [subtotalInCents]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]" data-cart-drawer-root>
      <div
        className="store-cart-drawer-overlay absolute inset-0 bg-black/72 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={closeCart}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="store-cart-drawer absolute right-0 top-0 flex h-full w-[calc(100vw-24px)] max-w-[460px] flex-col border-l border-white/10 bg-neutral-950 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:w-[460px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/65">Carrinho</p>
            <h2 id="cart-drawer-title" className="mt-1 text-2xl font-black tracking-tight">
              Sua seleção
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/55" aria-live="polite">
              {itemLabel}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeCart}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white transition-[background-color,border-color,transform] duration-150 hover:border-white/35 hover:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="space-y-3">
              {items.map((item) => (
                <CartDrawerItem
                  key={item.variantId}
                  item={item}
                  updateQuantity={updateQuantity}
                  removeItem={removeItem}
                  closeCart={closeCart}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <ShoppingBag className="h-6 w-6 text-white/70" />
              </div>
              <p className="mt-5 text-xl font-black tracking-tight">Sua seleção ainda está vazia.</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/55">Guarde aqui as peças que você quer acompanhar.</p>
            </div>
          </div>
        )}

        <div className="border-t border-white/10 bg-neutral-950 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-white/60">Subtotal</span>
            <span className="whitespace-nowrap text-xl font-black">{drawerTotal}</span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-white/65">
            {commerce.checkoutEnabled ? "Frete e prazo são calculados ao finalizar a compra." : "O catálogo segue aberto, mas as compras estão temporariamente pausadas."}
          </p>
          <div className="mt-5 grid gap-3">
            {commerce.checkoutEnabled ? (
              <Link href="/finalizar-compra" onClick={closeCart} className="flex min-h-12 items-center justify-center rounded-md bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-black transition-[background-color,transform] duration-150 hover:bg-neutral-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                {commerce.checkoutActionLabel}
              </Link>
            ) : (
              <button type="button" disabled className="flex min-h-12 items-center justify-center rounded-md bg-white/15 px-5 text-xs font-black uppercase tracking-[0.13em] text-white/65">
                {commerce.checkoutActionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={closeCart}
              className="flex min-h-12 items-center justify-center rounded-lg border border-white/15 px-5 text-xs font-black uppercase tracking-[0.16em] text-white transition-[background-color,border-color,transform] duration-150 hover:border-white/35 hover:bg-white/10 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Continuar comprando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawerItem({
  item,
  updateQuantity,
  removeItem,
  closeCart,
}: {
  item: CartItem;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  closeCart: () => void;
}) {
  const canDecrease = item.quantity > 1;
  const canIncrease = item.quantity < item.maxQuantity;

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex gap-3">
        <Link
          href={`/produto/${item.slug}`}
          onClick={closeCart}
          className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label={`Ver ${item.title}`}
        >
          {item.image ? (
            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <ProductMediaPlaceholder compact className="rounded-lg" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/produto/${item.slug}`}
            onClick={closeCart}
            className="line-clamp-2 text-sm font-black leading-5 text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {item.title}
          </Link>
          <p className="mt-1 text-xs font-semibold text-white/65">Tamanho: {item.size}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="whitespace-nowrap text-sm font-black text-success">{formatMoney(item.priceInCents)}</span>
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-xs font-bold text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label={`Remover ${item.title}`}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex h-10 items-center rounded-lg border border-white/15">
          <button
            type="button"
            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
            disabled={!canDecrease}
            className="flex h-10 w-10 items-center justify-center text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-black" aria-label={`Quantidade ${item.quantity}`}>
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
            disabled={!canIncrease}
            className="flex h-10 w-10 items-center justify-center text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Subtotal</p>
          <p className="mt-1 whitespace-nowrap text-sm font-black">{formatMoney(item.priceInCents * item.quantity)}</p>
        </div>
      </div>
    </article>
  );
}
