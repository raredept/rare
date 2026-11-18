import { Suspense, type ReactNode } from "react";
import { AssistantLauncher } from "@/components/store/assistant-launcher";
import { CartProvider } from "@/components/store/cart-context";
import { CartDrawer } from "@/components/store/cart-drawer";
import { CookieConsent } from "@/components/store/cookie-consent";
import { SiteAnalytics } from "@/components/store/site-analytics";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";
import { RouteProgress } from "@/components/store/route-progress";
import { getNavigationCategories, getNavigationCollections } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import { getStoreSettings } from "@/lib/settings";
import { getPublicAssistantBootstrap } from "@/lib/assistant/store";

/**
 * The storefront frame (header, cart, consent, footer) shared by the store layout and the 404
 * group (UIUX-404-001), so an unknown URL looks like the store.
 */
export async function StoreChrome({ children }: { children: ReactNode }) {
  // Collections (RARE-COLLECTIONS-CART-01) and the assistant (RARE-FINAL-AUDIT-ASSISTANT-01) load in
  // parallel; a failure in either never takes the store down (the assistant resolves to null).
  const [categories, settings, collections, assistant] = await Promise.all([
    getNavigationCategories(),
    getStoreSettings(),
    getNavigationCollections().catch((error: unknown) => {
      console.error("[collections] navigation failed", error instanceof Error ? error.name : "unknown");
      return [];
    }),
    getPublicAssistantBootstrap(),
  ]);
  const commerce = getStorefrontCommerceState();

  return (
    <CartProvider>
      <div className="storefront-motion-root flex min-h-screen flex-col bg-neutral-50">
        <a href="#store-main" className="store-skip-link">Pular para o conteúdo</a>
        <CookieConsent />
        <SiteAnalytics />
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <StoreHeader categories={categories} collections={collections} />
        <CartDrawer commerce={commerce} />
        <main id="store-main" tabIndex={-1} className="flex-1 bg-neutral-50">{children}</main>
        <StoreFooter categories={categories} whatsappNumber={settings.whatsappNumber} instagramUrl={settings.instagramUrl} commerce={commerce} />
        {assistant ? <AssistantLauncher bootstrap={assistant} /> : null}
      </div>
    </CartProvider>
  );
}
