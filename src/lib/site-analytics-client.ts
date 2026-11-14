"use client";

import {
  ANALYTICS_SESSION_STORAGE_KEY,
  ANALYTICS_VISITOR_COOKIE,
  ANALYTICS_VISITOR_MAX_AGE_DAYS,
  hasAnalyticsConsent,
  readCookieValue,
} from "@/lib/cookie-consent";
import { readStoredConsent } from "@/lib/cookie-consent-client";
import {
  ANALYTICS_BATCH_LIMIT,
  ANALYTICS_ENDPOINT,
  isAnalyticsClientId,
  normalizeAnalyticsPath,
  type ClientAnalyticsEventType,
} from "@/lib/site-analytics-events";

// Browser side of the site analytics. Without analytics consent this module does nothing: no
// identifier is created, nothing is queued and no request leaves the page. With consent, events are
// queued and sent in small batches that never block navigation (sendBeacon / keepalive).

type QueuedEvent = { type: ClientAnalyticsEventType; path: string; productId?: string };

const FLUSH_DELAY_MS = 1_500;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function consentGranted() {
  return hasAnalyticsConsent(readStoredConsent());
}

function newId() {
  return crypto.randomUUID();
}

function getVisitorId() {
  const existing = readCookieValue(document.cookie, ANALYTICS_VISITOR_COOKIE);
  if (isAnalyticsClientId(existing)) return existing;
  const id = newId();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ANALYTICS_VISITOR_COOKIE}=${id}; Path=/; Max-Age=${ANALYTICS_VISITOR_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax${secure}`;
  return id;
}

let memorySessionId: string | null = null;

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
    if (isAnalyticsClientId(existing)) return existing;
    const id = newId();
    window.sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // Storage blocked: one id for this page load, never persisted.
    memorySessionId ??= newId();
    return memorySessionId;
  }
}

export function discardAnalyticsQueue() {
  queue = [];
  memorySessionId = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

export function flushAnalyticsQueue() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!queue.length) return;
  // Consent may have been withdrawn between the event and the flush.
  if (!consentGranted()) {
    discardAnalyticsQueue();
    return;
  }
  const events = queue.splice(0, ANALYTICS_BATCH_LIMIT);
  const body = JSON.stringify({ v: getVisitorId(), s: getSessionId(), events });
  try {
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([body], { type: "application/json" }));
    if (!sent) {
      void fetch(ANALYTICS_ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
    }
  } catch {
    // Analytics never interferes with the store.
  }
  if (queue.length) flushTimer = setTimeout(flushAnalyticsQueue, FLUSH_DELAY_MS);
}

/** Records a behavioural event, only when the visitor accepted analytics. */
export function trackAnalyticsEvent(type: ClientAnalyticsEventType, detail: { productId?: string; path?: string } = {}) {
  if (typeof window === "undefined" || !consentGranted()) return;
  const path = normalizeAnalyticsPath(detail.path ?? window.location.pathname);
  if (!path) return;
  queue.push({ type, path, ...(detail.productId ? { productId: detail.productId } : {}) });
  if (queue.length >= ANALYTICS_BATCH_LIMIT) {
    flushAnalyticsQueue();
    return;
  }
  flushTimer ??= setTimeout(flushAnalyticsQueue, FLUSH_DELAY_MS);
}
