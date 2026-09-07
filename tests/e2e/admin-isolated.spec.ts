import path from "node:path";
import pg from "pg";
import { expect, test, type Page } from "@playwright/test";

const databaseUrl = process.env.QA_DATABASE_URL;
const currentLogin = process.env.QA_CURRENT_ADMIN_LOGIN;
const currentPassword = process.env.QA_CURRENT_ADMIN_PASSWORD;
const pendingLogin = process.env.QA_PENDING_ADMIN_LOGIN;
const pendingPassword = process.env.QA_PENDING_ADMIN_PASSWORD;
const replacementPassword = process.env.QA_REPLACEMENT_ADMIN_PASSWORD;
const { Client } = pg;

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Login ou e-mail").fill(identifier);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function query<T extends pg.QueryResultRow>(sql: string, values: unknown[] = []) {
  if (!databaseUrl) throw new Error("QA_DATABASE_URL ausente.");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<T>(sql, values);
    return result.rows;
  } finally {
    await client.end();
  }
}

function requireQaEnvironment() {
  const values = [databaseUrl, currentLogin, currentPassword, pendingLogin, pendingPassword, replacementPassword];
  return values.every((value) => typeof value === "string" && value.length > 0);
}

test("first access blocks pages, API and a real Server Action, rotates the password and invalidates old sessions", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Fluxo mutável executado uma vez no projeto desktop.");
  test.skip(!requireQaEnvironment(), "Requer o runner com PostgreSQL descartável.");

  const baseURL = testInfo.project.use.baseURL as string;
  const currentContext = await browser.newContext({ baseURL });
  const currentPage = await currentContext.newPage();
  await login(currentPage, currentLogin!, currentPassword!);
  await expect(currentPage).toHaveURL(/\/admin(?:\?|$)/);
  await currentPage.goto("/admin/products");
  const mutationForm = currentPage.locator("form").filter({ has: currentPage.getByRole("button", { name: "Ocultar" }) }).first();
  const actionInput = mutationForm.locator('input[type="hidden"][name^="$ACTION_ID_"]');
  await expect(actionInput).toHaveCount(1);
  const actionName = await actionInput.getAttribute("name");
  const productId = await mutationForm.locator('input[name="id"]').inputValue();
  const activeBefore = await query<{ active: boolean }>(`SELECT "active" FROM "Product" WHERE "id" = $1`, [productId]);

  const pendingContext = await browser.newContext({ baseURL });
  const staleContext = await browser.newContext({ baseURL });
  const pendingPage = await pendingContext.newPage();
  const stalePage = await staleContext.newPage();
  await login(pendingPage, pendingLogin!, pendingPassword!);
  await login(stalePage, pendingLogin!, pendingPassword!);
  await expect(pendingPage).toHaveURL(/\/admin\/change-password/);
  await expect(stalePage).toHaveURL(/\/admin\/change-password/);

  await pendingPage.goto("/admin/products");
  await expect(pendingPage).toHaveURL(/\/admin\/change-password/);

  const apiResponse = await pendingContext.request.post(`${baseURL}/api/admin/uploads`, {
    headers: { origin: new URL(baseURL).origin },
    multipart: { uploadContext: "products" },
    maxRedirects: 0,
  });
  expect([303, 307]).toContain(apiResponse.status());
  expect(apiResponse.headers().location).toBe("/admin/change-password");

  expect(actionName).toBeTruthy();
  const actionResponse = await pendingContext.request.post(`${baseURL}/admin/products`, {
    form: {
      [actionName!]: "",
      id: productId,
      active: "true",
    },
    maxRedirects: 0,
  });
  expect([303, 307]).toContain(actionResponse.status());
  expect(actionResponse.headers().location).toBe("/admin/change-password");
  const activeAfterBlockedAction = await query<{ active: boolean }>(`SELECT "active" FROM "Product" WHERE "id" = $1`, [productId]);
  expect(activeAfterBlockedAction[0]?.active).toBe(activeBefore[0]?.active);

  await pendingPage.goto("/admin/change-password");
  await pendingPage.getByLabel("Nova senha", { exact: true }).fill(replacementPassword!);
  await pendingPage.getByLabel("Confirmar nova senha", { exact: true }).fill(replacementPassword!);
  await pendingPage.getByRole("button", { name: "Definir nova senha" }).click();
  await expect(pendingPage).toHaveURL(/\/admin\?success=password-updated/);

  await stalePage.goto("/admin/products");
  await expect(stalePage).toHaveURL(/\/admin\/login/);

  const rejectedTemporaryContext = await browser.newContext({ baseURL });
  const rejectedTemporaryPage = await rejectedTemporaryContext.newPage();
  await login(rejectedTemporaryPage, pendingLogin!, pendingPassword!);
  await expect(rejectedTemporaryPage.getByText("Credenciais invalidas.")).toBeVisible();

  const replacementContext = await browser.newContext({ baseURL });
  const replacementPage = await replacementContext.newPage();
  await login(replacementPage, pendingLogin!, replacementPassword!);
  await expect(replacementPage).toHaveURL(/\/admin(?:\?|$)/);

  await currentPage.goto("/admin");
  await expect(currentPage.getByRole("heading", { name: /Visao geral|Painel|Admin/i })).toBeVisible();

  await Promise.all([
    currentContext.close(),
    pendingContext.close(),
    staleContext.close(),
    rejectedTemporaryContext.close(),
    replacementContext.close(),
  ]);
});

test("product and banner uploads persist locally; a failed replacement keeps the prior media", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Fluxo mutável executado uma vez no projeto desktop.");
  test.skip(!requireQaEnvironment(), "Requer o runner com PostgreSQL e storage descartáveis.");

  await login(page, currentLogin!, currentPassword!);
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Editar" }).first().click();
  await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/);
  const productId = new URL(page.url()).pathname.split("/")[3];
  const validImage = path.join(process.cwd(), "public", "brand", "rare-icon-192.png");
  const productUpload = page.locator('input[type="file"][multiple]');

  await productUpload.setInputFiles(validImage);
  await expect(page.getByText(/Upload concluído/).first()).toBeVisible();
  const imageUrlsInput = page.locator('input[name="imageUrls"]');
  const persistedProductImage = await imageUrlsInput.inputValue();
  expect(persistedProductImage).toMatch(/^\/uploads\/products\//);

  await productUpload.setInputFiles({
    name: "replacement-corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a decodable PNG"),
  });
  await expect(page.getByText("Arquivo de midia invalido.")).toBeVisible();
  await expect(imageUrlsInput).toHaveValue(persistedProductImage);

  for (const [name, value] of [
    ["weightGrams", "500"],
    ["heightCm", "10"],
    ["widthCm", "20"],
    ["lengthCm", "30"],
  ]) {
    await page.locator(`input[name="${name}"]`).fill(value);
  }
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/success=product-saved/);
  await expect(imageUrlsInput).toHaveValue(persistedProductImage);

  const productRows = await query<{ slug: string; url: string }>(
    `SELECT p."slug", i."url" FROM "Product" p JOIN "ProductImage" i ON i."productId" = p."id" WHERE p."id" = $1 ORDER BY i."sortOrder" LIMIT 1`,
    [productId],
  );
  expect(productRows[0]?.url).toBe(persistedProductImage);
  const productMediaResponse = await page.request.get(persistedProductImage);
  expect(productMediaResponse.status()).toBe(200);
  await page.goto(`/produto/${productRows[0]?.slug}`);
  await expect(page.locator("main img").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto("/admin/banners");
  await page.locator('input[name="title"]').fill("QA Banner Persistente");
  const bannerUpload = page.locator('input[type="file"]').first();
  await bannerUpload.setInputFiles(validImage);
  const bannerImageInput = page.locator('input[name="imageUrl"]');
  await expect(bannerImageInput).toHaveValue(/^\/uploads\/banners\//);
  const persistedBannerImage = await bannerImageInput.inputValue();

  await bannerUpload.setInputFiles({
    name: "banner-corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a decodable PNG"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "Arquivo de midia invalido." })).toBeVisible();
  await expect(bannerImageInput).toHaveValue(persistedBannerImage);
  await page.getByRole("button", { name: "Criar banner" }).click();
  await expect(page).toHaveURL(/success=banner-created/);
  await expect(bannerImageInput).toHaveValue(persistedBannerImage);

  const bannerRows = await query<{ imageUrl: string }>(
    `SELECT "imageUrl" FROM "HomeBannerSlide" WHERE "title" = $1`,
    ["QA Banner Persistente"],
  );
  expect(bannerRows[0]?.imageUrl).toBe(persistedBannerImage);
  const bannerMediaResponse = await page.request.get(persistedBannerImage);
  expect(bannerMediaResponse.status()).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("img", { name: "QA Banner Persistente" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("mobile Admin and storefront remain usable without horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Cenário reservado ao projeto mobile correto.");
  test.skip(!requireQaEnvironment(), "Requer o runner com PostgreSQL descartável.");

  await login(page, currentLogin!, currentPassword!);
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);

  for (const route of ["/admin", "/admin/products", "/admin/banners", "/", "/categoria/tudo"]) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `${route} possui overflow horizontal no viewport mobile`,
    ).toBe(true);
  }
});
