import { Suspense, type ReactNode } from "react";
import { CartProvider } from "@/components/store/cart-context";
import { CartDrawer } from "@/components/store/cart-drawer";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";
import { RouteProgress } from "@/components/store/route-progress";
import { getNavigationCategories } from "@/lib/storefront";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [categories, settings] = await Promise.all([getNavigationCategories(), getStoreSettings()]);

  return (
    <CartProvider>
      <div className="storefront-motion-root flex min-h-screen flex-col bg-neutral-50">
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <StoreHeader categories={categories} />
        <CartDrawer />
        <main className="flex-1 bg-neutral-50">{children}</main>
        <StoreFooter categories={categories} whatsappNumber={settings.whatsappNumber} />
      </div>
    </CartProvider>
  );
}
