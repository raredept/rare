"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import type { PublicAssistantBootstrap } from "@/lib/assistant/store";

// RARE Assistant launcher. Tiny on purpose: the conversation panel is a separate chunk loaded only
// when the shopper opens it. Nothing here touches cookies, storage or analytics.

// Separate chunk, requested on hover/focus (prefetch) or on the first open; never rendered on the server.
const AssistantPanel = lazy(() => import("@/components/store/assistant-panel").then((module) => ({ default: module.AssistantPanel })));

/**
 * Shown only while the panel chunk loads after a tap (no hover on phones): the shopper never sees
 * nothing. Same frame as the panel (black header, quiet body, composer) so the swap is seamless.
 */
function PanelLoading({ title }: { title: string }) {
  return (
    <div role="status" data-state="open" className="assistant-panel fixed z-[60] flex flex-col overflow-hidden bg-white text-neutral-950">
      <div className="shrink-0 bg-black px-5 pb-4 pt-[3.875rem] text-[11px] font-black uppercase leading-4 tracking-[0.22em] text-white">{title}</div>
      <div aria-hidden="true" className="flex flex-1 flex-col gap-3 px-5 pt-6">
        <span className="assistant-skeleton h-7 w-24" />
        <span className="assistant-skeleton h-4 w-4/5" />
        <span className="assistant-skeleton mt-5 h-12 w-full" />
        <span className="assistant-skeleton h-12 w-full" />
      </div>
      <span className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="shrink-0 border-t border-neutral-200 p-3">
        <span className="assistant-skeleton block h-[3.25rem] w-full rounded-full" />
      </div>
    </div>
  );
}

/** Payment and order-confirmation pages keep the screen for the purchase itself. */
const HIDDEN_PREFIXES = ["/finalizar-compra", "/pedido/"];

export function isAssistantHiddenOnPath(pathname: string | null) {
  if (!pathname) return false;
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

/**
 * Fixed bars that own the bottom of the screen: the cookie banner and the phone buy bar of the
 * product page (both portaled/rendered elsewhere). The assistant always sits above them, so it never
 * covers "Aceitar"/"Recusar" or "Adicionar".
 */
export const ASSISTANT_BOTTOM_OBSTACLES = ["[data-cookie-banner]", '[data-testid="pdp-buy-bar"]'] as const;

/** How far the assistant must rise: the height of the tallest visible bottom bar. */
function useBottomObstacleOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let frame = 0;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    const observed = new Set<Element>();
    function measure() {
      frame = 0;
      let next = 0;
      for (const element of document.querySelectorAll<HTMLElement>(ASSISTANT_BOTTOM_OBSTACLES.join(","))) {
        if (resize && !observed.has(element)) {
          observed.add(element);
          resize.observe(element);
        }
        // Both bars are fixed to the bottom edge: their layout height is the space they take. offsetHeight
        // ignores transforms, so a bar sliding in is measured at its final size, not mid-animation.
        if (element.getClientRects().length === 0 || getComputedStyle(element).visibility === "hidden") continue;
        next = Math.max(next, Math.ceil(element.offsetHeight));
      }
      setOffset((current) => (current === next ? current : Math.max(0, next)));
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(measure);
    }
    // Bars mount, unmount and resize with consent, scrolling and viewport changes.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", schedule);
    document.addEventListener("transitionend", schedule, true);
    document.addEventListener("animationend", schedule, true);
    schedule();
    return () => {
      mutations.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("transitionend", schedule, true);
      document.removeEventListener("animationend", schedule, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return offset;
}

export function AssistantLauncher({ bootstrap }: { bootstrap: PublicAssistantBootstrap }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const offset = useBottomObstacleOffset();

  const close = useCallback(() => {
    setOpen(false);
    // Back to where the shopper was: the button that opened the panel.
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  if (isAssistantHiddenOnPath(pathname)) return null;

  return (
    <div data-assistant-root style={{ ["--assistant-offset" as string]: `${offset}px` }}>
      {requested ? (
        <Suspense fallback={open ? <PanelLoading title={bootstrap.displayName} /> : null}>
          <AssistantPanel id={panelId} open={open} bootstrap={bootstrap} onClose={close} />
        </Suspense>
      ) : null}
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          data-assistant-launcher
          aria-label={`Abrir ${bootstrap.displayName}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={requested ? panelId : undefined}
          onClick={() => {
            setRequested(true);
            setOpen(true);
          }}
          onPointerEnter={() => setRequested(true)}
          onFocus={() => setRequested(true)}
          className="assistant-launcher group fixed z-30 inline-flex min-h-12 min-w-12 items-center justify-center gap-2.5 rounded-full px-3.5 sm:pl-4 sm:pr-5"
        >
          <span aria-hidden="true" className="assistant-launcher-icon relative inline-flex">
            <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className="assistant-launcher-dot" />
          </span>
          <span aria-hidden="true" className="assistant-launcher-label hidden text-[11px] font-black uppercase leading-none sm:inline">
            Dúvidas?
          </span>
        </button>
      ) : null}
    </div>
  );
}
