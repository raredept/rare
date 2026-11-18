import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("storefront manifest", () => {
  it("opens the RARE storefront with valid local icons", () => {
    const result = manifest();
    expect(result).toMatchObject({
      name: "RARE Dept",
      short_name: "RARE",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
  });

  it("keeps a stable app identity that also covers the Admin for iOS Web Push", () => {
    const result = manifest();
    // id equals the previous implicit identity (start_url), so existing installs are not orphaned.
    expect(result.id).toBe("/");
    expect(result.start_url).toBe("/");
    // The Admin (/admin/*) must stay inside the installed app's scope for iOS Web Push.
    expect("/admin/notifications".startsWith(result.scope ?? "")).toBe(true);
    expect(result.display).toBe("standalone");
    expect(result.theme_color).toBe("#050505");
    expect(result.background_color).toBe("#050505");
    expect(result.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/brand/rare-icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/brand/rare-icon-512.png", sizes: "512x512" }),
    ]));
  });
});
