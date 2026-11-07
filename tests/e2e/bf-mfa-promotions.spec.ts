import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";
import {
  acceptDialogs,
  businessInputValue,
  enrollAdmin,
  formAlert,
  labBaseUrl,
  labContextOptions,
  labEnabled,
  rawFetch,
  requireEnv,
  withDatabase,
} from "./lab-helpers";
import { formatAxeViolations, waitForEntranceAnimations } from "./storefront-fixtures";

// Central de Promoções + QA Black Friday campaign, end to end on a production build with
// APP_ENV=staging (scripts/qa-staging-lab.ts): Admin actions, storefront effect without deploy,
// server-side price, server-action replay, scheduling, audit, analytics, responsive and axe.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(240_000);

const BF_NAME = "SALE BLACK FRIDAY — QA";
const BF_HEADLINE = "SALE BLACK FRIDAY — QA";
const WINDOW_HEADLINE = "QA JANELA CURTA";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

let context: BrowserContext;
let page: Page;
// The cart needs a signed-in shopper: a second, customer-only context.
let shopperContext: BrowserContext;
let shopper: Page;
let bfId = "";
// A DRAFT without products (from the validation test): its page shows the "Para ativar" notice.
let incompleteId = "";

const product = () => ({
  id: requireEnv("QA_BF_PRODUCT_ID"),
  variantId: requireEnv("QA_BF_VARIANT_ID"),
  slug: requireEnv("QA_BF_PRODUCT_SLUG"),
  title: requireEnv("QA_BF_PRODUCT_TITLE"),
});
const windowProduct = () => ({ slug: requireEnv("QA_WINDOW_PRODUCT_SLUG"), title: requireEnv("QA_WINDOW_PRODUCT_TITLE") });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext(labContextOptions());
  page = await context.newPage();
  await acceptDialogs(page);
  await enrollAdmin(page, requireEnv("QA_MFA_C_LOGIN"), requireEnv("QA_MFA_C_PASSWORD"), new Set());
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);

  shopperContext = await browser.newContext(labContextOptions());
  shopper = await shopperContext.newPage();
  await shopper.goto("/entrar");
  await shopper.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await shopper.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await shopper.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(shopper).not.toHaveURL(/\/entrar/);
});

/** A cart whose stored price was tampered with (R$ 1,00), as a hostile browser would keep it. */
async function seedTamperedCart() {
  const { id, variantId, slug, title } = product();
  await shopper.goto("/");
  await shopper.evaluate(([productId, variant, productSlug, productTitle]) => {
    window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId: variant, title: productTitle, slug: productSlug, size: "M", priceInCents: 100, quantity: 1, maxQuantity: 1 }]));
  }, [id, variantId, slug, title]);
}

test.afterAll(async () => {
  await shopperContext?.close();
  await context?.close();
});

async function fillPromotion(values: {
  name: string; type?: "PERCENTAGE" | "FIXED_AMOUNT"; value?: string; startsAt?: string; endsAt?: string; priority?: string;
  scope?: "ALL_PRODUCTS" | "SELECTED_PRODUCTS" | "SELECTED_CATEGORIES"; productTitle?: string; featured?: boolean;
  badge?: string; headline?: string; subheadline?: string; ctaLabel?: string; ctaHref?: string; banner?: string; bannerAlt?: string;
}) {
  await page.locator('input[name="name"]').fill(values.name);
  if (values.priority) await page.locator('input[name="priority"]').fill(values.priority);
  await page.locator('select[name="type"]').selectOption(values.type ?? "PERCENTAGE");
  await page.locator('input[name="value"]').fill(values.value ?? "");
  if (values.startsAt !== undefined) await page.locator('input[name="startsAt"]').fill(values.startsAt);
  if (values.endsAt !== undefined) await page.locator('input[name="endsAt"]').fill(values.endsAt);
  if (values.scope) await page.locator(`input[name="scope"][value="${values.scope}"]`).check();
  if (values.productTitle) {
    await page.getByPlaceholder("nome do produto").fill(values.productTitle);
    await page.locator("label").filter({ hasText: values.productTitle }).locator('input[type="checkbox"]').first().check();
  }
  if (values.featured) await page.locator('input[name="homepageFeatured"]').check();
  if (values.badge !== undefined) await page.locator('input[name="badgeText"]').fill(values.badge);
  if (values.headline !== undefined) await page.locator('input[name="headline"]').fill(values.headline);
  if (values.subheadline !== undefined) await page.locator('input[name="subheadline"]').fill(values.subheadline);
  if (values.ctaLabel !== undefined) await page.locator('input[name="ctaLabel"]').fill(values.ctaLabel);
  if (values.ctaHref !== undefined) await page.locator('input[name="ctaHref"]').fill(values.ctaHref);
  if (values.banner !== undefined) await page.locator('input[name="bannerImageUrl"]').fill(values.banner);
  if (values.bannerAlt !== undefined) await page.locator('input[name="bannerAlt"]').fill(values.bannerAlt);
}

async function submitNew() {
  await page.getByRole("button", { name: "Criar rascunho" }).click();
}

async function promotionIdFromUrl() {
  await expect(page).toHaveURL(/\/admin\/promotions\/[A-Za-z0-9_-]+(\/edit)?\?/);
  await settleAfterRedirect();
  return new URL(page.url()).pathname.split("/")[3];
}

async function statusOf(id: string) {
  return withDatabase(async (db) => (await db.query(`SELECT status FROM "Promotion" WHERE id = $1`, [id])).rows[0]?.status as string);
}

async function storefrontText(pathname: string) {
  await page.goto(pathname);
  // The storefront streams behind a loading boundary: read only the final content.
  await expect(page.locator("main").first()).not.toContainText("Carregando conteúdo", { timeout: 15_000 });
  await waitForEntranceAnimations(page);
  // formatMoney writes "R$\u00a0150,00"; compare with plain spaces.
  return (await page.locator("main").innerText()).replace(/\u00a0/g, " ");
}

async function clickStatus(label: "Ativar" | "Pausar" | "Encerrar") {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page).toHaveURL(/success=promotion-|error=promotion-/);
  await settleAfterRedirect();
}

/**
 * A server action redirect is a soft navigation; on WebKit it completes after the URL changes and
 * after the network goes idle, and a page.goto started before it ends is interrupted. Wait for the
 * destination (promotion page or its edit form) to render.
 */
async function settleAfterRedirect() {
  await expect(page.getByRole("link", { name: "Pré-visualizar" }).or(page.getByRole("button", { name: "Salvar alterações" })).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

test("validation refuses incoherent or unsafe promotions and never stores them", async () => {
  const future = (hours: number) => businessInputValue(hours * 3_600_000);
  const cases: Array<{ label: string; values: Parameters<typeof fillPromotion>[0]; expected: string; inject?: [string, string] }> = [
    { label: "-10%", values: { name: "QA inválida -10%", value: "-10" }, expected: "O desconto deve ser maior que zero." },
    { label: "101%", values: { name: "QA inválida 101%", value: "101" }, expected: "O percentual não pode passar de 100%." },
    { label: "R$ -10", values: { name: "QA inválida R$ -10", type: "FIXED_AMOUNT", value: "-10" }, expected: "O desconto não pode ser negativo." },
    { label: "fim antes do início", values: { name: "QA inválida datas", value: "10", startsAt: future(48), endsAt: future(24) }, expected: "O fim deve ser depois do início." },
    { label: "CTA externo", values: { name: "QA inválida CTA", value: "10", ctaHref: "https://evil.example/promo" }, expected: "O link do CTA deve ser um caminho interno" },
    { label: "CTA javascript:", values: { name: "QA inválida JS", value: "10", ctaHref: "javascript:alert(document.cookie)" }, expected: "O link do CTA deve ser um caminho interno" },
    { label: "CTA protocol-relative", values: { name: "QA inválida //", value: "10", ctaHref: "//evil.example" }, expected: "O link do CTA deve ser um caminho interno" },
    { label: "banner javascript:", values: { name: "QA inválida banner", value: "10", banner: "javascript:alert(1)", bannerAlt: "x" }, expected: "A imagem do banner deve ser um caminho interno ou uma URL https." },
    { label: "banner http", values: { name: "QA inválida banner http", value: "10", banner: "http://evil.example/a.png", bannerAlt: "x" }, expected: "A imagem do banner deve ser um caminho interno ou uma URL https." },
    { label: "produto inexistente", values: { name: "QA inválida produto", value: "10", scope: "SELECTED_PRODUCTS" }, inject: ["productIds", "qa_produto_inexistente"], expected: "Há produto inexistente na seleção." },
    { label: "categoria inexistente", values: { name: "QA inválida categoria", value: "10", scope: "SELECTED_CATEGORIES" }, inject: ["categoryIds", "qa_categoria_inexistente"], expected: "Há categoria inexistente na seleção." },
  ];
  for (const testCase of cases) {
    await page.goto("/admin/promotions/new");
    await fillPromotion(testCase.values);
    if (testCase.inject) {
      const [name, value] = testCase.inject;
      await page.evaluate(([field, id]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = field;
        input.value = id;
        document.querySelector('form:has(input[name="name"])')?.appendChild(input);
      }, [name, value]);
    }
    await submitNew();
    await expect(formAlert(page), testCase.label).toContainText(testCase.expected);
    await expect(page, testCase.label).toHaveURL(/\/admin\/promotions\/new$/);
  }

  // Mass assignment: status/id/audit fields in the form are ignored (allowlist).
  await page.goto("/admin/promotions/new");
  await fillPromotion({ name: "QA massa", value: "10", headline: '<img src=x onerror="alert(1)">QA <script>alert(1)</script>' });
  await page.evaluate(() => {
    for (const [name, value] of [["status", "ACTIVE"], ["createdById", "attacker"], ["id", "qa_forced_id"]]) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      document.querySelector('form:has(input[name="name"])')?.appendChild(input);
    }
  });
  await submitNew();
  const massId = await promotionIdFromUrl();
  incompleteId = massId;
  await withDatabase(async (db) => {
    const invalid = await db.query(`SELECT COUNT(*)::int AS n FROM "Promotion" WHERE name LIKE 'QA inválida%'`);
    expect(invalid.rows[0].n).toBe(0);
    const stored = await db.query(`SELECT id, status, "createdById", headline FROM "Promotion" WHERE id = $1`, [massId]);
    expect(stored.rows[0].id).not.toBe("qa_forced_id");
    expect(stored.rows[0].status).toBe("DRAFT");
    expect(stored.rows[0].createdById).not.toBe("attacker");
    // Stored XSS: markup is neutralised to plain text before it is stored.
    expect(stored.rows[0].headline).not.toMatch(/[<>]/);
  });
  // A selected-products promotion without products cannot be activated: the page withholds the
  // button and says why (the server action refuses it too, see promotions/actions.test.ts).
  await page.goto(`/admin/promotions/${massId}/edit`);
  await page.locator('input[name="scope"][value="SELECTED_PRODUCTS"]').check();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(/success=promotion-saved/);
  await settleAfterRedirect();
  await expect(page.getByRole("button", { name: "Ativar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Para ativar, resolva:" })).toContainText("Selecione ao menos um produto.");
  expect(await statusOf(massId)).toBe("DRAFT");
});

test("QA Black Friday campaign: draft and preview change nothing; activation reaches the storefront at once", async ({ playwright }) => {
  const { title, slug, id, variantId } = product();
  await page.goto("/admin/promotions/new");
  await fillPromotion({
    name: BF_NAME, value: "25", startsAt: businessInputValue(-60_000), endsAt: businessInputValue(45 * 60_000),
    scope: "SELECTED_PRODUCTS", productTitle: title, featured: true, badge: "BLACK FRIDAY QA", headline: BF_HEADLINE,
    subheadline: "Campanha de homologação (dados sintéticos).", ctaLabel: "Ver ofertas", ctaHref: "/categoria/tudo",
  });
  await submitNew();
  bfId = await promotionIdFromUrl();
  expect(await statusOf(bfId)).toBe("DRAFT");

  await page.goto(`/admin/promotions/${bfId}/preview`);
  await expect(page.locator("body")).toContainText("R$ 150,00");
  expect(await storefrontText("/")).not.toContain(BF_HEADLINE);
  const pdpBefore = await storefrontText(`/produto/${slug}`);
  expect(pdpBefore).toContain("R$ 200,00");
  expect(pdpBefore).not.toContain("R$ 150,00");

  await page.goto(`/admin/promotions/${bfId}`);
  await clickStatus("Ativar");
  expect(await statusOf(bfId)).toBe("ACTIVE");

  const home = await storefrontText("/");
  expect(home).toContain(BF_HEADLINE);
  expect(home).toContain(title);
  expect(home).toContain("25% OFF");
  await expect(page.getByRole("link", { name: "Ver ofertas" }).first()).toHaveAttribute("href", "/categoria/tudo");
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Preço original R$ 200,00, preço promocional R$ 150,00, economia de 25%").first()).toBeAttached();

  const pdp = await storefrontText(`/produto/${slug}`);
  expect(pdp).toContain("R$ 150,00");
  await expect(page.getByText("Preço original R$ 200,00, preço promocional R$ 150,00, economia de 25%").first()).toBeAttached();

  // The cart API prices from the server, whatever the browser claims.
  const pricing = await rawFetch(playwright.request, "/api/cart/pricing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    data: JSON.stringify({ items: [{ productId: id, variantId, priceInCents: 100, totalInCents: 100 }] }),
  });
  expect(pricing.status).toBe(200);
  expect(JSON.parse(pricing.text).prices[variantId]).toEqual({ priceInCents: 15000, basePriceInCents: 20000, promotional: true });

  // A tampered cart (R$ 1,00 in localStorage) is corrected to the server price on display.
  await seedTamperedCart();
  await shopper.goto("/cart");
  await expect(shopper.locator("main")).toContainText("R$ 150,00");
  await expect(shopper.locator("main")).not.toContainText("R$ 1,00");
});

test("editing an active campaign shows on the home without a deploy", async () => {
  await page.goto(`/admin/promotions/${bfId}/edit`);
  await page.locator('input[name="subheadline"]').fill("Campanha de homologação editada.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(/success=promotion-saved/);
  await settleAfterRedirect();
  expect(await storefrontText("/")).toContain("Campanha de homologação editada.");
});

test("a captured Pause server action works only with the Admin session from the store's own origin", async ({ browser, playwright }) => {
  await page.goto(`/admin/promotions/${bfId}`);
  const captured: Promise<Request> = page.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]));
  await clickStatus("Pausar");
  const action = await captured;
  expect(await statusOf(bfId)).toBe("PAUSED");
  expect(await storefrontText("/")).not.toContain(BF_HEADLINE);
  expect(await storefrontText(`/produto/${product().slug}`)).not.toContain("R$ 150,00");

  await page.goto(`/admin/promotions/${bfId}`);
  await clickStatus("Ativar");
  expect(await statusOf(bfId)).toBe("ACTIVE");

  const origin = new URL(labBaseUrl()).origin;
  const adminCookie = (await context.cookies()).filter((cookie) => cookie.name === "rare_admin_session").map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const customer = await browser.newContext(labContextOptions());
  const tab = await customer.newPage();
  await tab.goto("/entrar");
  await tab.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await tab.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await tab.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(tab).not.toHaveURL(/\/entrar/);
  const customerCookie = (await customer.cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  await customer.close();

  const replay = (cookie: string, headers: Record<string, string>) => rawFetch(playwright.request, new URL(action.url()).pathname + new URL(action.url()).search, {
    method: "POST",
    cookie,
    headers: { "next-action": action.headers()["next-action"], "content-type": action.headers()["content-type"], accept: "text/x-component", ...headers },
    data: action.postDataBuffer() ?? undefined,
  });
  const outcomes: Record<string, number> = {};
  for (const [label, cookie, headers] of [
    ["no cookie", "", { origin }],
    ["customer cookie", customerCookie, { origin }],
    ["forged Origin", adminCookie, { origin: "https://evil.example" }],
    ["forged Host", adminCookie, { origin, host: "evil.example", "x-forwarded-host": "evil.example" }],
  ] as Array<[string, string, Record<string, string>]>) {
    const response = await replay(cookie, headers);
    outcomes[label] = response.status;
    expect(await statusOf(bfId), `${label} replay changed the promotion`).toBe("ACTIVE");
  }
  test.info().annotations.push({ type: "replay-statuses", description: JSON.stringify(outcomes) });

  // Missing Origin with a valid cookie: recorded, not asserted (browsers always send Origin on POST,
  // and SameSite=Lax keeps the cookie off cross-site POSTs).
  const missingOrigin = await replay(adminCookie, {});
  const afterMissingOrigin = await statusOf(bfId);
  test.info().annotations.push({ type: "missing-origin", description: `${missingOrigin.status} -> ${afterMissingOrigin}` });

  // Control: the same request from the real session and origin does pause, so the refusals above
  // are authorization, not a broken replay.
  if (afterMissingOrigin === "ACTIVE") {
    await replay(adminCookie, { origin });
    expect(await statusOf(bfId)).toBe("PAUSED");
  }
  await page.goto(`/admin/promotions/${bfId}`);
  await clickStatus("Ativar");
  expect(await statusOf(bfId)).toBe("ACTIVE");
});

test("scheduled window: starts and ends on time; price, home campaign and countdown follow without deploy", async () => {
  const { slug, title } = windowProduct();
  // datetime-local has minute resolution: start at the second next minute, end one minute later.
  const now = Date.now();
  const startMs = Math.ceil(now / 60_000) * 60_000 + 60_000;
  const endMs = startMs + 60_000;
  await page.goto("/admin/promotions/new");
  await fillPromotion({
    name: "QA janela curta", value: "10", priority: "10", startsAt: businessInputValue(startMs - now), endsAt: businessInputValue(endMs - now),
    scope: "SELECTED_PRODUCTS", productTitle: title, featured: true, headline: WINDOW_HEADLINE, ctaLabel: "Ver", ctaHref: "/categoria/tudo",
  });
  await submitNew();
  const windowId = await promotionIdFromUrl();
  await page.goto(`/admin/promotions/${windowId}`);
  await clickStatus("Ativar");
  expect(await statusOf(windowId)).toBe("SCHEDULED");

  // Before the start: not applied.
  expect(await storefrontText(`/produto/${slug}`)).not.toMatch(/economia de 10%/);
  expect(await storefrontText("/")).not.toContain(WINDOW_HEADLINE);

  await page.waitForTimeout(Math.max(0, startMs - Date.now()) + 3_000);
  const during = await storefrontText("/");
  expect(during).toContain(WINDOW_HEADLINE); // priority 10 beats the BF campaign on the home
  await expect(page.getByRole("timer")).toBeVisible();
  await page.goto(`/produto/${slug}`);
  await expect(page.getByText(/economia de 10%/).first()).toBeAttached();

  // Stay on the home: the countdown reloads at the end and the server picks the next campaign.
  await page.goto("/");
  await expect(page.locator("main")).toContainText(WINDOW_HEADLINE);
  await expect(page.locator("main")).toContainText(BF_HEADLINE, { timeout: Math.max(0, endMs - Date.now()) + 20_000 });
  await expect(page.locator("main")).not.toContainText(WINDOW_HEADLINE);
  expect(await storefrontText(`/produto/${slug}`)).not.toMatch(/economia de 10%/);
});

/** The shopper's tab for the cart and checkout, the Admin's for everything else. */
function tabFor(screen: string) {
  return screen === "/cart" || screen === "/finalizar-compra" ? shopper : page;
}

test("responsive: campaign, product, cart, checkout and promotion screens hold from 320 to 1920 px", async () => {
  test.setTimeout(900_000); // 10 widths x 12 screens; WebKit on Windows is several times slower than Chromium
  const { slug } = product();
  await seedTamperedCart();
  const screens = ["/", `/produto/${slug}`, "/cart", "/finalizar-compra", "/admin", "/admin/promotions", "/admin/promotions/new", `/admin/promotions/${bfId}`, `/admin/promotions/${bfId}/preview`, "/admin/analytics", "/admin/security", `/admin/orders/${requireEnv("QA_PAID_ORDER_ID")}`];
  const overflows: string[] = [];
  for (const width of WIDTHS) {
    for (const screen of screens) {
      const tab = tabFor(screen);
      await tab.setViewportSize({ width, height: 900 });
      await tab.goto(screen);
      await waitForEntranceAnimations(tab);
      const size = await tab.evaluate(() => {
        const client = document.documentElement.clientWidth;
        // What crosses the right edge outside any container that scrolls or clips on its own (a
        // horizontally scrolling nav is fine): elements and text runs, deepest first.
        const clipped = (node: Node) => {
          for (let current = node.parentElement; current && current !== document.body; current = current.parentElement) {
            if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(current).overflowX)) return true;
          }
          return false;
        };
        const describe = (element: Element) => `${element.tagName.toLowerCase()}.${String(element.getAttribute("class") ?? "").split(/\s+/).slice(0, 5).join(".")}`;
        const offenders: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node && offenders.length < 3; node = walker.nextNode()) {
          if (!node.textContent?.trim() || clipped(node)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const right = range.getBoundingClientRect().right;
          if (right > client + 1) offenders.push(`text "${node.textContent.trim().slice(0, 40)}" in ${describe(node.parentElement as Element)} right=${Math.round(right)}`);
        }
        for (const element of document.querySelectorAll("body *")) {
          if (offenders.length >= 6) break;
          const right = element.getBoundingClientRect().right;
          if (right > client + 1 && !clipped(element) && ![...element.children].some((child) => child.getBoundingClientRect().right > client + 1)) offenders.push(`${describe(element)} right=${Math.round(right)}`);
        }
        return { scroll: document.documentElement.scrollWidth, client, offenders };
      });
      if (size.scroll > size.client + 1) overflows.push(`${screen} @${width}: ${size.scroll} > ${size.client} :: ${size.offenders.join(" | ")}`);
    }
    if (width === 320 || width === 1920) {
      await page.goto("/");
      await page.screenshot({ path: `output/lab/screens/home-campaign-${width}.png`, fullPage: false });
      await page.goto("/admin/promotions");
      await page.screenshot({ path: `output/lab/screens/admin-promotions-${width}.png`, fullPage: false });
      await page.goto(`/admin/promotions/${bfId}`);
      await page.screenshot({ path: `output/lab/screens/admin-promotion-detail-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await shopper.setViewportSize({ width: 1440, height: 1000 });
  expect(overflows).toEqual([]);
});

test("accessibility: no serious or critical axe violation on the new screens", async () => {
  test.setTimeout(600_000);
  // /admin carries the promotion alerts here: the short window above ended while still ACTIVE.
  const screens = ["/", `/produto/${product().slug}`, "/cart", "/finalizar-compra", "/admin", "/admin/promotions", "/admin/promotions/new", `/admin/promotions/${bfId}`, `/admin/promotions/${incompleteId}`, `/admin/promotions/${bfId}/preview`, "/admin/analytics", "/admin/security"];
  const report: Record<string, number> = {};
  const findings: string[] = [];
  for (const screen of screens) {
    const tab = tabFor(screen);
    await tab.goto(screen);
    await waitForEntranceAnimations(tab);
    const results = await new AxeBuilder({ page: tab }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    report[screen] = blocking.length;
    if (blocking.length) findings.push(`${screen}\n${formatAxeViolations(blocking)}`);
  }
  test.info().annotations.push({ type: "axe", description: JSON.stringify(report) });
  expect(findings.join("\n\n")).toBe("");
  // Keyboard: the campaign CTA is reachable and shows focus.
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Ver ofertas" }).first();
  await cta.focus();
  await expect(cta).toBeFocused();
});

test("performance smoke: no gross regression on the pages this cycle touched", async () => {
  // Local production build, warm cache: a ceiling for regressions, not a benchmark.
  const timings: Record<string, number> = {};
  for (const screen of ["/", "/categoria/tudo", `/produto/${product().slug}`, "/admin", "/admin/promotions", "/admin/analytics"]) {
    await page.goto(screen); // warm
    const samples: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const started = Date.now();
      await page.goto(screen, { waitUntil: "load" });
      samples.push(Date.now() - started);
    }
    timings[screen] = samples.sort((a, b) => a - b)[1];
    expect(timings[screen], `${screen} median ${timings[screen]} ms`).toBeLessThan(5_000);
  }
  test.info().annotations.push({ type: "timings-ms", description: JSON.stringify(timings) });
});

test("ending is final: the storefront drops the campaign, editing is refused, duplicate starts a clean draft", async () => {
  await page.goto(`/admin/promotions/${bfId}`);
  await clickStatus("Encerrar");
  expect(await statusOf(bfId)).toBe("ENDED");
  expect(await storefrontText("/")).not.toContain(BF_HEADLINE);
  expect(await storefrontText(`/produto/${product().slug}`)).not.toContain("R$ 150,00");

  await page.goto(`/admin/promotions/${bfId}/edit`);
  await expect(page.locator("main")).toContainText("Promoção encerrada: não pode ser editada.");
  // The notice is legible in the dark Admin.
  const notice = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  const blocking = notice.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking, formatAxeViolations(blocking)).toEqual([]);

  await page.goto(`/admin/promotions/${bfId}`);
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page).toHaveURL(/\/edit\?success=promotion-duplicated/);
  await settleAfterRedirect();
  const copyId = new URL(page.url()).pathname.split("/")[3];
  await withDatabase(async (db) => {
    const { rows } = await db.query(`SELECT status, "startsAt", "endsAt", "homepageFeatured", name FROM "Promotion" WHERE id = $1`, [copyId]);
    expect(rows[0]).toMatchObject({ status: "DRAFT", startsAt: null, endsAt: null, homepageFeatured: false });
    expect(rows[0].name).toContain(BF_NAME);
  });
});

test("list: search, status filter, pagination and empty state", async () => {
  await page.goto("/admin/promotions?q=QA%20pagina%C3%A7%C3%A3o");
  await expect(page.locator("main")).toContainText("Página 1 de 2");
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page.locator("main")).toContainText("Página 2 de 2");
  await page.goto("/admin/promotions?status=ENDED");
  await expect(page.locator("main")).toContainText(BF_NAME);
  await page.goto("/admin/promotions?q=zzz-nada-qa");
  await expect(page.locator("main")).toContainText("Nenhuma promoção encontrada.");
});

test("audit log records every transition with the actor and no sensitive data", async () => {
  await withDatabase(async (db) => {
    const { rows } = await db.query(`SELECT action, "actorLabel", before, after FROM "AdminAuditLog" WHERE "entityType" = 'Promotion' AND ("entityId" = $1 OR after->>'sourceId' = $1) ORDER BY "createdAt"`, [bfId]);
    const actions = new Set(rows.map((row) => row.action));
    for (const action of ["promotion.created", "promotion.updated", "promotion.activated", "promotion.paused", "promotion.ended", "promotion.duplicated"]) {
      expect(actions.has(action), `missing ${action}`).toBe(true);
    }
    for (const row of rows) {
      expect(row.actorLabel).toBeTruthy();
      expect(JSON.stringify([row.before, row.after])).not.toMatch(/password|passwordHash|mfaSecret|token|cpf/i);
    }
  });
});

test("analytics: promotion metrics match an independent query and ignore refunded orders", async () => {
  await page.goto("/admin/analytics");
  const section = page.locator('section[aria-labelledby="analytics-promotions"]');
  await expect(section).toBeVisible();
  const text = await section.innerText();
  const expected = await withDatabase(async (db) => (await db.query(`
    SELECT COUNT(DISTINCT oi."orderId")::int AS orders, COALESCE(SUM(oi."totalInCents"),0)::int AS revenue,
           COALESCE(SUM(oi."promotionDiscountInCents" * oi.quantity),0)::int AS discount, COALESCE(SUM(oi.quantity),0)::int AS quantity
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
    WHERE oi."promotionId" IS NOT NULL AND o.status IN ('paid','processing','shipped','delivered') AND o."paidAt" >= now() - interval '25 days'`)).rows[0]);
  const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ");
  const normalized = text.replace(/\u00a0/g, " ");
  expect(expected.orders).toBeGreaterThan(0);
  expect(normalized).toContain(money(expected.revenue));
  expect(normalized).toContain(money(expected.discount));
  test.info().annotations.push({ type: "analytics", description: JSON.stringify(expected) });
});

test("an Asaas order in the Admin shows provider, totals and the refund action, never a raw payload", async () => {
  await page.goto(`/admin/orders/${requireEnv("QA_PAID_ORDER_ID")}`);
  const main = page.locator("main");
  await expect(main).toContainText("Provedor: Asaas");
  await expect(main).toContainText("R$ 170,00");
  await expect(main).toContainText("QA Analytics (qa-analytics): R$ 200,00 → R$ 150,00");
  await expect(main).toContainText("- R$ 50,00");
  await expect(main).toContainText("Frete");
  await expect(main).toContainText("R$ 20,00");
  await expect(page.locator('input[name="confirm"]')).toBeAttached();
  const html = await page.content();
  expect(html).not.toMatch(/\$aact_|externalReference|asaas-access-token/);
});
