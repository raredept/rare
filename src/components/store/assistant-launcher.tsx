"use client";

import { MessageCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { getConsentSnapshot, subscribeToConsent } from "@/lib/cookie-consent-client";
import type { PublicAssistantBootstrap } from "@/lib/assistant/store";

// RARE Assistant launcher. Tiny on purpose: the conversation panel is a separate chunk loaded only
// when the shopper opens it. Nothing here touches cookies, storage or analytics.

const AssistantPanel = dynamic(() => import("@/components/store/assistant-panel").then((module) => module.AssistantPanel), {
  ssr: false,
  loading: () => null,
});

/** Payment and order-confirmation pages keep the screen for the purchase itself. */
const HIDDEN_PREFIXES = ["/finalizar-compra", "/pedido/"];

export function isAssistantHiddenOnPath(pathname: string | null) {
  if (!pathname) return false;
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

/** Height of the cookie banner while it is on screen, so the assistant sits above it. */
function useCookieBannerOffset() {
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => "server");
  const bannerVisible = consent === "";
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!bannerVisible) return;
    let resize: ResizeObserver | null = null;
    let frame = 0;
    const watch = (banner: HTMLElement) => {
      const update = () => setOffset(Math.ceil(banner.getBoundingClientRect().height));
      // ResizeObserver reports the current size as soon as it starts observing, then every change.
      if (typeof ResizeObserver === "undefined") {
        frame = window.requestAnimationFrame(update);
        return;
      }
      resize = new ResizeObserver(update);
      resize.observe(banner);
    };
    const find = () => document.querySelector<HTMLElement>("[data-cookie-banner]");
    const banner = find();
    // The banner may mount a render after this effect (both follow the same consent store).
    const mutations = banner
      ? null
      : new MutationObserver(() => {
          const found = find();
          if (!found) return;
          mutations?.disconnect();
          watch(found);
        });
    if (banner) watch(banner);
    else mutations?.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations?.disconnect();
      resize?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [bannerVisible]);

  return bannerVisible ? offset : 0;
}

export function AssistantLauncher({ bootstrap }: { bootstrap: PublicAssistantBootstrap }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const offset = useCookieBannerOffset();

  const close = useCallback(() => {
    setOpen(false);
    // Back to where the shopper was: the button that opened the panel.
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  if (isAssistantHiddenOnPath(pathname)) return null;

  return (
    <div data-assistant-root style={{ ["--assistant-offset" as string]: `${offset}px` }}>
      {requested ? <AssistantPanel id={panelId} open={open} bootstrap={bootstrap} onClose={close} /> : null}
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
          className="assistant-launcher fixed z-30 inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-black px-3.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:px-4"
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
          <span aria-hidden="true" className="hidden text-xs font-black uppercase tracking-[0.16em] sm:inline">
            Dúvidas
          </span>
        </button>
      ) : null}
    </div>
  );
}
