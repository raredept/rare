"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The Stripe webhook can land a moment after the shopper returns. Re-read the server-rendered
// status every few seconds for a bounded time so "waiting for payment" resolves by itself.
export const ORDER_STATUS_REFRESH_INTERVAL_MS = 3_000;
export const ORDER_STATUS_REFRESH_MAX_ATTEMPTS = 20;

export function OrderStatusRefresh({
  active,
  intervalMs = ORDER_STATUS_REFRESH_INTERVAL_MS,
  maxAttempts = ORDER_STATUS_REFRESH_MAX_ATTEMPTS,
}: {
  active: boolean;
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= maxAttempts) window.clearInterval(timer);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs, maxAttempts, router]);

  return null;
}
