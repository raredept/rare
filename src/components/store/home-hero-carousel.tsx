"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  getActiveHomeHeroSlides,
  shouldRenderHomeHeroControls,
  type HomeHeroSlide,
} from "@/lib/home-hero-slides";
import { useHomeCarousel } from "@/components/store/home-motion";
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
      <div className="text-center opacity-25">
        <p className="text-[clamp(5rem,20vw,22rem)] font-semibold leading-none tracking-[-0.08em]">RARE</p>
        <div className="mx-auto mt-5 h-px w-20 bg-white/25" />
        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.2em] text-white sm:text-xs">
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
  const mediaStyle = {
    objectFit: slide.imageFit ?? "cover",
    "--hero-position-desktop": `${slide.imagePositionX ?? 50}% ${slide.imagePositionY ?? 50}%`,
    "--hero-position-mobile": `${slide.mobileImagePositionX ?? 50}% ${slide.mobileImagePositionY ?? 50}%`,
  } as CSSProperties;
  const mediaClass = "h-full w-full object-[var(--hero-position-mobile)] md:object-[var(--hero-position-desktop)]";

  if (mediaType === "video") {
    return (
      <div className="relative h-full w-full">
        <HomeHeroPlaceholder label={slide.alt} />
        <video
          ref={videoRef}
          src={slide.imageUrl}
          aria-label={slide.alt}
          className={`absolute inset-0 ${mediaClass}`}
          style={mediaStyle}
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
        className={mediaClass}
        style={mediaStyle}
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
      <section className="store-home-hero relative h-[60svh] min-h-[420px] overflow-hidden bg-black text-white" aria-label="Destaque RARE">
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
      className="store-home-hero group relative overflow-hidden bg-black text-white"
      aria-label="Destaques da home RARE"
      aria-roledescription="carousel"
      ref={carouselRef}
      data-playing={playing}
      {...interactionProps}
    >
      <div
        key={activeSlide.id}
        className="store-home-hero-slide relative min-h-[520px] overflow-hidden md:min-h-[580px] xl:min-h-[640px]"
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

        {/* 60% black keeps small white text readable even over a white banner. */}
        <div className="absolute inset-0 bg-black/60" />

        <div className="store-shell relative z-20 flex min-h-[520px] flex-col justify-end pb-20 pt-12 md:min-h-[580px] md:pb-24 xl:min-h-[640px]">
          {activeSlide.eyebrow ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/90">{activeSlide.eyebrow}</p>
          ) : null}
          {activeSlide.title ? (
            <h2 className="mt-5 max-w-[900px] text-[clamp(2.75rem,6.5vw,6.5rem)] font-medium leading-[0.98] tracking-[-0.055em] text-white">
              {activeSlide.title}
            </h2>
          ) : null}
          {activeSlide.description ? (
            <p className="mt-5 max-w-lg text-sm font-normal leading-6 text-white/90 sm:text-base">{activeSlide.description}</p>
          ) : null}
          {activeSlide.href && activeSlide.ctaLabel ? (
            <Link
              href={activeSlide.href}
              className="mt-8 inline-flex min-h-12 w-fit items-center justify-center border border-white bg-white px-7 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors duration-150 hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {activeSlide.ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {controlsEnabled ? (
        <div className="store-shell absolute inset-x-0 bottom-5 z-30 flex items-center gap-4">
          <div className="scrollbar-none flex min-w-0 flex-1 touch-pan-x items-center overflow-x-auto" role="group" aria-label="Selecionar slide">
            {activeSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`group/indicator flex h-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${
                  index === normalizedActiveIndex ? "w-12" : "w-11"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
                aria-current={index === normalizedActiveIndex ? "true" : undefined}
                onClick={() => goToSlide(index)}
              >
                <span
                  aria-hidden="true"
                  className={`block h-2.5 rounded-full transition-[background-color,width] duration-150 ${
                    index === normalizedActiveIndex ? "w-8 bg-white" : "w-2.5 bg-white/60 group-hover/indicator:bg-white/80"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center border border-white/60 bg-black/50 text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Slide anterior"
              onClick={goToPrevious}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center border border-white/60 bg-black/50 text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Próximo slide"
              onClick={goToNext}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
