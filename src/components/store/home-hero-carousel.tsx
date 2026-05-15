"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  getActiveHomeHeroSlides,
  getNextHomeHeroSlideIndex,
  getPreviousHomeHeroSlideIndex,
  normalizeHomeHeroSlideIndex,
  selectHomeHeroSlideIndex,
  shouldRenderHomeHeroControls,
  type HomeHeroSlide,
} from "@/lib/home-hero-slides";

const autoplayMs = 6000;
const swipeThresholdPx = 48;

type HomeHeroCarouselProps = {
  slides: HomeHeroSlide[];
};

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function syncPreference() {
      setReducedMotion(mediaQuery.matches);
    }

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);

    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  return reducedMotion;
}

function HomeHeroPlaceholder({ label = "Banner RARE" }: { label?: string }) {
  return (
    <div className="store-home-hero-placeholder flex h-full w-full items-center justify-center bg-neutral-950 text-white" aria-label={label}>
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

function HomeHeroImage({ slide, index, failed, onError }: { slide: HomeHeroSlide; index: number; failed: boolean; onError: () => void }) {
  if (!slide.imageUrl || failed) {
    return <HomeHeroPlaceholder label={slide.alt} />;
  }

  return (
    <picture>
      {slide.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={slide.mobileImageUrl} /> : null}
      <img
        src={slide.imageUrl}
        alt={slide.alt}
        loading={index === 0 ? "eager" : "lazy"}
        fetchPriority={index === 0 ? "high" : "auto"}
        className="h-full w-full object-cover"
        onError={onError}
      />
    </picture>
  );
}

export function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const activeSlides = useMemo(() => getActiveHomeHeroSlides(slides), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Set<string>>(() => new Set());
  const touchStartXRef = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const controlsEnabled = shouldRenderHomeHeroControls(activeSlides.length);
  const normalizedActiveIndex = normalizeHomeHeroSlideIndex(activeIndex, activeSlides.length);
  const activeSlide = activeSlides[normalizedActiveIndex];

  const goToPrevious = useCallback(() => {
    setActiveIndex((current) => getPreviousHomeHeroSlideIndex(current, activeSlides.length));
  }, [activeSlides.length]);

  const goToNext = useCallback(() => {
    setActiveIndex((current) => getNextHomeHeroSlideIndex(current, activeSlides.length));
  }, [activeSlides.length]);

  const goToSlide = useCallback(
    (targetIndex: number) => {
      setActiveIndex(selectHomeHeroSlideIndex(targetIndex, activeSlides.length));
    },
    [activeSlides.length],
  );

  useEffect(() => {
    if (!controlsEnabled || paused || reducedMotion) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => getNextHomeHeroSlideIndex(current, activeSlides.length));
    }, autoplayMs);

    return () => window.clearInterval(interval);
  }, [activeSlides.length, controlsEnabled, paused, reducedMotion]);

  if (!activeSlides.length) {
    return (
      <section className="store-home-hero relative overflow-hidden rounded-lg bg-black text-white" aria-label="Destaque RARE">
        <HomeHeroPlaceholder label="Destaque RARE indisponivel" />
      </section>
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (!controlsEnabled || event.pointerType === "mouse") return;
    touchStartXRef.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!controlsEnabled || touchStartXRef.current === null) return;

    const deltaX = event.clientX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(deltaX) < swipeThresholdPx) return;
    if (deltaX < 0) {
      goToNext();
    } else {
      goToPrevious();
    }
  }

  function handlePointerCancel() {
    touchStartXRef.current = null;
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
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={(event) => {
        if (!controlsEnabled) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goToPrevious();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          goToNext();
        }
      }}
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

          <div className="absolute bottom-5 left-5 z-30 flex items-center gap-2 sm:left-8 md:left-10 xl:left-12">
            {activeSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`h-2.5 rounded-full transition-[background-color,width] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                  index === normalizedActiveIndex ? "w-8 bg-white" : "w-2.5 bg-white/35 hover:bg-white/65"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
                aria-current={index === normalizedActiveIndex ? "true" : undefined}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
