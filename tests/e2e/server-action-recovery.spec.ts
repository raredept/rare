import { expect, test } from "@playwright/test";
import { blockExternalRequests } from "./storefront-fixtures";

test("a stale customer action offers a manual refresh without replaying the submission", async ({ page, baseURL }) => {
  await blockExternalRequests(page, baseURL);
  let actionRequests = 0;
  await page.route("**/entrar", async (route) => {
    if (route.request().method() === "POST") {
      actionRequests += 1;
      expect(route.request().headers()["next-action"]).toBeTruthy();
      await route.fulfill({
        status: 404,
        headers: {
          "x-nextjs-action-not-found": "1",
          "cache-control": "no-store",
          "content-type": "text/plain",
        },
        body: "Server action not found.",
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("qa-stale-action@rare.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("SyntheticPassword123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Esta página pertence a uma versão anterior." })).toBeVisible();
  await expect(page.getByText("Nenhuma operação será repetida automaticamente.", { exact: false })).toBeVisible();
  expect(actionRequests).toBe(1);

  await page.getByRole("button", { name: "Atualizar página", exact: true }).click();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  expect(actionRequests).toBe(1);
});
