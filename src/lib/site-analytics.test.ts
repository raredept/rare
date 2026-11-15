import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(async () => ({ count: 0 })),
  deleteMany: vi.fn(async () => ({ count: 3 })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: mocks.findMany },
    siteAnalyticsEvent: { createMany: mocks.createMany, deleteMany: mocks.deleteMany },
  },
}));

import {
  classifyDevice,
  isAutomatedUserAgent,
  pseudonymizeAnalyticsId,
  purgeExpiredSiteAnalyticsEvents,
  recordClientAnalyticsEvents,
  SITE_ANALYTICS_RETENTION_DAYS,
} from "@/lib/site-analytics";

const visitorId = "8f14e45f-ceea-4e7a-9b1c-3d2a1f0e9c11";
const sessionId = "c9f0f895-fb98-4b91-8c4e-2a7d6e5b4a33";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SESSION_SECRET", "x".repeat(48));
});

describe("site analytics storage", () => {
  it("stores keyed hashes, never the raw browser ids", () => {
    const hash = pseudonymizeAnalyticsId("visitor", visitorId);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain(visitorId.replace(/-/g, "").slice(0, 8));
    // Not a plain hash of the id: it cannot be recomputed without the server secret.
    expect(hash).not.toBe(createHash("sha256").update(`visitor:${visitorId}`).digest("hex").slice(0, 32));
    expect(pseudonymizeAnalyticsId("session", visitorId)).not.toBe(hash);
    expect(pseudonymizeAnalyticsId("visitor", visitorId, null)).toBeNull();
  });

  it("classifies the device coarsely and recognises automated clients", () => {
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBe("desktop");
    expect(isAutomatedUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isAutomatedUserAgent("")).toBe(true);
    expect(isAutomatedUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/130")).toBe(false);
  });

  it("keeps product events only for products that exist and writes no personal field", async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: "cmknownproduct000001" }]);
    const result = await recordClientAnalyticsEvents({
      visitorId,
      sessionId,
      events: [
        { type: "page_view", path: "/", productId: null },
        { type: "product_view", path: "/produto/a", productId: "cmknownproduct000001" },
        { type: "product_click", path: "/", productId: "cmunknownproduct0001" },
      ],
    }, "desktop");

    expect(result).toEqual({ stored: 2, dropped: 1 });
    const rows = (mocks.createMany.mock.calls[0] as unknown as [{ data: Array<Record<string, unknown>> }])[0].data;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["device", "path", "productId", "sessionHash", "type", "visitorHash"]);
      expect(JSON.stringify(row)).not.toContain(visitorId);
    }
  });

  it("drops the batch when ids cannot be pseudonymised", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "");
    const result = await recordClientAnalyticsEvents({ visitorId, sessionId, events: [{ type: "page_view", path: "/", productId: null }] }, "desktop");
    expect(result).toEqual({ stored: 0, dropped: 1 });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("deletes events past the retention window", async () => {
    const now = Date.UTC(2026, 10, 14);
    expect(await purgeExpiredSiteAnalyticsEvents(now, true)).toBe(3);
    const where = (mocks.deleteMany.mock.calls[0] as unknown as [{ where: { createdAt: { lt: Date } } }])[0].where;
    expect(where.createdAt.lt.getTime()).toBe(now - SITE_ANALYTICS_RETENTION_DAYS * 86_400_000);
  });
});
