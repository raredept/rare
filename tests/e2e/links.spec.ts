import { expect, test } from "@playwright/test";
import { blockExternalRequests, productPath } from "./storefront-fixtures";

const seedPaths = ["/", "/categoria/tudo", productPath, "/finalizar-compra", "/contato", "/sobre"];

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("links internos não estão vazios, locais em produção ou quebrados", async ({ page, request, baseURL }) => {
  const paths = new Set<string>();

  for (const seedPath of seedPaths) {
    await page.goto(seedPath, { waitUntil: "domcontentloaded" });
    const hrefs = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));

    for (const href of hrefs) {
      expect(href, `href inválido em ${seedPath}`).toBeTruthy();
      expect(href).not.toBe("#");
      expect(href).not.toMatch(/(?:localhost|127\.0\.0\.1|railway\.app|up\.railway)/i);
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("http")) continue;
      const url = new URL(href, baseURL);
      paths.add(`${url.pathname}${url.search}`);
    }
  }

  for (const path of paths) {
    const response = await request.get(path, { maxRedirects: 5 });
    expect(response.status(), `${path} retornou ${response.status()}`).toBeLessThan(400);
  }
});
