"use client";

import { Pause, Play } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";

const preferenceKey = "rare:home-motion-paused";
const preferenceEvent = "rare:home-motion-change";
let memoryPaused = false;

function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  window.addEventListener(preferenceEvent, callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferenceEvent, callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function snapshot() {
  let paused = memoryPaused;
  try { paused = localStorage.getItem(preferenceKey) === "true"; } catch { /* In-memory control still works with storage blocked. */ }
  return `${paused},${window.matchMedia("(prefers-reduced-motion: reduce)").matches},${!document.hidden}`;
}

function setPaused(paused: boolean) {
  memoryPaused = paused;
  try { localStorage.setItem(preferenceKey, String(paused)); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(preferenceEvent));
}

const HomeMotionContext = createContext({ paused: false, reducedMotion: true, pageVisible: false, setPaused });

export function HomeMotionProvider({ children }: { children: ReactNode }) {
  // The same static server snapshot avoids hydration differences and initial autoplay.
  const state = useSyncExternalStore(subscribe, snapshot, () => "false,true,false");
  const [paused, reducedMotion, pageVisible] = state.split(",").map((value) => value === "true");
  return <HomeMotionContext.Provider value={{ paused, reducedMotion, pageVisible, setPaused }}>{children}</HomeMotionContext.Provider>;
}

export function useHomeMotion() { return useContext(HomeMotionContext); }

export function HomeMotionControl({ className = "" }: { className?: string }) {
  const { paused, reducedMotion, setPaused } = useHomeMotion();
  const label = reducedMotion ? "Movimento reduzido" : paused ? "Retomar animações" : "Pausar animações";
  const Icon = paused ? Play : Pause;
  return (
    <button type="button" data-motion-control aria-label={`${label} da página`} disabled={reducedMotion}
      onClick={() => setPaused(!paused)}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/30 px-3 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-75 ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /><span>{label}</span>
    </button>
  );
}

export function useHomeVisibility() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useCallback((element: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observerRef.current = observer;
    observer.observe(element);
  }, []);
  return { ref, inView };
}

export function useHomeCarousel(count: number, intervalMs = 5000) {
  const motion = useHomeMotion();
  const { ref, inView } = useHomeVisibility();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const mediaPlaying = inView && motion.pageVisible && !motion.paused && !motion.reducedMotion && !hovered && !focused;
  const playing = count > 1 && mediaPlaying;
  const activeIndex = count ? ((index % count) + count) % count : 0;

  function select(next: number) { motion.setPaused(true); setIndex(next); }
  function move(direction: number) { select(activeIndex + direction); }

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), intervalMs);
    return () => window.clearInterval(timer);
  }, [count, intervalMs, playing]);

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    suppressClick.current = true;
    move(dx < 0 ? 1 : -1);
  }

  return {
    ref, activeIndex, playing, mediaPlaying, motion, inView, select, move,
    interactionProps: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === "mouse") setHovered(true); },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === "mouse") setHovered(false); },
      onFocusCapture: (event: React.FocusEvent<HTMLElement>) => setFocused(!(event.target as HTMLElement).closest("[data-motion-control]")),
      onBlurCapture: (event: React.FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        suppressClick.current = false;
        touchStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
      },
      onPointerUp,
      onPointerCancel: () => { touchStart.current = null; },
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (count > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
        }
      },
    },
  };
}
