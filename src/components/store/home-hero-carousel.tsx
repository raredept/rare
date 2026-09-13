"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getActiveHomeHeroSlides,
  shouldRenderHomeHeroControls,
  type HomeHeroSlide,
} from "@/lib/home-hero-slides";
import { HomeMotionControl, useHomeCarousel } from "@/components/store/home-motion";
import { getProductMediaRenderPlan, getProductMediaTypeFromUrl } from "@/lib/product-media";

const autoplayMs = 6000;


type HomeHeroCarouselProps = {
  slides: HomeHeroSlide[];
};

function HomeHeroPlaceholder({ label = "Banner RARE" }: { label?: string }) {
  return (
    <div
      className="store-home-hero-placeholder flex h-full w-full items-center justify-center bg-neutral-950 text-white"
      role="img"
      aria-label={label}
    >
      <div className="hidden text-center md:block">
        <p className="text-4xl font-black tracking-[0.24em] sm:text-6xl">RARE</p>
        <div className="mx-auto mt-5 h-px w-20 bg-white/25" />
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.28em] text-white/55 sm:text-xs">
          Editorial streetwear
        </p>
      </div>
    </div>
  );
}

function HomeHeroImage({
  failed,
  index,
  onError,
  mediaPlaying,
  slide,
}: {
  slide: HomeHeroSlide;
  index: number;
  failed: boolean;
  onError: () => void;
  mediaPlaying: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (mediaPlaying) void video.play().catch(() => {});
    else video.pause();
  }, [mediaPlaying, slide.imageUrl]);

  if (!slide.imageUrl || failed) {
    return <HomeHeroPlaceholder label={slide.alt} />;
  }

  const mediaType = getProductMediaTypeFromUrl(slide.imageUrl);
  const mobileMediaType = slide.mobileImageUrl ? getProductMediaTypeFromUrl(slide.mobileImageUrl) : null;
  const desktopRenderPlan = getProductMediaRenderPlan({ url: slide.imageUrl }, "banner", { priority: index === 0 });
  const mobileRenderPlan =
    slide.mobileImageUrl && mobileMediaType !== "video"
      ? getProductMediaRenderPlan({ url: slide.mobileImageUrl }, "banner", { priority: index === 0 })
      : null;
  const videoPoster = mobileRenderPlan?.renderAs === "img" ? mobileRenderPlan.src : undefined;

  if (mediaType === "video") {
    return (
      <div className="relative h-full w-full">
        <HomeHeroPlaceholder label={slide.alt} />
        <video
          ref={videoRef}
          src={slide.imageUrl}
          aria-label={slide.alt}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={mediaPlaying}
          muted
          loop
          playsInline
          poster={videoPoster}
          preload="metadata"
          onError={onError}
        />
      </div>
    );
  }

  if (desktopRenderPlan.renderAs !== "img") {
    return <HomeHeroPlaceholder label={slide.alt} />;
  }

  return (
    <picture>
      {mobileRenderPlan?.renderAs === "img" ? (
        <source media="(max-width: 767px)" srcSet={mobileRenderPlan.srcSet ?? mobileRenderPlan.src} />
      ) : null}
      <img
        src={desktopRenderPlan.src}
        srcSet={desktopRenderPlan.srcSet}
        alt={slide.alt}
        width={desktopRenderPlan.width}
        height={desktopRenderPlan.height}
        sizes={desktopRenderPlan.sizes}
        loading={desktopRenderPlan.loading}
        fetchPriority={desktopRenderPlan.fetchPriority}
        decoding={desktopRenderPlan.decoding}
        className="h-full w-full object-cover"
        onError={onError}
      />
    </picture>
  );
}

export function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const activeSlides = useMemo(() => getActiveHomeHeroSlides(slides), [slides]);
  const [failedSlideIds, setFailedSlideIds] = useState<Set<string>>(() => new Set());
  const { ref: carouselRef, activeIndex, playing, mediaPlaying, interactionProps, move, select } = useHomeCarousel(activeSlides.length, autoplayMs);
  const controlsEnabled = shouldRenderHomeHeroControls(activeSlides.length);
  const normalizedActiveIndex = activeIndex;
  const activeSlide = activeSlides[normalizedActiveIndex];
  const goToPrevious = () => move(-1);
  const goToNext = () => move(1);
  const goToSlide = select;

  if (!activeSlides.length) {
    return (
      <section className="store-home-hero relative overflow-hidden rounded-lg bg-black text-white" aria-label="Destaque RARE">
        <HomeHeroPlaceholder label="Destaque RARE indisponível" />
      </section>
    );
  }

  function markImageFailed(slideId: string) {
    setFailedSlideIds((current) => {
      const next = new Set(current);
      next.add(slideId);
      return next;
    });
  }

  const slideLabel = `${normalizedActiveIndex + 1} de ${activeSlides.length}`;

  return (
    <section
      className="store-home-hero group relative overflow-hidden rounded-lg bg-black text-white shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
      aria-label="Destaques da home RARE"
      aria-roledescription="carousel"
      ref={carouselRef}
      data-playing={playing}
      {...interactionProps}
    >
      <div
        key={activeSlide.id}
        className="store-home-hero-slide relative min-h-[360px] overflow-hidden md:min-h-[460px] xl:min-h-[540px]"
        role="group"
        aria-roledescription="slide"
        aria-label={slideLabel}
      >
        {activeSlide.href && !activeSlide.ctaLabel ? (
          <Link href={activeSlide.href} className="absolute inset-0 z-10" aria-label={`Abrir destaque: ${activeSlide.title ?? activeSlide.alt}`} />
        ) : null}

        <div className="absolute inset-0">
          <HomeHeroImage
            slide={activeSlide}
            index={normalizedActiveIndex}
            failed={failedSlideIds.has(activeSlide.id)}
            onError={() => markImageFailed(activeSlide.id)}
            mediaPlaying={mediaPlaying}
          />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.58)_42%,rgba(0,0,0,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.08)_45%,rgba(0,0,0,0.68)_100%)]" />

        <div className="relative z-20 flex min-h-[360px] max-w-3xl flex-col justify-end px-5 pb-16 pt-7 sm:px-8 md:min-h-[460px] md:px-10 md:py-10 xl:min-h-[540px] xl:px-12">
          {activeSlide.eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/58 sm:text-xs">{activeSlide.eyebrow}</p>
          ) : null}
          {activeSlide.title ? (
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-[0.98] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {activeSlide.title}
            </h2>
          ) : null}
          {activeSlide.description ? (
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/68 sm:text-base">{activeSlide.description}</p>
          ) : null}
          {activeSlide.href && activeSlide.ctaLabel ? (
            <Link
              href={activeSlide.href}
              className="mt-6 inline-flex min-h-12 w-fit items-center justify-center rounded-full border border-white/55 bg-white px-5 text-xs font-black uppercase tracking-[0.18em] text-black transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:translate-y-0"
            >
              {activeSlide.ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {controlsEnabled || getProductMediaTypeFromUrl(activeSlide.imageUrl ?? "") === "video" ? <div className="absolute right-4 top-4 z-30"><HomeMotionControl className="bg-black/70" /></div> : null}
      {controlsEnabled ? (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white opacity-85 backdrop-blur transition-[background-color,border-color,opacity,transform] duration-150 hover:border-white/55 hover:bg-white hover:text-black hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 lg:flex"
            aria-label="Slide anterior"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white opacity-85 backdrop-blur transition-[background-color,border-color,opacity,transform] duration-150 hover:border-white/55 hover:bg-white hover:text-black hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95 lg:flex"
            aria-label="Próximo slide"
            onClick={goToNext}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="absolute bottom-5 left-5 z-30 flex items-center sm:left-8 md:left-10 xl:left-12">
            {activeSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`group/indicator flex h-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                  index === normalizedActiveIndex ? "w-12" : "w-11"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
                aria-current={index === normalizedActiveIndex ? "true" : undefined}
                onClick={() => goToSlide(index)}
              >
                <span
                  aria-hidden="true"
                  className={`block h-2.5 rounded-full transition-[background-color,width] duration-150 ${
                    index === normalizedActiveIndex ? "w-8 bg-white" : "w-2.5 bg-white/35 group-hover/indicator:bg-white/65"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
