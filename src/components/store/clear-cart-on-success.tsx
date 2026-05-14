"use client";

import { useEffect } from "react";
import { useCart } from "@/components/store/cart-context";

export function ClearCartOnSuccess() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return null;
}
