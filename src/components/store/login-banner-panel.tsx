import type { CSSProperties } from "react";
import Image from "next/image";
import type { HomeBannerSlide } from "@/lib/home-banners";

export function LoginBannerPanel({ banner }: { banner: HomeBannerSlide }) {
  const optimizeLocalFallback = banner.imageUrl === "/brand/rare-logo.png" && !banner.mobileImageUrl;
  const style = {
    objectFit: banner.imageFit ?? "cover",
    "--login-position-desktop": `${banner.imagePositionX ?? 50}% ${banner.imagePositionY ?? 50}%`,
    "--login-position-mobile": `${banner.mobileImagePositionX ?? 50}% ${banner.mobileImagePositionY ?? 50}%`,
  } as CSSProperties;
  return (
    <aside className="relative isolate flex min-h-64 flex-col justify-end overflow-hidden bg-black p-7 text-white sm:p-9 lg:min-h-full">
      <picture className="absolute inset-0 -z-20">
        {banner.mobileImageUrl ? <source media="(max-width: 1023px)" srcSet={banner.mobileImageUrl} /> : null}
        {optimizeLocalFallback ? (
          <Image src={banner.imageUrl} alt={banner.alt} fill sizes="(min-width: 1024px) 480px, 100vw" loading="eager" decoding="async" className="object-[var(--login-position-mobile)] lg:object-[var(--login-position-desktop)]" style={style} />
        ) : (
          <img src={banner.imageUrl} alt={banner.alt} width={800} height={1000} loading="eager" decoding="async" className="h-full w-full object-[var(--login-position-mobile)] lg:object-[var(--login-position-desktop)]" style={style} />
        )}
      </picture>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/60 to-black/10" />
      <div className="mt-20">
        {banner.eyebrow ? <p className="text-xs font-black uppercase tracking-widest text-white/80">{banner.eyebrow}</p> : null}
        {banner.title ? <p className="mt-3 max-w-xs text-2xl font-black leading-tight tracking-tight sm:text-3xl">{banner.title}</p> : null}
        {banner.description ? <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/85">{banner.description}</p> : null}
        {banner.ctaLabel && banner.href ? <a href={banner.href} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-white/70 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{banner.ctaLabel}</a> : null}
      </div>
    </aside>
  );
}
