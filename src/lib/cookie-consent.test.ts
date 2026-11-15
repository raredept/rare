import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_SESSION_STORAGE_KEY,
  ANALYTICS_VISITOR_COOKIE,
  COOKIE_CATALOG,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  hasAnalyticsConsent,
  parseCookieConsent,
  readCookieConsent,
  serializeCookieConsent,
} from "@/lib/cookie-consent";

const now = 1_800_000_000;

describe("cookie consent record", () => {
  it("round-trips a decision without any personal data", () => {
    const raw = serializeCookieConsent({ version: COOKIE_CONSENT_VERSION, analytics: true, decidedAt: now });
    expect(raw).toBe(`v${COOKIE_CONSENT_VERSION}.a1.${now}`);
    expect(parseCookieConsent(raw, now)).toEqual({ version: COOKIE_CONSENT_VERSION, analytics: true, decidedAt: now });
    expect(parseCookieConsent(`v${COOKIE_CONSENT_VERSION}.a0.${now}`, now)?.analytics).toBe(false);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["malformed", "yes"],
    ["injected", `v${COOKIE_CONSENT_VERSION}.a1.${now};email=x@y.z`],
    ["another policy version", `v${COOKIE_CONSENT_VERSION + 1}.a1.${now}`],
    ["expired", `v${COOKIE_CONSENT_VERSION}.a1.${now - COOKIE_CONSENT_MAX_AGE_SECONDS - 1}`],
    ["from the future", `v${COOKIE_CONSENT_VERSION}.a1.${now + 3_600}`],
  ])("treats a %s record as no decision (asks again, analytics off)", (_name, raw) => {
    const consent = parseCookieConsent(raw, now);
    expect(consent).toBeNull();
    expect(hasAnalyticsConsent(consent)).toBe(false);
  });

  it("reads the record from a Cookie header among other cookies", () => {
    const header = `rare_customer_session=abc; ${COOKIE_CONSENT_COOKIE}=v${COOKIE_CONSENT_VERSION}.a1.${now}; other=1`;
    expect(hasAnalyticsConsent(readCookieConsent(header, now))).toBe(true);
    expect(hasAnalyticsConsent(readCookieConsent("other=1", now))).toBe(false);
    expect(hasAnalyticsConsent(readCookieConsent(null, now))).toBe(false);
  });
});

describe("cookie catalog matches what the app really stores", () => {
  const root = path.join(process.cwd(), "src");
  const listed = new Set(COOKIE_CATALOG.flatMap((category) => category.entries.map((entry) => entry.name)));

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }
  const files = sourceFiles(root).map((file) => ({ file: path.relative(root, file).replace(/\\/g, "/"), source: readFileSync(file, "utf8") }));

  // rare_* / rare:* literals that are not browser storage (event names, server-side labels).
  const notStorage = new Set(["rare:cookie-consent-change", "rare:cookie-preferences-open", "rare:home-motion-change", "rare:rate-limit", "rare:site-analytics:v1"]);

  it("lists every rare_* / rare:* storage name used in the code", () => {
    const names = new Set(files.flatMap(({ source }) => [...source.matchAll(/["'`](rare[_:][A-Za-z0-9_:.-]+)["'`]/g)].map((match) => match[1])));
    const unlisted = [...names].filter((name) => !listed.has(name) && !notStorage.has(name));
    expect(unlisted, "add the new cookie/storage key to COOKIE_CATALOG (or to notStorage if it is not browser storage)").toEqual([]);
  });

  it("only known modules write browser storage or cookies", () => {
    const writers = files
      .filter(({ source }) => /document\.cookie\s*=|localStorage\.setItem|sessionStorage\.setItem|cookieStore\.set\(|\.cookies\.set\(/.test(source))
      .map(({ file }) => file)
      .sort();
    expect(writers).toEqual([
      "components/store/cart-context.tsx",
      "components/store/cart-page-client.tsx",
      "components/store/home-motion.tsx",
      "lib/auth.ts",
      "lib/cookie-consent-client.ts",
      "lib/customer-auth.ts",
      "lib/site-analytics-client.ts",
    ]);
  });

  it("keeps the analytics identifiers in the optional category only", () => {
    const analytics = COOKIE_CATALOG.find((category) => category.id === "ANALYTICS")!;
    expect(analytics.required).toBe(false);
    expect(analytics.entries.map((entry) => entry.name).sort()).toEqual([ANALYTICS_SESSION_STORAGE_KEY, ANALYTICS_VISITOR_COOKIE].sort());
    const essential = COOKIE_CATALOG.find((category) => category.id === "ESSENTIAL")!;
    expect(essential.required).toBe(true);
    expect(essential.entries.some((entry) => entry.name === ANALYTICS_VISITOR_COOKIE)).toBe(false);
  });

  it("uses no third-party storage", () => {
    expect(COOKIE_CATALOG.flatMap((category) => category.entries).every((entry) => entry.party !== "Terceiro")).toBe(true);
  });
});
