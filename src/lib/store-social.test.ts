import { describe, expect, it } from "vitest";
import { DEFAULT_INSTAGRAM_URL, getInstagramUrl, normalizeInstagramUrl } from "@/lib/store-social";
import { buildOrganizationJsonLd } from "@/lib/structured-data";

describe("effective store Instagram", () => {
  it("uses the owner's exact profile as fallback and preserves a valid Admin override", () => {
    expect(getInstagramUrl()).toBe("https://www.instagram.com/rare.deptt/");
    expect(getInstagramUrl(" https://instagram.com/qa.rare/ ")).toBe("https://www.instagram.com/qa.rare/");
    expect(buildOrganizationJsonLd("https://raredept.com.br", "https://www.instagram.com/qa.rare/").sameAs).toEqual(["https://www.instagram.com/qa.rare/"]);
  });
  it.each(["javascript:alert(1)", "https://instagram.com.evil.example/rare/", "http://instagram.com/rare/", "https://user@instagram.com/rare/", "https://instagram.com/rare/?redirect=evil", "https://instagram.com/p/example"])("does not publish an invalid profile URL: %s", (url) => {
    expect(normalizeInstagramUrl(url)).toBeNull();
    expect(getInstagramUrl(url)).toBe(DEFAULT_INSTAGRAM_URL);
  });
});
