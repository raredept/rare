import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/client-ip";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("getClientIp", () => {
  it("prefers the edge-controlled Cloudflare header", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP", () => {
    expect(getClientIp(headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.9");
  });

  it("ignores a client-supplied left-most X-Forwarded-For entry", () => {
    // The spoofed value is prepended by the caller; the proxy appends the real peer.
    expect(getClientIp(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.20" }))).toBe("203.0.113.20");
  });

  it("does not let a caller rotate the identity by changing the spoofed prefix", () => {
    const first = getClientIp(headers({ "x-forwarded-for": "9.9.9.1, 203.0.113.20" }));
    const second = getClientIp(headers({ "x-forwarded-for": "9.9.9.2, 203.0.113.20" }));
    expect(first).toBe(second);
  });

  it("rejects malformed values and defaults to a shared bucket", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "garbage" }))).toBe("local");
    expect(getClientIp(headers({}))).toBe("local");
  });

  it("accepts IPv6 addresses", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "2606:4700:3031::ac43:bbae" }))).toBe("2606:4700:3031::ac43:bbae");
  });
});
