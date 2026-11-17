import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { attachDiagnostics, labContextOptions, labEnabled, withDatabase } from "./lab-helpers";

// RARE-UIUX-REFINE-01: AFTER evidence for the storefront P1 (and, below, P2/P3) items that need no login — header nav
// (NAV-001), catalog toolbar/filters/sort (CATALOG-001), PDP details beside the buying block (PDP-001)
// and the art-led hero (HOME-001). Lab only (production build, disposable database). Anonymous.
//   QA_LAB_EXTRA_SPECS=tests/e2e/uiux-refine-lab.spec.ts npx tsx scripts/qa-staging-lab.ts --only=uiux-refine-lab

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const run = randomBytes(3).toString("hex").toLowerCase();
const outDir = process.env.UIUX_LAB_OUT ?? path.join("output", "uiux-refine-01", "lab");
const metrics: Record<string, unknown> = { run };
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 1000 };

const LONG_DESCRIPTION = Array.from({ length: 6 }, (_, index) => `Parágrafo ${index + 1} da descrição completa da peça: tecido, modelagem, caimento e cuidados.`).join("\n\n");
const catalog = [
  { key: "meia", brand: "BAPE", price: 4221, sizes: ["Único"], stock: 3 },
  { key: "camiseta-72", brand: "BAPE", price: 7200, sizes: ["P", "M"], stock: 2 },
  { key: "camiseta-180", brand: "BAPE", price: 18000, sizes: ["G"], stock: 2 },
  { key: "jaqueta", brand: "Stüssy", price: 60000, sizes: ["GG"], stock: 1 },
  { key: "bermuda", brand: "Stüssy", price: 25000, sizes: ["M"], stock: 0 },
].map((item) => ({
  ...item,
  id: `qa_rf_${item.key}_${run}`,
  slug: `qa-rf-${item.key}-${run}`,
  title: `QA Refine ${item.key} ${run.toUpperCase()}`,
}));

async function shot(page: Page, area: string, name: string, fullPage = true) {
  const dir = path.join(outDir, area);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage });
}

test.beforeAll(async () => {
  await withDatabase(async (db) => {
    const category = (await db.query(`SELECT id FROM "Category" WHERE active = true AND "parentId" IS NULL ORDER BY "sortOrder" LIMIT 1`)).rows[0]?.id ?? null;
    for (const [index, item] of catalog.entries()) {
      await db.query(
        `INSERT INTO "Product" (id, title, slug, description, "shortDescription", brand, "priceInCents", active, "categoryId", "weightGrams", "lengthCm", "widthCm", "heightCm", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'Resumo curto da peça.', $5, $6, true, $7, 300, 30, 24, 4, timezone('UTC', now()) - ($8 || ' days')::interval, timezone('UTC', now()))`,
        [item.id, item.title, item.slug, LONG_DESCRIPTION, item.brand, item.price, category, String(index)],
      );
      await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, '/seed-products/bone-supreme.svg', 'QA', 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${item.id}_img`, item.id]);
      for (const [sizeIndex, size] of item.sizes.entries()) {
        await db.query(`INSERT INTO "ProductVariant" (id, "productId", size, stock, active, "updatedAt") VALUES ($1, $2, $3, $4, true, timezone('UTC', now()))`, [`${item.id}_v${sizeIndex}`, item.id, size, item.stock]);
      }
    }
    // HOME-001: an art-led banner (image, eyebrow, subtitle, NO title) first, then a titled one.
    await db.query(
      `INSERT INTO "HomeBannerSlide" (id, eyebrow, title, description, href, "imageUrl", placement, alt, active, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, 'Sale Black Friday', NULL, 'Condições especiais por tempo limitado.', '/categoria/tudo', '/brand/rare-logo.png', 'home', 'Arte Black Friday até 30% off', true, 0, timezone('UTC', now()), timezone('UTC', now())),
              ($2, 'RARE', 'Streetwear importado', 'Peças escolhidas a dedo.', '/categoria/tudo', '/brand/rare-logo.png', 'home', 'Banner RARE', true, 1, timezone('UTC', now()), timezone('UTC', now()))`,
      [`qa_rf_banner_art_${run}`, `qa_rf_banner_text_${run}`],
    );
  });
});

test.afterAll(() => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "refine-metrics.json"), JSON.stringify(metrics, null, 2));
});

test("HOME-001: the art-led banner has nothing drawn over it and the indicators sit below the art", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [label, viewport] of [["390", PHONE], ["1440", DESKTOP]] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const hero = page.locator(".store-home-hero");
    const slide = hero.locator('[aria-roledescription="slide"]');
    await expect(slide).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(slide).toHaveAttribute("data-art-led", "true");
    // One DOM read: the carousel may advance between separate locator calls.
    const measured = await page.evaluate(() => {
      const root = document.querySelector(".store-home-hero")!;
      const current = root.querySelector<HTMLElement>('[aria-roledescription="slide"]')!;
      const dots = root.querySelector<HTMLElement>('[aria-label="Selecionar slide"]');
      const box = current.getBoundingClientRect();
      return {
        artLed: current.dataset.artLed ?? null,
        overlayText: [...current.querySelectorAll("p,h2")].filter((node) => !node.closest(".sr-only") && (node as HTMLElement).offsetParent !== null).map((node) => node.textContent),
        slideBottom: Math.round(box.bottom),
        indicatorsTop: dots ? Math.round(dots.getBoundingClientRect().top) : null,
      };
    });
    metrics[`home ${label}`] = measured;
    expect(measured.artLed).toBe("true");
    expect(measured.overlayText).toEqual([]);
    expect(measured.indicatorsTop).not.toBeNull();
    expect(measured.slideBottom).toBeGreaterThan(200);
    expect(measured.indicatorsTop!).toBeGreaterThanOrEqual(measured.slideBottom - 1);
    await shot(page, "storefront", `home-hero-${label}`, false);
  }
  await context.close();
});

test("NAV-001 + CATALOG-001: centered header nav, toolbar with real total, filter panel, sort and chips", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);

  await page.setViewportSize(DESKTOP);
  await page.goto("/categoria/tudo");
  const nav = await page.locator('nav[aria-label="Navegação por categoria"]').evaluate((element) => {
    const items = [...element.querySelectorAll<HTMLElement>("a, button")].filter((item) => item.offsetParent !== null && !item.closest("[data-category-menu]"));
    const bar = element.getBoundingClientRect();
    const left = Math.min(...items.map((item) => item.getBoundingClientRect().left));
    const right = Math.max(...items.map((item) => item.getBoundingClientRect().right));
    const button = element.querySelector("button");
    const link = element.querySelector("a");
    return {
      emptyLeftPx: Math.round(left - bar.left),
      emptyRightPx: Math.round(bar.right - right),
      buttonFont: button ? `${getComputedStyle(button).fontWeight}/${getComputedStyle(button).fontSize}` : null,
      linkFont: link ? `${getComputedStyle(link).fontWeight}/${getComputedStyle(link).fontSize}` : null,
    };
  });
  metrics["header nav 1440"] = nav;
  expect(Math.abs(nav.emptyLeftPx - nav.emptyRightPx)).toBeLessThanOrEqual(48);
  if (nav.buttonFont) expect(nav.buttonFont).toBe(nav.linkFont);
  await expect(page.locator('[aria-label="Atalhos do catálogo"]')).toBeHidden();
  const toolbar = page.getByTestId("catalog-toolbar");
  await expect(toolbar).toContainText(/\d+ produtos?/);
  metrics["catalog 1440 total"] = await toolbar.locator("p").first().textContent();
  await shot(page, "storefront", "catalogo-tudo-1440", false);

  await toolbar.getByRole("button", { name: /Filtrar/ }).click();
  const dialog = page.getByRole("dialog", { name: "Filtrar" });
  await expect(dialog).toBeVisible();
  await shot(page, "storefront", "catalogo-filtros-1440", false);
  await dialog.getByRole("radio", { name: "BAPE" }).check();
  await dialog.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/brand=BAPE/);
  metrics["catalog BAPE total"] = await page.getByTestId("catalog-toolbar").locator("p").first().textContent();
  await page.getByTestId("catalog-sort").selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
  const order = await page.locator(`main a[href^="/produto/qa-rf-"]`).evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
  metrics["catalog BAPE price-asc"] = order;
  // Only BAPE (the Stüssy fixtures are gone) and cheapest first: R$ 42,21, R$ 72,00, R$ 180,00.
  expect(order).toEqual(["meia", "camiseta-72", "camiseta-180"].map((key) => `/produto/qa-rf-${key}-${run}`));
  await expect(page.getByRole("link", { name: "Remover filtro Marca: BAPE" })).toBeVisible();
  await shot(page, "storefront", "catalogo-bape-menor-preco-1440", false);

  await page.setViewportSize(PHONE);
  await page.goto("/categoria/tudo");
  await expect(page.locator('[aria-label="Atalhos do catálogo"]')).toBeVisible();
  await shot(page, "storefront", "catalogo-tudo-390", false);
  await page.getByTestId("catalog-toolbar").getByRole("button", { name: /Filtrar/ }).click();
  await expect(page.getByRole("dialog", { name: "Filtrar" })).toBeVisible();
  const sheet = await page.getByRole("dialog", { name: "Filtrar" }).boundingBox();
  metrics["filter sheet 390"] = sheet && { top: Math.round(sheet.y), height: Math.round(sheet.height), width: Math.round(sheet.width) };
  await shot(page, "storefront", "catalogo-filtros-390", false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filtrar" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
});

test("PDP-001: the full description sits under the buying block, beside the gallery", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  for (const [label, viewport] of [["1440", DESKTOP], ["1024", { width: 1024, height: 900 }], ["390", PHONE]] as const) {
    await page.setViewportSize(viewport);
    await page.goto(`/produto/${catalog[2].slug}`);
    const details = page.locator("#product-details-title");
    await expect(details).toBeVisible();
    const layout = await page.evaluate(() => {
      const heading = document.getElementById("product-details-title")!.getBoundingClientRect();
      const asideElement = document.getElementById("product-details-title")!.closest("aside")!;
      const gallery = asideElement.previousElementSibling!.getBoundingClientRect();
      const aside = asideElement.getBoundingClientRect();
      return { detailsTop: Math.round(heading.top + scrollY), detailsLeft: Math.round(heading.left), galleryBottom: Math.round(gallery.bottom + scrollY), asideLeft: Math.round(aside.left), page: document.documentElement.scrollHeight };
    });
    metrics[`pdp ${label}`] = layout;
    if (label !== "390") {
      expect(layout.detailsLeft).toBeGreaterThanOrEqual(layout.asideLeft);
      expect(layout.detailsTop).toBeLessThan(layout.galleryBottom + 400);
    }
    await shot(page, "product", `pdp-detalhes-${label}`);
  }
  // PDP-002 on the same lab: R$ 42,21 alone allows 4x.
  await page.setViewportSize(DESKTOP);
  await page.goto(`/produto/${catalog[0].slug}`);
  await expect(page.getByRole("heading", { level: 1, name: /QA Refine meia/ })).toBeVisible();
  const hintLocator = page.locator("aside p").filter({ hasText: /sem juros|no cartão/ });
  const hint = (await hintLocator.count()) ? await hintLocator.first().textContent() : null;
  metrics["pdp R$42,21 hint"] = hint;
  await shot(page, "product", "pdp-meia-r42-1440", false);
  await context.close();
});

// ── P2 / P3 (approved after the P1 cycle) ───────────────────────────────────────────────────────

test("404-001: unknown URLs and products answer 404 inside the store layout", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  for (const [label, url] of [["geral", "/esta-pagina-nao-existe"], ["produto", "/produto/peca-que-nao-existe"]] as const) {
    for (const [width, viewport] of [["390", PHONE], ["1440", DESKTOP]] as const) {
      await page.setViewportSize(viewport);
      const response = await page.goto(url);
      expect(response?.status(), `${label} status`).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: /não encontrad/ })).toBeVisible();
      const layout = await page.evaluate(() => ({
        header: Boolean(document.querySelector("header")),
        footer: Boolean(document.querySelector("footer")),
        search: Boolean(document.querySelector('form[role="search"]')),
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
        font: getComputedStyle(document.body).fontFamily,
      }));
      metrics[`404 ${label} ${width}`] = layout;
      expect(layout.header && layout.footer && layout.search).toBe(true);
      expect(layout.robots ?? "").toMatch(/noindex/);
      await shot(page, "storefront", `404-${label}-${width}`, false);
    }
  }
  await context.close();
});

test("COOKIES-002, GLOBAL-001, PDP-003, A11Y-002: banner size, button fonts, phone PDP and focus under the header", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  // The lab context starts with a stored consent; a first visit has none.
  await context.clearCookies({ name: "rare_cookie_consent" });
  await page.setViewportSize(PHONE);
  await page.goto("/");
  const banner = page.locator("[data-cookie-banner]");
  await expect(banner).toBeVisible();
  const bannerBox = await banner.boundingBox();
  metrics["cookie banner 390"] = { height: bannerBox && Math.round(bannerBox.height), share: bannerBox && Math.round((bannerBox.height / PHONE.height) * 100) };
  expect(bannerBox!.height).toBeLessThan(PHONE.height * 0.33);
  await shot(page, "storefront", "cookie-banner-390", false);
  await banner.getByRole("button", { name: "Recusar não essenciais", exact: true }).click();

  await page.goto(`/produto/${catalog[1].slug}`);
  await expect(page.getByRole("heading", { level: 1, name: catalog[1].title })).toBeVisible();
  const pdp = await page.evaluate(() => {
    const h1 = document.querySelector("main aside h1")!.getBoundingClientRect();
    const add = [...document.querySelectorAll("main aside button")].find((button) => /adicionar ao carrinho/i.test(button.textContent ?? ""))!;
    const style = getComputedStyle(add);
    return { h1Top: Math.round(h1.top + scrollY), addTop: Math.round(add.getBoundingClientRect().top + scrollY), addFont: `${style.fontWeight}/${style.fontSize}` };
  });
  metrics["pdp phone first screen 390"] = { ...pdp, viewport: 844 };
  expect(pdp.addFont).toBe("900/14px");
  await page.mouse.wheel(0, 1600);
  await expect(page.getByTestId("pdp-buy-bar")).toBeVisible();
  // Pinned to the screen, not to the page: its bottom edge is the bottom of the viewport.
  const bar = await page.getByTestId("pdp-buy-bar").boundingBox();
  metrics["pdp buy bar 390"] = bar && { top: Math.round(bar.y), bottom: Math.round(bar.y + bar.height) };
  expect(Math.abs(bar!.y + bar!.height - PHONE.height)).toBeLessThanOrEqual(1);
  await shot(page, "product", "pdp-barra-compra-390", false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByTestId("pdp-buy-bar")).toBeHidden();

  // Focus a control that sits right under the sticky header after a scroll: it must stay visible.
  await page.setViewportSize(DESKTOP);
  await page.goto(`/produto/${catalog[1].slug}`);
  // Scrolled past the size buttons: focusing one scrolls it back, and it must land below the header.
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.locator("aside button[aria-pressed]").first().focus();
  const focus = await page.evaluate(() => {
    const header = document.querySelector("header")!.getBoundingClientRect();
    const active = document.activeElement!.getBoundingClientRect();
    return { headerBottom: Math.round(header.bottom), focusedTop: Math.round(active.top), scrollPadding: getComputedStyle(document.documentElement).scrollPaddingTop };
  });
  metrics["focus under header 1440"] = focus;
  expect(focus.focusedTop).toBeGreaterThanOrEqual(focus.headerBottom - 1);
  await context.close();
});
