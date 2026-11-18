import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Executes the real public/admin-push-sw.js against a minimal ServiceWorkerGlobalScope.
const ORIGIN = "https://raredept.com.br";
const source = readFileSync(path.join(process.cwd(), "public/admin-push-sw.js"), "utf8");

type Listener = (event: unknown) => void;

function loadServiceWorker(windowClients: Array<{ url: string; focus: () => Promise<unknown> }> = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue(windowClients);
  const self = {
    location: new URL(`${ORIGIN}/admin-push-sw.js`),
    registration: { showNotification },
    clients: { matchAll, openWindow, claim: vi.fn().mockResolvedValue(undefined) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  new Function("self", source)(self);

  async function dispatch(type: string, event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)!({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
    return pending.length;
  }

  async function push(data: unknown) {
    const eventData = data === undefined
      ? null
      : {
          json: () => {
            if (typeof data === "string") return JSON.parse(data);
            return data;
          },
        };
    const waited = await dispatch("push", { data: eventData });
    return { waited, call: showNotification.mock.calls[0] as [string, { body: string; icon: string; badge: string; tag: string; data: { url: string } }] };
  }

  async function click(url: unknown) {
    const close = vi.fn();
    await dispatch("notificationclick", { notification: { close, data: { url } } });
    return { close };
  }

  return { listeners, showNotification, openWindow, matchAll, self, push, click };
}

describe("admin push service worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a visible notification for a sale push, inside waitUntil", async () => {
    const sw = loadServiceWorker();
    const { waited, call } = await sw.push({
      title: "Venda aprovada",
      body: "Pedido RARE-1 confirmado: R$ 199,90.",
      icon: "/brand/rare-logo.png",
      badge: "/brand/favicon.ico",
      url: "/admin/orders/order_1",
      tag: "order_paid:order_1",
    });

    expect(waited).toBe(1);
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    expect(call[0]).toBe("Venda aprovada");
    expect(call[1]).toMatchObject({
      body: "Pedido RARE-1 confirmado: R$ 199,90.",
      icon: "/brand/rare-logo.png",
      tag: "order_paid:order_1",
      data: { url: `${ORIGIN}/admin/orders/order_1` },
    });
  });

  it.each([
    ["no payload", undefined],
    ["invalid JSON", "{not json"],
    ["a non-object payload", "42"],
    ["empty strings", { title: "   ", body: "" }],
    ["wrong types", { title: 42, body: { x: 1 }, tag: [] }],
  ])("still shows a fallback notification for %s (Safari forbids silent pushes)", async (_label, data) => {
    const sw = loadServiceWorker();
    const { call } = await sw.push(data);

    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    expect(call[0]).toBe("RARE Admin");
    expect(call[1].body).toBe("Nova notificação administrativa.");
    expect(call[1].tag).toBe("rare-admin-notification");
    expect(call[1].data.url).toBe(`${ORIGIN}/admin/notifications`);
  });

  it.each([
    "https://attacker.example/admin/orders/1",
    "//attacker.example/admin/orders/1",
    "javascript:alert(1)",
    "/minha-conta",
    "/",
    "/administrator",
    "/admin/../checkout",
    "http://[",
  ])("replaces an unsafe target URL with the Admin notifications page: %s", async (url) => {
    const sw = loadServiceWorker();
    const { call } = await sw.push({ title: "x", url });
    expect(call[1].data.url).toBe(`${ORIGIN}/admin/notifications`);
  });

  it("only uses same-origin icon paths", async () => {
    const sw = loadServiceWorker();
    const { call } = await sw.push({ title: "x", icon: "https://tracker.example/pixel.png", badge: "//cdn.example/b.png" });
    expect(call[1].icon).toBe("/brand/rare-logo.png");
    expect(call[1].badge).toBe("/brand/favicon.ico");
  });

  it("truncates oversized text", async () => {
    const sw = loadServiceWorker();
    const { call } = await sw.push({ title: "T".repeat(500), body: "B".repeat(1000) });
    expect(call[0]).toHaveLength(120);
    expect(call[1].body).toHaveLength(240);
  });

  it("opens the order page on click when no Admin window shows it", async () => {
    const sw = loadServiceWorker();
    const { close } = await sw.click(`${ORIGIN}/admin/orders/order_1`);

    expect(close).toHaveBeenCalled();
    expect(sw.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(sw.openWindow).toHaveBeenCalledWith(`${ORIGIN}/admin/orders/order_1`);
  });

  it("focuses an existing window already on the target page", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const sw = loadServiceWorker([{ url: `${ORIGIN}/admin/orders/order_1`, focus }]);
    await sw.click(`${ORIGIN}/admin/orders/order_1`);

    expect(focus).toHaveBeenCalled();
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it.each([
    "https://attacker.example/admin/orders/1",
    "javascript:alert(1)",
    "/checkout",
    undefined,
    { href: "/admin" },
  ])("re-validates the stored URL on click and falls back for %s", async (url) => {
    const sw = loadServiceWorker();
    await sw.click(url);
    expect(sw.openWindow).toHaveBeenCalledWith(`${ORIGIN}/admin/notifications`);
  });

  it("takes control immediately after an update", async () => {
    const sw = loadServiceWorker();
    sw.listeners.get("install")!({});
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    const pending: Promise<unknown>[] = [];
    sw.listeners.get("activate")!({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("never asks for notification permission and stays a plain script", () => {
    expect(source).not.toMatch(/requestPermission/);
    expect(source).not.toMatch(/\bimport\b|importScripts|fetch\(/);
  });
});
