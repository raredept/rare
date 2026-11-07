import type { ReactNode } from "react";
import type { HomeBannerSlide } from "@/lib/home-banners";
import { getFallbackLoginBanner } from "@/lib/home-banners";
import { LoginBannerPanel } from "@/components/store/login-banner-panel";

export function CustomerAuthShell({
  eyebrow,
  title,
  description,
  children,
  wide = false,
  banner,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  banner?: HomeBannerSlide;
}) {
  return (
    <div className={`store-shell py-8 sm:py-12 lg:py-16 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
        <LoginBannerPanel banner={banner ?? getFallbackLoginBanner("customer_login")} variant="storefront" />
        <section className="min-w-0 py-2 lg:py-8">
          <p className="store-section-label">{eyebrow}</p>
          <h1 className="mt-4 text-3xl font-medium tracking-tight text-neutral-950 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-600">{description}</p>
          {children}
        </section>
      </div>
    </div>
  );
}
