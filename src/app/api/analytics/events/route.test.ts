import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_COOKIE, COOKIE_CONSENT_VERSION } from "@/lib/cookie-consent";

const mocks = vi.hoisted(() => ({
  record: vi.fn(async () => ({ stored: 1, dropped: 0 })),
  purge: vi.fn(async () => 0),
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 10, resetAt: 0, driver: "memory", shared: false })),
}));

vi.mock("@/lib/site-analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-analytics")>()),
  recordClientAnalyticsEvents: mocks.record,
  purgeExpiredSiteAnalyticsEvents: mocks.purge,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "@/app/api/analytics/events/route";

const browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const consent = (analytics: boolean) => `${COOKIE_CONSENT_COOKIE}=v${COOKIE_CONSENT_VERSION}.a${analytics ? 1 : 0}.${Math.floor(Date.now() / 1000)}`;
const body = { v: "8f14e45f-ceea-4e7a-9b1c-3d2a1f0e9c11", s: "c9f0f895-fb98-4b91-8c4e-2a7d6e5b4a33", events: [{ type: "page_view", path: "/" }] };

function request({ cookie = consent(true), origin = "https://raredept.com.br", userAgent = browser, payload = JSON.stringify(body) }: { cookie?: string | null; origin?: string | null; userAgent?: string | null; payload?: string } = {}) {
  const headers = new Headers({ host: "raredept.com.br", "content-type": "application/json", "x-forwarded-for": "203.0.113.9" });
  if (cookie) headers.set("cookie", cookie);
  if (origin) headers.set("origin", origin);
  if (userAgent) headers.set("user-agent", userAgent);
  return new NextRequest("https://raredept.com.br/api/analytics/events", { method: "POST", headers, body: payload });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/analytics/events", () => {
  it("stores nothing without analytics consent (server-side enforcement)", async () => {
    for (const cookie of [null, consent(false), `${COOKIE_CONSENT_COOKIE}=garbage`]) {
      const response = await POST(request({ cookie }));
      expect(response.status).toBe(204);
    }
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("refuses other origins", async () => {
    expect((await POST(request({ origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request({ origin: null }))).status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("ignores automated clients", async () => {
    for (const userAgent of [null, "Googlebot/2.1", "curl/8.0", "HeadlessChrome/120"]) {
      expect((await POST(request({ userAgent }))).status).toBe(204);
    }
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("stores a consented batch with a coarse device class only (no IP, no user agent)", async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(mocks.record).toHaveBeenCalledTimes(1);
    const [batch, device] = mocks.record.mock.calls[0] as unknown as [unknown, string];
    expect(device).toBe("mobile");
    expect(JSON.stringify(batch)).not.toMatch(/203\.0\.113\.9|Mozilla|iPhone/);
  });

  it("rate limits per address", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, resetAt: 0, driver: "memory", shared: false });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects oversized and malformed bodies", async () => {
    expect((await POST(request({ payload: JSON.stringify({ ...body, pad: "x".repeat(9_000) }) }))).status).toBe(413);
    expect((await POST(request({ payload: "{not json" }))).status).toBe(400);
    expect((await POST(request({ payload: JSON.stringify({ ...body, v: "not-a-uuid" }) }))).status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("never fails the request when storage fails", async () => {
    mocks.record.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await POST(request())).status).toBe(204);
    expect(spy).toHaveBeenCalledWith("[site-analytics] store failed", "Error");
    spy.mockRestore();
  });
});
