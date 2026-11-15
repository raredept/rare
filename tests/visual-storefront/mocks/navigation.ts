import { useSyncExternalStore } from "react";

const navigationEvent = "rare-fixture-navigation";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(navigationEvent, callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener(navigationEvent, callback); };
}
function snapshot() { return window.location.pathname + window.location.search; }
export function usePathname() { return useSyncExternalStore(subscribe, snapshot, () => "/").split("?")[0]; }
export function useSearchParams() { return new URLSearchParams(useSyncExternalStore(subscribe, snapshot, () => "/").split("?").slice(1).join("?")); }
export function navigate(href: string, replace = false) {
  const destination = new URL(href, window.location.href);
  if (destination.origin !== window.location.origin || destination.pathname.startsWith("/api") || destination.pathname.startsWith("/admin")) throw new Error("Fixture QA: navigation outside the local storefront refused.");
  window.history[replace ? "replaceState" : "pushState"]({}, "", destination.pathname + destination.search + destination.hash);
  window.dispatchEvent(new Event(navigationEvent));
}
export function useRouter() { return { push: (href: string) => navigate(href), replace: (href: string) => navigate(href, true), refresh: () => window.dispatchEvent(new Event(navigationEvent)), back: () => window.history.back(), forward: () => window.history.forward(), prefetch: () => undefined }; }
export function notFound(): never { throw new Error("RARE_FIXTURE_NOT_FOUND"); }
export function redirect(href: string): never { navigate(href, true); throw new Error("RARE_FIXTURE_REDIRECT"); }
export function permanentRedirect(href: string): never { return redirect(href); }
