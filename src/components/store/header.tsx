import { CategoryNav } from "@/components/store/category-nav";
import { HeaderUtilities, SearchBar } from "@/components/store/header-actions";
import { StoreLogo } from "@/components/store/store-logo";
import { MobileNavigation } from "@/components/store/mobile-navigation";
import type { NavigationCollection } from "@/lib/promotions/collections";
import { getNavigationCategories } from "@/lib/storefront";

type NavigationCategory = Awaited<ReturnType<typeof getNavigationCategories>>[number];

export async function StoreHeader({ categories, collections = [] }: { categories?: NavigationCategory[]; collections?: NavigationCollection[] } = {}) {
  const navigationCategories = categories ?? (await getNavigationCategories());

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black text-white">
      <div className="store-shell py-3 lg:py-4">
        <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 lg:hidden">
          <MobileNavigation categories={navigationCategories} collections={collections} />
          <div className="justify-self-center"><StoreLogo /></div>
          <HeaderUtilities mobile />
        </div>
        <div className="mt-3 lg:hidden">
          <SearchBar compact />
        </div>

        <div className="hidden items-center gap-8 lg:flex">
          <StoreLogo />
          <div className="flex-1"><SearchBar /></div>
          <HeaderUtilities />
        </div>
      </div>

      <nav aria-label="Navegação por categoria" className="hidden border-t border-white/10 bg-black lg:block">
        <CategoryNav categories={navigationCategories} collections={collections} />
      </nav>
    </header>
  );
}
