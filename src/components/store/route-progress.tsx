"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const safetyTimeoutMs = 5000;

function isPlainPrimaryClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function getTrackableAnchor(event: MouseEvent) {
  if (!(event.target instanceof Element)) return null;

  const anchor = event.target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.download) return null;
  if (anchor.closest("form")) return null;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#")) return null;

  const destination = new URL(anchor.href);
  const current = new URL(window.location.href);

  if (destination.origin !== current.origin) return null;
  if (destination.pathname.startsWith("/admin") || destination.pathname.startsWith("/api")) return null;
  if (destination.pathname === current.pathname && destination.search === current.search) return null;

  return anchor;
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const routeKey = `${pathname}?${searchKey}`;
  const [active, setActive] = useState(false);
  const activeAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const routeKeyRef = useRef(routeKey);
  const timeoutRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    setActive(false);
    document.documentElement.removeAttribute("data-route-progress");
    activeAnchorRef.current?.removeAttribute("data-route-pending");
    activeAnchorRef.current = null;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startPending = useCallback((anchor?: HTMLAnchorElement | null) => {
    activeAnchorRef.current?.removeAttribute("data-route-pending");

    if (anchor) {
      anchor.setAttribute("data-route-pending", "true");
      activeAnchorRef.current = anchor;
    }

    document.documentElement.setAttribute("data-route-progress", "active");
    setActive(true);

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(clearPending, safetyTimeoutMs);
  }, [clearPending]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || !isPlainPrimaryClick(event)) return;

      const anchor = getTrackableAnchor(event);
      if (!anchor) return;

      startPending(anchor);
    }

    function onPopState() {
      startPending(null);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [startPending]);

  useEffect(() => {
    if (routeKeyRef.current === routeKey) return;

    routeKeyRef.current = routeKey;
    if (!active) return;

    const routeSettledTimer = window.setTimeout(clearPending, 140);
    return () => window.clearTimeout(routeSettledTimer);
  }, [active, routeKey, clearPending]);

  useEffect(() => clearPending, [clearPending]);

  return (
    <div className={`store-route-progress ${active ? "is-active" : ""}`} aria-hidden="true">
      <span />
    </div>
  );
}
