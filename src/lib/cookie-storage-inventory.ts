// ENGINEERING-ONLY inventory of every cookie and browser-storage key the app writes.
//
// RARE-COOKIE-PUBLIC-HARDENING-01: never import this module from a page, a layout or a client
// component. The public cookie policy and the preferences panel render COOKIE_CATALOG
// (src/lib/cookie-consent.ts), which describes the same storage in plain language without the
// technical names. src/lib/cookie-consent.test.ts enforces both directions:
//   - every rare_* / rare:* storage key in the code is listed here;
//   - every shopper-facing key maps to a public catalog entry, and staff-only keys map to none.
// Human-readable counterpart: docs/security/COOKIE_STORAGE_INTERNAL.md.
//
// Names only. Never put a cookie value, token, secret or recovery code here.

import { ADMIN_MFA_PENDING_COOKIE, ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "@/lib/auth-constants";
import {
  ANALYTICS_SESSION_STORAGE_KEY,
  ANALYTICS_VISITOR_COOKIE,
  ANALYTICS_VISITOR_MAX_AGE_DAYS,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  type ConsentCategory,
  type PublicStorageEntryId,
  type StorageEntry,
} from "@/lib/cookie-consent";

export type InternalStorageItem = {
  /** Technical cookie or storage key. */
  name: string;
  kind: StorageEntry["kind"];
  category: ConsentCategory;
  /** Public catalog entry that describes it; null for store-team (Admin) storage, which is never shown to shoppers. */
  publicEntry: PublicStorageEntryId | null;
  audience: "shopper" | "staff";
  /** Cookie Max-Age in seconds when the code sets one; null for browser storage or session-only cookies. */
  maxAgeSeconds: number | null;
  /** Module that writes it. */
  owner: string;
};

export const INTERNAL_STORAGE_INVENTORY: readonly InternalStorageItem[] = [
  { name: COOKIE_CONSENT_COOKIE, kind: "cookie", category: "ESSENTIAL", publicEntry: "privacy-preferences", audience: "shopper", maxAgeSeconds: COOKIE_CONSENT_MAX_AGE_SECONDS, owner: "src/lib/cookie-consent-client.ts" },
  { name: CUSTOMER_SESSION_COOKIE, kind: "cookie", category: "ESSENTIAL", publicEntry: "account-session", audience: "shopper", maxAgeSeconds: 60 * 60 * 24 * 30, owner: "src/lib/customer-auth.ts" },
  { name: ADMIN_SESSION_COOKIE, kind: "cookie", category: "ESSENTIAL", publicEntry: null, audience: "staff", maxAgeSeconds: 60 * 60 * 8, owner: "src/lib/auth.ts" },
  { name: ADMIN_MFA_PENDING_COOKIE, kind: "cookie", category: "ESSENTIAL", publicEntry: null, audience: "staff", maxAgeSeconds: 10 * 60, owner: "src/lib/auth.ts" },
  { name: "rare_store_cart", kind: "localStorage", category: "ESSENTIAL", publicEntry: "cart", audience: "shopper", maxAgeSeconds: null, owner: "src/components/store/cart-context.tsx" },
  { name: "rare_store_shipping_selection", kind: "localStorage", category: "ESSENTIAL", publicEntry: "shipping", audience: "shopper", maxAgeSeconds: null, owner: "src/components/store/cart-page-client.tsx" },
  { name: "rare:home-motion-paused:v2", kind: "localStorage", category: "ESSENTIAL", publicEntry: "visual-preferences", audience: "shopper", maxAgeSeconds: null, owner: "src/components/store/home-motion.tsx" },
  { name: ANALYTICS_VISITOR_COOKIE, kind: "cookie", category: "ANALYTICS", publicEntry: "browser-id", audience: "shopper", maxAgeSeconds: ANALYTICS_VISITOR_MAX_AGE_DAYS * 24 * 60 * 60, owner: "src/lib/site-analytics-client.ts" },
  { name: ANALYTICS_SESSION_STORAGE_KEY, kind: "sessionStorage", category: "ANALYTICS", publicEntry: "visit-id", audience: "shopper", maxAgeSeconds: null, owner: "src/lib/site-analytics-client.ts" },
];
