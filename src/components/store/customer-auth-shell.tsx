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
    <div className={`store-shell py-10 sm:py-14 lg:py-16 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid lg:grid-cols-[0.72fr_1fr]">
        <LoginBannerPanel banner={banner ?? getFallbackLoginBanner("customer_login")} />
        <section className="p-6 sm:p-9 lg:p-10">
          <p className="store-section-label">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-neutral-500">{description}</p>
          {children}
        </section>
      </div>
    </div>
  );
}
