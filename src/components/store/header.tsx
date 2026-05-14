import { CategoryNav } from "@/components/store/category-nav";
import { HeaderUtilities, SearchBar } from "@/components/store/header-actions";
import { StoreLogo } from "@/components/store/store-logo";
import { getNavigationCategories } from "@/lib/storefront";

type NavigationCategory = Awaited<ReturnType<typeof getNavigationCategories>>[number];

export async function StoreHeader({ categories }: { categories?: NavigationCategory[] } = {}) {
  const navigationCategories = categories ?? (await getNavigationCategories());

  return (
    <header className="sticky top-0 z-40 bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-8 lg:px-8 lg:py-4 xl:px-10">
        <div className="flex items-center justify-between gap-4">
          <StoreLogo />
          <div className="lg:hidden">
            <HeaderUtilities />
          </div>
        </div>
        <div className="flex-1">
          <SearchBar />
        </div>
        <div className="hidden lg:block">
          <HeaderUtilities />
        </div>
      </div>

      <nav className="border-t border-white/10 bg-black">
        <CategoryNav categories={navigationCategories} />
      </nav>
    </header>
  );
}
