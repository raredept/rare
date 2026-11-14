"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { hasAnalyticsConsent, parseCookieConsent } from "@/lib/cookie-consent";
import { getConsentSnapshot, subscribeToConsent } from "@/lib/cookie-consent-client";
import { discardAnalyticsQueue, flushAnalyticsQueue, trackAnalyticsEvent } from "@/lib/site-analytics-client";

/**
 * Storefront analytics driver. It renders nothing and, without analytics consent, does nothing:
 * no page view, no product click, no identifier, no request. Product cards opt in with
 * `data-analytics-product`; product views and add-to-cart call trackAnalyticsEvent themselves.
 */
export function SiteAnalytics() {
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => "");
  const granted = hasAnalyticsConsent(parseCookieConsent(snapshot));

  // A page view per navigation, and one for the current page at the moment consent is given.
  useEffect(() => {
    if (!granted) {
      discardAnalyticsQueue();
      return;
    }
    trackAnalyticsEvent("page_view", { path: pathname });
  }, [granted, pathname]);

  useEffect(() => {
    if (!granted) return;

    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-product]") : null;
      const productId = target?.dataset.analyticsProduct;
      if (productId) trackAnalyticsEvent("product_click", { productId });
    }
    function onHidden() {
      if (document.visibilityState === "hidden") flushAnalyticsQueue();
    }

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushAnalyticsQueue);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushAnalyticsQueue);
    };
  }, [granted]);

  return null;
}
