import { createHmac } from "node:crypto";
import { getOptionalAdminSessionSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { ClientAnalyticsBatch } from "@/lib/site-analytics-events";

// Server side of the storefront analytics: pseudonymisation, product validation, storage and
// retention. Nothing here reads or stores an IP address, a user agent, a customer or an order.

/** Events older than this are deleted (about 13 months: one year plus a comparison month). */
export const SITE_ANALYTICS_RETENTION_DAYS = 400;
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type AnalyticsDevice = "mobile" | "tablet" | "desktop";

const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|node-fetch|axios|scrapy|facebookexternalhit|whatsapp/i;

/** Automated clients are not visitors. An empty user agent is treated as automated. */
export function isAutomatedUserAgent(userAgent: string | null | undefined) {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/** A coarse device class. The user agent itself is never stored. */
export function classifyDevice(userAgent: string | null | undefined): AnalyticsDevice {
  const value = userAgent ?? "";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(value)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(value)) return "mobile";
  return "desktop";
}

function getHashKey() {
  // Derived from the session secret with its own label: the stored hashes cannot be recomputed from
  // a browser id without the server secret, and are useless for any other purpose of that secret.
  const secret = getOptionalAdminSessionSecret();
  return secret ? createHmac("sha256", secret).update("rare:site-analytics:v1").digest() : null;
}

/** Keyed hash of a random browser id. The raw id never reaches the database. */
export function pseudonymizeAnalyticsId(kind: "visitor" | "session", id: string, key = getHashKey()) {
  if (!key) return null;
  return createHmac("sha256", key).update(`${kind}:${id}`).digest("hex").slice(0, 32);
}

export type RecordResult = { stored: number; dropped: number };

/**
 * Stores a parsed batch. Product events are kept only for products that exist; the batch is
 * dropped whole when the identifiers cannot be pseudonymised (no server secret).
 */
export async function recordClientAnalyticsEvents(batch: ClientAnalyticsBatch, device: AnalyticsDevice): Promise<RecordResult> {
  const key = getHashKey();
  const visitorHash = pseudonymizeAnalyticsId("visitor", batch.visitorId, key);
  const sessionHash = pseudonymizeAnalyticsId("session", batch.sessionId, key);
  if (!visitorHash || !sessionHash || !batch.events.length) return { stored: 0, dropped: batch.events.length };

  const productIds = [...new Set(batch.events.flatMap((event) => (event.productId ? [event.productId] : [])))];
  const known = productIds.length
    ? new Set((await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((product) => product.id))
    : new Set<string>();
  const rows = batch.events
    .filter((event) => !event.productId || known.has(event.productId))
    .map((event) => ({ type: event.type, visitorHash, sessionHash, path: event.path, productId: event.productId, device }));

  if (rows.length) await prisma.siteAnalyticsEvent.createMany({ data: rows });
  return { stored: rows.length, dropped: batch.events.length - rows.length };
}

let lastPurgeAt = 0;

/** Retention, run at most once per interval per instance and never in the request's critical path. */
export async function purgeExpiredSiteAnalyticsEvents(now = Date.now(), force = false) {
  if (!force && now - lastPurgeAt < PURGE_INTERVAL_MS) return 0;
  lastPurgeAt = now;
  const cutoff = new Date(now - SITE_ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.siteAnalyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
