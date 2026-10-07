import { CategoryNav } from "@/components/store/category-nav";
import { HeaderUtilities, SearchBar } from "@/components/store/header-actions";
import { StoreLogo } from "@/components/store/store-logo";
import { MobileNavigation } from "@/components/store/mobile-navigation";
import { getNavigationCategories } from "@/lib/storefront";

type NavigationCategory = Awaited<ReturnType<typeof getNavigationCategories>>[number];

export async function StoreHeader({ categories }: { categories?: NavigationCategory[] } = {}) {
  const navigationCategories = categories ?? (await getNavigationCategories());

  return (
    <header className="store-header sticky top-0 z-40 border-b border-white/15 bg-black text-neutral-100">
      <div className="store-shell pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 lg:hidden">
          <div className="justify-self-start"><MobileNavigation categories={navigationCategories} /></div>
          <div className="justify-self-center"><StoreLogo /></div>
          <div className="justify-self-end"><HeaderUtilities mobile /></div>
        </div>
        <div className="mt-2 lg:hidden">
          <SearchBar compact />
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8 lg:grid">
          <div className="w-full max-w-sm justify-self-start"><SearchBar /></div>
          <div className="justify-self-center"><StoreLogo /></div>
          <div className="justify-self-end"><HeaderUtilities /></div>
        </div>
      </div>

      <nav aria-label="Navegação por categoria" className="hidden border-t border-white/10 bg-black lg:block">
        <CategoryNav categories={navigationCategories} />
      </nav>
    </header>
  );
}
