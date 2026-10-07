// Installed before application modules render. Browser asset loading is additionally
// constrained by CSP and the Playwright context; API calls have no mock success path.
export function installNetworkGuard() {
  if (window.location.origin !== "http://127.0.0.1:4173") throw new Error("Fixture QA only supports the exact loopback origin.");
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(typeof input === "string" ? new URL(input, window.location.href) : input, init);
    const url = new URL(request.url);
    if (url.origin !== window.location.origin || !["GET", "HEAD"].includes(request.method) || /^\/(?:api|admin)(?:\/|$)/.test(url.pathname)) throw new Error("Fixture QA: unhandled backend/network request refused.");
    return originalFetch(request);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null) {
    const destination = new URL(String(url), window.location.href);
    if (destination.origin !== window.location.origin || !["GET", "HEAD"].includes(method.toUpperCase()) || /^\/(?:api|admin)(?:\/|$)/.test(destination.pathname)) throw new Error("Fixture QA: XHR refused.");
    return originalOpen.call(this, method, String(url), async, username, password);
  };
  navigator.sendBeacon = () => false;
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (new URL(anchor.href).origin !== window.location.origin) event.preventDefault();
  }, true);
  window.__RARE_FIXTURE_QA__ = { backend: "DENIED", catalog: "IN_MEMORY", origin: "LOOPBACK_ONLY" };
}

declare global {
  interface Window { __RARE_FIXTURE_QA__: { backend: string; catalog: string; origin: string }; }
}
