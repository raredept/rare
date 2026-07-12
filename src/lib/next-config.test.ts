import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next config redirects", () => {
  it("redirects the legacy cart route to checkout as an HTTP redirect", async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: "/cart",
          destination: "/finalizar-compra",
          permanent: false,
        },
      ]),
    );
  });
});

describe("next config security headers", () => {
  it("preserves enforceable security headers without emitting an unactionable report-only CSP", async () => {
    const headersConfig = await nextConfig.headers?.();
    const globalHeaders = headersConfig?.find((entry) => entry.source === "/(.*)")?.headers ?? [];
    const headers = new Map(globalHeaders.map((header) => [header.key.toLowerCase(), header.value]));

    expect(headers.has("content-security-policy-report-only")).toBe(false);
    expect(headers.has("content-security-policy")).toBe(false);
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("strict-transport-security")).toBe("max-age=63072000");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("keeps API no-store headers in addition to the global security policy", async () => {
    const headersConfig = await nextConfig.headers?.();
    const apiHeaders = headersConfig?.find((entry) => entry.source === "/api/:path*")?.headers ?? [];

    expect(apiHeaders).toEqual(expect.arrayContaining([{ key: "Cache-Control", value: "no-store" }]));
  });
});
