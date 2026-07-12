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
    expect(result.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/brand/rare-icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/brand/rare-icon-512.png", sizes: "512x512" }),
    ]));
  });
});
