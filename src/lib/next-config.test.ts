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
