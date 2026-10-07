import { Suspense, type ReactNode } from "react";
import { CartProvider } from "@/components/store/cart-context";
import { CartDrawer } from "@/components/store/cart-drawer";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";
import { RouteProgress } from "@/components/store/route-progress";
import { getNavigationCategories } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [categories, settings] = await Promise.all([getNavigationCategories(), getStoreSettings()]);
  const commerce = getStorefrontCommerceState();

  return (
    <CartProvider>
      <div className="storefront-motion-root flex min-h-screen flex-col">
        <a href="#store-main" tabIndex={0} className="store-skip-link">Pular para o conteúdo</a>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <StoreHeader categories={categories} />
        <CartDrawer commerce={commerce} />
        <main id="store-main" tabIndex={-1} className="flex-1">{children}</main>
        <StoreFooter categories={categories} whatsappNumber={settings.whatsappNumber} instagramUrl={settings.instagramUrl} commerce={commerce} />
      </div>
    </CartProvider>
  );
}
