import { expect, test } from "@playwright/test";
import {
  blockExternalRequests,
  captureUnexpectedBrowserIssues, withoutStagingGateNoise,
  isProductionBaseUrl,
  productPath,
} from "./storefront-fixtures";

const canonicalOrigin = "https://raredept.com.br";
const publicRoutes = [
  "/",
  "/categoria/tudo",
  productPath,
  "/entrar",
  "/cadastro",
  "/contato",
  "/sobre",
  "/trocas-e-devolucoes",
  "/politica-de-envio",
  "/privacidade-e-termos",
] as const;
const privateSitemapPrefixes = ["/admin", "/api", "/finalizar-compra", "/minha-conta", "/pedido", "/pedidos"];

test.beforeEach(async ({ page, baseURL }) => {
  // Production serves its real media from R2 and injects Cloudflare resources.
  // Blocking those hosts makes this remote smoke report failures it created.
  if (!baseURL || !isProductionBaseUrl(baseURL)) {
    await blockExternalRequests(page, baseURL);
  }
});

test("rotas essenciais têm h1, canonical seguro, metadata limpa e nenhum overflow crítico", async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const issues = captureUnexpectedBrowserIssues(page, baseURL);

  for (const route of publicRoutes) {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main"), route).toHaveCount(1);
    await expect(page.locator("h1"), route).toHaveCount(1);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical, route).toMatch(/^https:\/\/raredept\.com\.br(?:\/|$)/);
    const metadataValues = await page
      .locator('link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("href") ?? element.getAttribute("content") ?? "").join("\n"));
    expect(metadataValues, route).not.toMatch(/localhost|127\.0\.0\.1|railway\.app|up\.railway/i);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(1);
  }

  expect(withoutStagingGateNoise(issues)).toEqual([]);
});

test("produto ausente retorna 404 útil sem transformar o estado esperado em erro de console", async ({ page }) => {
  const response = await page.goto("/produto/produto-que-nao-existe", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Produto não encontrado" })).toBeVisible();
});

test("checkout, carrinho, frete automático e oferta comprável permanecem desativados", async ({ page, request }) => {
  // The release assertion is "sales are paused" (production today). A
  // homologation with commerce switched on declares RELEASE_EXPECT_COMMERCE=
  // enabled; its commerce paths are exercised by the checkout homologation.
  test.skip(process.env.RELEASE_EXPECT_COMMERCE === "enabled", "Alvo com comércio ligado declarado (RELEASE_EXPECT_COMMERCE=enabled).");
  await page.goto(productPath, { waitUntil: "domcontentloaded" });
  const pausedAction = page.getByRole("button", { name: /Compras temporariamente pausadas/i });
  await expect(pausedAction).toBeVisible();
  await expect(pausedAction).toBeDisabled();
  await expect(page.locator("main")).not.toContainText(/Pix e cartão|parcelamento/i);

  const productJsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
  const productEntries = productJsonLd
    .map((entry) => JSON.parse(entry) as { "@type"?: string; offers?: unknown })
    .filter((entry) => entry["@type"] === "Product");
  expect(productEntries.length).toBeGreaterThan(0);
  expect(productEntries.every((entry) => entry.offers === undefined)).toBe(true);

  await page.goto("/finalizar-compra", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Compras temporariamente pausadas" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Finalizar compra/i })).toHaveCount(0);

  const shippingResponse = await request.post("/api/shipping/quote", {
    data: {
      cep: "01001000",
      items: [{ productId: "release-smoke", variantId: "release-smoke", quantity: 1, priceInCents: 1 }],
    },
  });
  expect(shippingResponse.status()).toBe(200);
  await expect(shippingResponse.json()).resolves.toMatchObject({ options: [], disabled: true });

  const checkoutResponse = await request.post("/api/checkout", { data: {} });
  expect(checkoutResponse.status()).toBe(503);
  await expect(checkoutResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/temporariamente indisponível/i) });
});

test("manifest, robots, sitemap, ícones, noindex privado, Admin e health respeitam o ambiente", async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL não configurada.");
  for (const path of ["/manifest.webmanifest", "/brand/favicon.ico", "/brand/rare-icon-192.png", "/brand/rare-icon-512.png"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();
  if (isProductionBaseUrl(baseURL)) {
    expect(robots).toContain(`Sitemap: ${canonicalOrigin}/sitemap.xml`);
  } else {
    expect(robots).toMatch(/Disallow:\s*\//i);
  }

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).not.toMatch(/localhost|127\.0\.0\.1|railway\.app|up\.railway/i);
  for (const prefix of privateSitemapPrefixes) {
    expect(sitemap).not.toContain(`<loc>${canonicalOrigin}${prefix}`);
  }

  for (const route of ["/entrar", "/cadastro", "/finalizar-compra"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robotsMeta, route).toMatch(/noindex/i);
  }

  const adminResponse = await request.get("/admin", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308, 401, 403]).toContain(adminResponse.status());

  const healthResponse = await request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  const health = (await healthResponse.json()) as {
    status?: string;
    configuration?: { errors?: unknown[] };
    errors?: unknown[];
  };
  expect(["ok", "ok_with_warnings"]).toContain(health.status);
  expect(health.configuration?.errors ?? health.errors ?? []).toEqual([]);
});
