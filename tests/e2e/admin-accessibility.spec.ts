import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Accessibility pass over the authenticated Admin.
 *
 * Opt-in: it needs an Admin account on whatever database the target runs
 * against, so it stays skipped unless QA_ADMIN_LOGIN/QA_ADMIN_PASSWORD are set.
 * Point it at a disposable environment:
 *
 *   QA_ADMIN_LOGIN=... QA_ADMIN_PASSWORD=... \
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3123 \
 *   npx playwright test tests/e2e/admin-accessibility.spec.ts --project=chromium-desktop
 */

const login = process.env.QA_ADMIN_LOGIN;
const password = process.env.QA_ADMIN_PASSWORD;

const adminRoutes = [
  { name: "Visão geral", path: "/admin" },
  { name: "Analytics", path: "/admin/analytics" },
  { name: "Analytics (7 dias)", path: "/admin/analytics?period=7d" },
  { name: "Analytics (período vazio)", path: "/admin/analytics?period=custom&from=2019-01-01&to=2019-01-07" },
  { name: "Pedidos", path: "/admin/orders" },
  { name: "Pedidos (status inválido)", path: "/admin/orders?status=notastatus" },
  { name: "Produtos", path: "/admin/products" },
  // Covers the media chips in the image manager, which the list page does not render.
  { name: "Produto novo", path: "/admin/products/new" },
  { name: "Clientes", path: "/admin/customers" },
];

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .map((node) => node.target.join(" "))
          .join("\n  ")}`,
    )
    .join("\n\n");
}

// One sign-in for the whole file, reused by every test.
//
// Logging in per test trips the admin login rate limit (8 attempts per
// identity and address in five minutes) long before the suite finishes, which
// is the limiter doing its job rather than something to work around in the
// application.
test.describe.configure({ mode: "serial" });

test.describe("Admin accessibility", () => {
  test.skip(!login || !password, "Requer QA_ADMIN_LOGIN e QA_ADMIN_PASSWORD.");

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      // A homologation target also sits behind the Basic gate; this context is
      // created directly, so it does not inherit the project-level credentials.
      httpCredentials: process.env.STAGING_ACCESS_USERNAME
        ? { username: process.env.STAGING_ACCESS_USERNAME, password: process.env.STAGING_ACCESS_PASSWORD ?? "" }
        : undefined,
    });
    page = await context.newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Login ou e-mail").fill(login!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15_000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const route of adminRoutes) {
    test(`${route.name} não tem violações Axe`, async () => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);

      // Wait for the streamed page, not the Suspense fallback: the fallback has
      // no h1, so auditing it would report the wrong document.
      await expect(page.locator("h1")).toBeVisible();

      // A single main landmark and a single h1, so the page structure is unambiguous.
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  }

  test("o filtro de período do Analytics é operável só pelo teclado", async () => {
    await page.goto("/admin/analytics");

    const sevenDays = page.getByRole("link", { name: "7 dias" });
    await sevenDays.focus();
    await expect(sevenDays).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/period=7d/);

    // The active preset is announced, not only coloured.
    await expect(page.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "page");
  });

  test("a tabela de estoque crítico tem cabeçalhos de coluna associados", async () => {
    await page.goto("/admin/analytics?period=90d");

    const table = page.locator("table").first();
    if (await table.count()) {
      expect(await table.locator("thead th[scope='col']").count()).toBeGreaterThan(0);
    }
  });
});
