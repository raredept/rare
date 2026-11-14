"use client";

import {
  ANALYTICS_SESSION_STORAGE_KEY,
  ANALYTICS_VISITOR_COOKIE,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  parseCookieConsent,
  readCookieValue,
  serializeCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

// Browser side of the consent record: one first-party cookie, read synchronously, so the
// analytics client can decide before sending anything.

export const COOKIE_CONSENT_CHANGE_EVENT = "rare:cookie-consent-change";
export const COOKIE_PREFERENCES_OPEN_EVENT = "rare:cookie-preferences-open";

function cookieAttributes(maxAgeSeconds: number) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function readStoredConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  return parseCookieConsent(readCookieValue(document.cookie, COOKIE_CONSENT_COOKIE));
}

/** Removes every analytics identifier from this browser. Called on refusal and on withdrawal. */
export function clearAnalyticsIdentifiers() {
  if (typeof document === "undefined") return;
  document.cookie = `${ANALYTICS_VISITOR_COOKIE}=${cookieAttributes(0)}`;
  try {
    window.sessionStorage.removeItem(ANALYTICS_SESSION_STORAGE_KEY);
  } catch {
    // Storage blocked: there is nothing to remove.
  }
}

export function storeConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = { version: COOKIE_CONSENT_VERSION, analytics, decidedAt: Math.floor(Date.now() / 1000) };
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${serializeCookieConsent(consent)}${cookieAttributes(COOKIE_CONSENT_MAX_AGE_SECONDS)}`;
  if (!analytics) clearAnalyticsIdentifiers();
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT));
  return consent;
}

export function subscribeToConsent(listener: () => void) {
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
}

/** Snapshot for useSyncExternalStore: a string, so identical records compare equal. */
export function getConsentSnapshot() {
  const consent = readStoredConsent();
  return consent ? serializeCookieConsent(consent) : "";
}

export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_OPEN_EVENT));
}
