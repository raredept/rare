import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkStagingAccess } from "./staging-access";

const password = "staging-access-test-secret-with-at-least-32-characters";
function request(path: string, method = "GET", auth?: string) {
  return new NextRequest(`https://staging.example.com${path}`, { method, headers: auth ? { authorization: auth } : {} });
}
afterEach(() => vi.unstubAllEnvs());
describe("isolated staging perimeter", () => {
  it("leaves production authentication unchanged", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(checkStagingAccess(request("/admin"))).toBeNull();
  });
  it("fails closed when staging credentials are missing", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
    expect(checkStagingAccess(request("/"))?.status).toBe(503);
  });
  it("requires credentials for storefront, Admin, mutations and assets", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_ACCESS_USERNAME", "qa");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", password);
    for (const path of ["/", "/admin", "/cadastro", "/api/checkout", "/api/admin/uploads", "/_next/static/test.js"]) {
      const response = checkStagingAccess(request(path));
      expect(response?.status).toBe(401);
      expect(response?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    const auth = `Basic ${Buffer.from(`qa:${password}`).toString("base64")}`;
    expect(checkStagingAccess(request("/admin", "GET", auth))).toBeNull();
    expect(checkStagingAccess(request("/api/checkout", "POST", auth))).toBeNull();
    expect(checkStagingAccess(request("/", "GET", "Basic invalid"))?.status).toBe(401);
  });
  it("keeps only signed-webhook POST and read-only health/robots public", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "");
    expect(checkStagingAccess(request("/api/stripe/webhook", "POST"))).toBeNull();
    expect(checkStagingAccess(request("/api/stripe/webhook", "GET"))?.status).toBe(503);
    expect(checkStagingAccess(request("/api/health"))).toBeNull();
    expect(checkStagingAccess(request("/api/health", "POST"))?.status).toBe(503);
    expect(checkStagingAccess(request("/robots.txt"))).toBeNull();
  });
});
