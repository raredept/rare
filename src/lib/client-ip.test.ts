import { describe, expect, it } from "vitest";
import { getClientIp, isCloudflareAddress, resolveClientIp } from "@/lib/client-ip";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

const cloudflareEdge = "172.71.10.20";

describe("getClientIp", () => {
  it("uses CF-Connecting-IP only when the TCP peer is a Cloudflare address", () => {
    expect(resolveClientIp(headers({ "x-real-ip": cloudflareEdge, "cf-connecting-ip": "203.0.113.7" }))).toEqual({
      ip: "203.0.113.7",
      source: "cf-connecting-ip",
    });
  });

  it("ignores a forged CF-Connecting-IP sent straight to the origin", () => {
    // Railway routes by Host: an attacker can skip Cloudflare and choose any value.
    const first = getClientIp(headers({ "x-real-ip": "198.51.100.4", "cf-connecting-ip": "9.9.9.1" }));
    const second = getClientIp(headers({ "x-real-ip": "198.51.100.4", "cf-connecting-ip": "9.9.9.2" }));

    expect(first).toBe("198.51.100.4");
    expect(second).toBe("198.51.100.4");
  });

  it("does not trust CF-Connecting-IP when there is no peer information at all", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "203.0.113.7" }))).toBe("local");
  });

  it("uses the edge-set X-Real-IP for direct traffic", () => {
    expect(getClientIp(headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.9");
  });

  it("falls back to the right-most X-Forwarded-For entry, never the client-controlled prefix", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.20" }))).toBe("203.0.113.20");
    const first = getClientIp(headers({ "x-forwarded-for": "9.9.9.1, 203.0.113.20" }));
    const second = getClientIp(headers({ "x-forwarded-for": "9.9.9.2, 203.0.113.20" }));
    expect(first).toBe(second);
  });

  it("rejects malformed values and defaults to a shared bucket", () => {
    expect(getClientIp(headers({ "x-real-ip": "not-an-ip", "x-forwarded-for": "garbage" }))).toBe("local");
    expect(getClientIp(headers({}))).toBe("local");
  });

  it("accepts IPv6 clients behind Cloudflare", () => {
    expect(getClientIp(headers({ "x-real-ip": "2606:4700:3031::ac43:bbae", "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});

describe("isCloudflareAddress", () => {
  it.each(["173.245.48.1", "104.21.76.46", "172.67.187.174", "162.159.0.5", "2606:4700:3031::ac43:bbae"])("recognises %s", (ip) => {
    expect(isCloudflareAddress(ip)).toBe(true);
  });

  it.each(["203.0.113.7", "8.8.8.8", "172.32.0.1", "104.32.0.1", "2001:db8::1", "not-an-ip"])("rejects %s", (ip) => {
    expect(isCloudflareAddress(ip)).toBe(false);
  });
});
