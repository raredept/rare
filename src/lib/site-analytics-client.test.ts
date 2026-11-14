import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_SESSION_STORAGE_KEY, ANALYTICS_VISITOR_COOKIE, COOKIE_CONSENT_COOKIE } from "@/lib/cookie-consent";

// Minimal browser for the client modules: a cookie jar behind document.cookie, sessionStorage,
// events, sendBeacon and fetch. The proof that matters: without consent nothing leaves the page.

function installBrowser() {
  const jar = new Map<string, string>();
  const storage = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const beacon = vi.fn<(url: string, body: Blob) => boolean>(() => true);
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));

  vi.stubGlobal("document", {
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(value: string) {
      const [pair, ...attributes] = value.split(";").map((part) => part.trim());
      const [name, ...rest] = pair.split("=");
      const expired = attributes.some((attribute) => /^max-age=0$/i.test(attribute));
      if (expired) jar.delete(name);
      else jar.set(name, rest.join("="));
    },
  });
  vi.stubGlobal("window", {
    location: { protocol: "https:", pathname: "/categoria/tudo" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(listener)),
    removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener());
      return true;
    },
  });
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  vi.stubGlobal("fetch", fetchMock);
  return { jar, storage, beacon, fetchMock };
}

let browser: ReturnType<typeof installBrowser>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  browser = installBrowser();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function load() {
  const consent = await import("@/lib/cookie-consent-client");
  const client = await import("@/lib/site-analytics-client");
  return { ...consent, ...client };
}

async function sentBodies() {
  return Promise.all(browser.beacon.mock.calls.map(async ([, blob]) => JSON.parse(await (blob as Blob).text())));
}

describe("site analytics client", () => {
  it("does nothing for a new visitor who has not decided: no id, no queue, no request", async () => {
    const { trackAnalyticsEvent, flushAnalyticsQueue } = await load();
    trackAnalyticsEvent("page_view");
    trackAnalyticsEvent("product_click", { productId: "cmproduct0000000001" });
    trackAnalyticsEvent("add_to_cart", { productId: "cmproduct0000000001" });
    vi.runAllTimers();
    flushAnalyticsQueue();
    expect(browser.beacon).not.toHaveBeenCalled();
    expect(browser.fetchMock).not.toHaveBeenCalled();
    expect(browser.jar.has(ANALYTICS_VISITOR_COOKIE)).toBe(false);
    expect(browser.storage.has(ANALYTICS_SESSION_STORAGE_KEY)).toBe(false);
  });

  it("does nothing after a refusal", async () => {
    const { storeConsent, trackAnalyticsEvent } = await load();
    storeConsent(false);
    trackAnalyticsEvent("page_view");
    trackAnalyticsEvent("product_view", { productId: "cmproduct0000000001" });
    vi.runAllTimers();
    expect(browser.beacon).not.toHaveBeenCalled();
    expect(browser.fetchMock).not.toHaveBeenCalled();
    expect(browser.jar.get(COOKIE_CONSENT_COOKIE)).toMatch(/^v\d+\.a0\.\d+$/);
    expect(browser.jar.has(ANALYTICS_VISITOR_COOKIE)).toBe(false);
  });

  it("sends a batched, pseudonymous payload after acceptance", async () => {
    const { storeConsent, trackAnalyticsEvent } = await load();
    storeConsent(true);
    trackAnalyticsEvent("page_view");
    trackAnalyticsEvent("product_view", { productId: "cmproduct0000000001", path: "/produto/camiseta?email=a@b.c" });
    expect(browser.beacon).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(browser.beacon).toHaveBeenCalledTimes(1);
    const [payload] = await sentBodies();
    expect(Object.keys(payload).sort()).toEqual(["events", "s", "v"]);
    expect(payload.v).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.events).toEqual([
      { type: "page_view", path: "/categoria/tudo" },
      { type: "product_view", path: "/produto/camiseta", productId: "cmproduct0000000001" },
    ]);
    expect(browser.jar.get(ANALYTICS_VISITOR_COOKIE)).toBe(payload.v);
  });

  it("withdrawing consent deletes the identifiers and drops anything still queued", async () => {
    const { storeConsent, trackAnalyticsEvent } = await load();
    storeConsent(true);
    trackAnalyticsEvent("page_view");
    vi.runAllTimers();
    expect(browser.jar.has(ANALYTICS_VISITOR_COOKIE)).toBe(true);
    expect(browser.storage.has(ANALYTICS_SESSION_STORAGE_KEY)).toBe(true);

    trackAnalyticsEvent("product_click", { productId: "cmproduct0000000001" });
    storeConsent(false);
    vi.runAllTimers();
    expect(browser.beacon).toHaveBeenCalledTimes(1);
    expect(browser.jar.has(ANALYTICS_VISITOR_COOKIE)).toBe(false);
    expect(browser.storage.has(ANALYTICS_SESSION_STORAGE_KEY)).toBe(false);
  });

  it("keeps the decision across a reload (cookie), and only analytics consent counts", async () => {
    const first = await load();
    first.storeConsent(true);
    vi.resetModules();
    const second = await load();
    expect(second.readStoredConsent()?.analytics).toBe(true);
  });
});
