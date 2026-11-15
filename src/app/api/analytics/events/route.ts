import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { hasAnalyticsConsent, readCookieConsent } from "@/lib/cookie-consent";
import { rateLimit } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-security";
import { classifyDevice, isAutomatedUserAgent, purgeExpiredSiteAnalyticsEvents, recordClientAnalyticsEvents } from "@/lib/site-analytics";
import { ANALYTICS_BODY_LIMIT_BYTES, parseAnalyticsBatch } from "@/lib/site-analytics-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Storefront behavioural events. Accepted only from this site, only with the analytics consent
// cookie, only for allowlisted event types, in small batches, under a per-address rate limit.
// The IP is used for the rate limit key only (hashed by the limiter) and never stored; neither is
// the user agent. Checkout, payment and purchase are not accepted here: they come from the orders.

const PER_MINUTE_LIMIT = 60;

function accepted() {
  // 204 for everything the client cannot fix (no consent, bot, all events dropped): no signal leaks.
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });

  // Consent is enforced here as well as in the browser: a request without it stores nothing.
  if (!hasAnalyticsConsent(readCookieConsent(request.headers.get("cookie")))) return accepted();

  const userAgent = request.headers.get("user-agent");
  if (isAutomatedUserAgent(userAgent)) return accepted();

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > ANALYTICS_BODY_LIMIT_BYTES) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });

  const limit = await rateLimit(`site-analytics:${getClientIp(request.headers)}`, PER_MINUTE_LIMIT, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (text.length > ANALYTICS_BODY_LIMIT_BYTES) return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const batch = parseAnalyticsBatch(body);
  if (!batch) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });

  try {
    await recordClientAnalyticsEvents(batch, classifyDevice(userAgent));
  } catch (error) {
    // Analytics never fails the store: log the kind only (no payload, no identifiers).
    console.error("[site-analytics] store failed", error instanceof Error ? error.name : "unknown");
  }
  void purgeExpiredSiteAnalyticsEvents().catch(() => undefined);
  return accepted();
}
