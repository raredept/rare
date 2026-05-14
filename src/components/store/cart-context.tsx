"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  variantId: string;
  title: string;
  slug: string;
  size: string;
  image?: string;
  priceInCents: number;
  quantity: number;
  maxQuantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalInCents: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "rare_store_cart";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    typeof item.variantId === "string" &&
    typeof item.title === "string" &&
    typeof item.slug === "string" &&
    typeof item.size === "string" &&
    typeof item.priceInCents === "number" &&
    typeof item.quantity === "number" &&
    typeof item.maxQuantity === "number" &&
    Number.isInteger(item.priceInCents) &&
    Number.isInteger(item.quantity) &&
    Number.isInteger(item.maxQuantity) &&
    item.priceInCents >= 0 &&
    item.quantity > 0 &&
    item.maxQuantity > 0
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let storedItems: CartItem[] = [];

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          storedItems = parsed.filter(isCartItem).slice(0, 50);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }

    queueMicrotask(() => {
      if (storedItems.length) {
        setItems(storedItems);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      if (items.length) {
        window.localStorage.setItem(storageKey, JSON.stringify(items));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, [hydrated, items]);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const subtotalInCents = useMemo(() => items.reduce((sum, item) => sum + item.priceInCents * item.quantity, 0), [items]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((current) => {
      const safeItem = {
        ...newItem,
        quantity: Math.max(1, Math.min(newItem.maxQuantity, newItem.quantity)),
      };
      const existing = current.find((item) => item.variantId === safeItem.variantId);
      if (!existing) return [...current, safeItem];

      return current.map((item) =>
        item.variantId === safeItem.variantId
          ? { ...item, quantity: Math.min(item.maxQuantity, item.quantity + safeItem.quantity) }
          : item,
      );
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) =>
      current
        .map((item) =>
          item.variantId === variantId ? { ...item, quantity: Math.max(1, Math.min(item.maxQuantity, quantity)) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setItems((current) => (current.length ? [] : current));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      subtotalInCents,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [addItem, clearCart, count, items, removeItem, subtotalInCents, updateQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
