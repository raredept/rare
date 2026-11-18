import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { acceptDialogs, attachDiagnostics, enrollAdmin, expectNoHorizontalOverflow, labBaseUrl, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-FINAL-AUDIT-ASSISTANT-01: the virtual assistant end to end, on the production build in the
// lab (run with --https: the public endpoint requires a same-origin https request in production).
// Synthetic content only. Covers RBAC (SYSTEM_ADMIN allowed; SELLER_ADMIN and the legacy ADMIN
// denied in the nav, on the URL and on a forged Server Action post), CRUD + audit, the preview, the
// storefront widget (answers, fallback, XSS as text, no storage, no analytics), keyboard and axe,
// widths 320–1440 with and without the cookie banner, disabling, and the rate limit.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1) with --https.");
test.setTimeout(600_000);

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];
const shots = path.join(process.cwd(), "output", "assistant-01");
mkdirSync(shots, { recursive: true });

type Session = { context: BrowserContext; page: Page };
let system: Session;
let seller: Session;
let legacy: Session;

const ENTRIES = [
  { question: "Qual o prazo de entrega?", answer: "QA: o prazo aparece no checkout depois do CEP.", category: "Entrega", keywords: "entrega, prazo, frete, chegar, demora, envio", priority: "5" },
  { question: "Quais formas de pagamento?", answer: "QA: Pix e cartão de crédito.", category: "Pagamento", keywords: "pagamento, pix, cartão, parcelar", priority: "4" },
  { question: "Como faço uma troca?", answer: "QA: abra uma solicitação em Suporte.", category: "Trocas", keywords: "troca, trocar, devolução, tamanho errado", priority: "3" },
  { question: "Teste de segurança do texto", answer: "<img src=x onerror=alert(1)> <script>alert(2)</script> javascript:alert(3)", category: "Outros", keywords: "seguranca xss", priority: "0" },
];

async function signIn(browser: Browser, key: "A" | "E" | "F"): Promise<Session> {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  await acceptDialogs(page);
  await enrollAdmin(page, requireEnv(`QA_MFA_${key}_LOGIN`), requireEnv(`QA_MFA_${key}_PASSWORD`), new Set());
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  return { context, page };
}

async function navHrefs(page: Page) {
  return page.locator('nav[aria-label="Navegação administrativa"] a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
}

async function axe(page: Page, label: string, include?: string) {
  await page.waitForTimeout(400);
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`), label).toEqual([]);
}

async function assistantEntryCount() {
  return withDatabase(async (db) => Number((await db.query(`SELECT count(*)::int AS n FROM "VirtualAssistantEntry"`)).rows[0].n));
}

async function storefront(browser: Browser, options: { cookieConsent?: "refused" | "undecided"; width?: number } = {}) {
  const context = await browser.newContext({ ...labContextOptions({ cookieConsent: options.cookieConsent }), viewport: { width: options.width ?? 1440, height: 900 } });
  const page = await context.newPage();
  attachDiagnostics(page);
  // Any window.alert would mean injected markup ran: recorded and asserted empty.
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss().catch(() => undefined);
  });
  return { context, page, dialogs };
}

async function waitForStore(page: Page) {
  await expect(page.locator("main#store-main h1, main#store-main h2").first()).toBeVisible({ timeout: 20_000 });
}

async function ask(page: Page, text: string) {
  const answers = page.locator('[data-assistant-message="assistant"]');
  const before = await answers.count();
  await page.getByLabel("Sua pergunta").fill(text);
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(answers).toHaveCount(before + 1, { timeout: 15_000 });
  return answers.nth(before);
}

async function browserState(page: Page) {
  return page.evaluate(() => ({
    cookies: document.cookie.split(";").map((part) => part.split("=")[0].trim()).filter(Boolean).sort(),
    local: Object.keys(window.localStorage).sort(),
    session: Object.keys(window.sessionStorage).sort(),
  }));
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "VirtualAssistantEntry"`);
    await db.query(`DELETE FROM "VirtualAssistantConfig"`);
  });
  system = await signIn(browser, "E");
  seller = await signIn(browser, "F");
  legacy = await signIn(browser, "A");
});

test.afterAll(async () => {
  for (const session of [system, seller, legacy]) await session?.context.close();
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "VirtualAssistantEntry"`);
    await db.query(`DELETE FROM "VirtualAssistantConfig"`);
  });
});

test("fresh install: assistant disabled, no widget, public endpoint closed", async ({ browser }) => {
  const { context, page } = await storefront(browser);
  await page.goto("/");
  await waitForStore(page);
  await expect(page.locator("[data-assistant-launcher]")).toHaveCount(0);
  const status = await page.evaluate(async () => (await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "prazo" }) })).status);
  expect(status).toBe(404);
  await context.close();
});

test("RBAC: only SYSTEM_ADMIN sees and opens Assistente Virtual", async () => {
  await system.page.goto("/admin/users");
  expect(await navHrefs(system.page)).toContain("/admin/assistant");
  const response = await system.page.goto("/admin/assistant");
  expect(response?.status()).toBe(200);
  await expect(system.page.getByRole("heading", { level: 1, name: "Assistente Virtual" })).toBeVisible();
  await expect(system.page.locator("[data-assistant-status]")).toHaveAttribute("data-assistant-status", "disabled");

  for (const [label, session] of [["SELLER_ADMIN", seller], ["ADMIN legado", legacy]] as const) {
    await session.page.goto("/admin/conta");
    expect(await navHrefs(session.page), label).not.toContain("/admin/assistant");
    await session.page.goto("/admin/assistant");
    await expect(session.page, label).toHaveURL(/\/admin\/sem-acesso$/);
    await expect(session.page.getByText("Assistente Virtual", { exact: true })).toHaveCount(0);
    await expect(session.page.locator("[data-assistant-entry], #configuracao")).toHaveCount(0);
  }
});

test("RBAC: a forged Server Action post from SELLER_ADMIN or the legacy ADMIN writes nothing", async () => {
  await system.page.goto("/admin/assistant");
  const actionField = await system.page.locator('#nova-pergunta form input[name^="$ACTION_ID_"]').getAttribute("name");
  expect(actionField).toBeTruthy();
  const before = await assistantEntryCount();
  for (const session of [seller, legacy]) {
    const response = await session.context.request.post("/admin/assistant", {
      multipart: { [actionField!]: "", question: "Pergunta forjada?", answer: "Não deveria existir.", keywords: "forjada", priority: "1", sortOrder: "0", active: "on", category: "" },
      headers: { origin: labBaseUrl() },
      maxRedirects: 0,
    });
    expect([303, 307, 308]).toContain(response.status());
    expect(response.headers().location ?? "").toContain("/admin/sem-acesso");
  }
  expect(await assistantEntryCount()).toBe(before);
  const forged = await withDatabase((db) => db.query(`SELECT 1 FROM "VirtualAssistantEntry" WHERE question = 'Pergunta forjada?'`));
  expect(forged.rowCount).toBe(0);
});

test("SYSTEM_ADMIN cannot enable an empty assistant, then creates, edits, deactivates and reactivates answers (all audited)", async () => {
  const page = system.page;
  await page.goto("/admin/assistant");
  await page.getByLabel("Mostrar o Assistente na loja").check();
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Cadastre e ative ao menos uma resposta antes de ativar o Assistente.")).toBeVisible();

  for (const entry of ENTRIES) {
    const form = page.locator("#nova-pergunta form");
    await form.getByLabel("Pergunta", { exact: true }).fill(entry.question);
    await form.getByLabel("Resposta", { exact: true }).fill(entry.answer);
    await form.getByLabel("Palavras-chave e sinônimos").fill(entry.keywords);
    await form.getByLabel("Categoria").fill(entry.category);
    await form.getByLabel(/Prioridade/).fill(entry.priority);
    await form.getByRole("button", { name: "Criar pergunta" }).click();
    await expect(page.getByText("Pergunta criada.")).toBeVisible();
  }
  await expect(page.locator('[data-assistant-entry="active"]')).toHaveCount(ENTRIES.length);
  // Hostile text is shown as text in the Admin too.
  await expect(page.getByText("<img src=x onerror=alert(1)>", { exact: false })).toBeVisible();

  // Edit: change an answer.
  const payment = page.locator("[data-assistant-entry]").filter({ hasText: "Quais formas de pagamento?" });
  await payment.locator("summary", { hasText: "Editar" }).click();
  await payment.getByLabel("Resposta", { exact: true }).fill("QA: Pix e cartão de crédito em até 3x.");
  await payment.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(page.getByText("Pergunta salva.")).toBeVisible();
  await expect(page.locator("[data-assistant-entry]").filter({ hasText: "em até 3x" })).toHaveCount(1);

  // Deactivate and reactivate.
  const exchange = () => page.locator("[data-assistant-entry]").filter({ hasText: "Como faço uma troca?" });
  await exchange().getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText("Pergunta desativada.", { exact: false })).toBeVisible();
  await expect(exchange()).toHaveAttribute("data-assistant-entry", "inactive");
  await exchange().getByRole("button", { name: "Ativar" }).click();
  await expect(exchange()).toHaveAttribute("data-assistant-entry", "active");

  // Unsafe support link refused, then a valid configuration enables the assistant.
  await page.getByLabel("Mostrar o Assistente na loja").check();
  await page.getByLabel("Botão de suporte — destino").evaluate((input: HTMLInputElement) => {
    input.removeAttribute("pattern");
    input.value = "javascript:alert(1)";
  });
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Link do suporte inválido", { exact: false })).toBeVisible();
  await page.getByLabel("Mostrar o Assistente na loja").check();
  await page.getByLabel("Nome exibido").fill("Assistente RARE QA");
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Configuração do Assistente salva.")).toBeVisible();
  await expect(page.locator("[data-assistant-status]")).toHaveAttribute("data-assistant-status", "enabled");

  const audit = await withDatabase((db) => db.query(`SELECT action, before::text AS before, after::text AS after, "actorUserId" FROM "AdminAuditLog" WHERE "entityType" LIKE 'VirtualAssistant%' ORDER BY "createdAt"`));
  const actions = audit.rows.map((row) => row.action);
  expect(actions.filter((action) => action === "assistant.entry_created")).toHaveLength(ENTRIES.length);
  expect(actions).toEqual(expect.arrayContaining(["assistant.entry_updated", "assistant.entry_deactivated", "assistant.entry_activated", "assistant.config_updated"]));
  for (const row of audit.rows) {
    expect(row.actorUserId).toBeTruthy();
    expect(`${row.before} ${row.after}`).not.toMatch(/session|cookie|token|password|hash|"cpf"/i);
  }
  await page.screenshot({ path: path.join(shots, "admin-assistant-1440.png"), fullPage: true });
});

test("Admin preview uses the store engine and shows the score only there", async () => {
  const page = system.page;
  await page.goto("/admin/assistant#testar");
  const preview = page.locator("#testar");
  await preview.getByLabel("Pergunta de teste").fill("quanto tempo demora pra chegar?");
  await preview.getByRole("button", { name: "Testar" }).click();
  await expect(preview.locator("[data-assistant-preview-outcome]")).toHaveAttribute("data-assistant-preview-outcome", "matched");
  await expect(preview.getByText("Qual o prazo de entrega?")).toBeVisible();
  await expect(preview.getByText(/Confiança/)).toBeVisible();

  await preview.getByLabel("Pergunta de teste").fill("vocês vendem ingressos de cinema?");
  await preview.getByRole("button", { name: "Testar" }).click();
  await expect(preview.locator("[data-assistant-preview-outcome]")).toHaveAttribute("data-assistant-preview-outcome", "fallback");
  await axe(page, "admin assistant 1440");
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Assistente Virtual" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `admin assistant ${width}`);
    await axe(page, `admin assistant ${width}`);
    await page.screenshot({ path: path.join(shots, `admin-assistant-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The test question was not stored anywhere.
  const stored = await withDatabase((db) => db.query(`SELECT 1 FROM "AdminAuditLog" WHERE after::text LIKE '%ingressos de cinema%' OR before::text LIKE '%ingressos de cinema%'`));
  expect(stored.rowCount).toBe(0);
});

test("storefront widget: suggestions, answers, fallback, text-only rendering, keyboard, no storage, no analytics", async ({ browser }) => {
  const { context, page, dialogs } = await storefront(browser);
  const leaked: string[] = [];
  page.on("request", (request) => {
    const body = request.postData() ?? "";
    if (!request.url().includes("/api/assistant") && /ingressos|demora pra chegar|parcelar/.test(body + request.url())) leaked.push(request.url());
  });
  await page.goto("/");
  await waitForStore(page);
  const stateBefore = await browserState(page);
  const cookiesBefore = (await context.cookies()).map((cookie) => cookie.name).sort();

  const launcher = page.getByRole("button", { name: "Abrir Assistente RARE QA" });
  await expect(launcher).toBeVisible();
  await launcher.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Assistente RARE QA" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Sua pergunta")).toBeFocused();
  await expect(dialog.getByText("Perguntas frequentes")).toBeVisible();
  // Suggestions come from the database, highest priority first.
  await expect(dialog.getByRole("button", { name: "Qual o prazo de entrega?" })).toBeVisible();
  await axe(page, "widget open (home)", "[data-assistant-panel]");
  await page.screenshot({ path: path.join(shots, "store-widget-open-1440.png") });

  await dialog.getByRole("button", { name: "Qual o prazo de entrega?" }).click();
  await expect(dialog.locator('[data-assistant-message="assistant"]').last()).toContainText("o prazo aparece no checkout");
  expect(await ask(page, "QUANTO TEMPO DEMORA PRA CHEGAR")).toContainText("o prazo aparece no checkout");
  expect(await ask(page, "dá pra parcelar no cartão?")).toContainText("em até 3x");
  const fallback = await ask(page, "vocês vendem ingressos de cinema?");
  await expect(fallback).toContainText("Não encontrei uma resposta exata");
  await expect(fallback.getByRole("link", { name: "Falar com a equipe" })).toHaveAttribute("href", "/suporte");
  const hostile = await ask(page, "seguranca xss");
  await expect(hostile).toContainText("<img src=x onerror=alert(1)>");
  expect(await dialog.locator("img, script").count()).toBe(0);
  // Score and internals never reach the shopper.
  await expect(dialog).not.toContainText(/confiança|score|%/i);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();

  expect(await browserState(page)).toEqual(stateBefore);
  expect((await context.cookies()).map((cookie) => cookie.name).sort()).toEqual(cookiesBefore);
  expect(leaked).toEqual([]);
  expect(dialogs).toEqual([]);
  await context.close();
});

test("widget: widths 320–1440 on home, category and product page, no overflow, inside the viewport", async ({ browser }) => {
  const slug = requireEnv("QA_BF_PRODUCT_SLUG");
  for (const width of WIDTHS) {
    const { context, page } = await storefront(browser, { width });
    for (const route of ["/", "/categoria/tudo", `/produto/${slug}`]) {
      await page.goto(route);
      await waitForStore(page);
      const launcher = page.locator("[data-assistant-launcher]");
      await expect(launcher, `${route} @${width}`).toBeVisible();
      await expectNoHorizontalOverflow(page, `${route} @${width}`);
      const box = (await launcher.boundingBox())!;
      expect(box.width, `touch target ${width}`).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await launcher.click();
      const panel = page.locator("[data-assistant-panel]");
      await expect(panel).toBeVisible();
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.x, `panel left ${route} @${width}`).toBeGreaterThanOrEqual(0);
      expect(panelBox.x + panelBox.width, `panel right ${route} @${width}`).toBeLessThanOrEqual(width);
      expect(panelBox.y).toBeGreaterThanOrEqual(0);
      await expect(page.getByLabel("Sua pergunta")).toBeInViewport();
      await expectNoHorizontalOverflow(page, `${route} @${width} (open)`);
      if (route === "/") await page.screenshot({ path: path.join(shots, `store-widget-open-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    }
    await context.close();
  }
});

test("widget: stays above the cookie banner at every width and never covers its buttons", async ({ browser }) => {
  for (const width of WIDTHS) {
    const { context, page } = await storefront(browser, { width, cookieConsent: "undecided" });
    await page.goto("/");
    const banner = page.locator("[data-cookie-banner]");
    await expect(banner).toBeVisible();
    const launcher = page.locator("[data-assistant-launcher]");
    await expect(launcher).toBeVisible();
    // The offset follows the banner (ResizeObserver).
    await expect.poll(async () => {
      const [launcherBox, bannerBox] = [await launcher.boundingBox(), await banner.boundingBox()];
      return launcherBox && bannerBox ? launcherBox.y + launcherBox.height <= bannerBox.y + 0.5 : false;
    }, { message: `launcher above banner @${width}` }).toBe(true);
    await expectNoHorizontalOverflow(page, `banner @${width}`);
    await launcher.click();
    const panel = page.locator("[data-assistant-panel]");
    const [panelBox, bannerBox] = [(await panel.boundingBox())!, (await banner.boundingBox())!];
    expect(panelBox.y + panelBox.height, `panel above banner @${width}`).toBeLessThanOrEqual(bannerBox.y + 0.5);
    expect(panelBox.y).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: path.join(shots, `store-widget-cookie-banner-${width}.png`) });
    await page.keyboard.press("Escape");
    // Banner buttons stay clickable.
    await page.getByRole("button", { name: "Recusar não essenciais" }).click();
    await expect(banner).toBeHidden();
    await context.close();
  }
});

test("widget is not shown on the checkout page", async ({ browser }) => {
  const { context, page } = await storefront(browser);
  await page.goto("/finalizar-compra");
  await expect(page.locator("main#store-main")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator("[data-assistant-launcher]")).toHaveCount(0);
  await context.close();
});

test("reduced motion and the public endpoint contract", async ({ browser }) => {
  const context = await browser.newContext({ ...labContextOptions(), reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await waitForStore(page);
  await page.locator("[data-assistant-launcher]").click();
  await expect(page.locator("[data-assistant-panel]")).toBeVisible();
  const body = await page.evaluate(async () => {
    const response = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "prazo de entrega" }) });
    return { status: response.status, cache: response.headers.get("cache-control"), json: await response.json() };
  });
  expect(body.status).toBe(200);
  expect(body.cache).toContain("no-store");
  expect(Object.keys(body.json).sort()).toEqual(["answer", "category", "cta", "matched"]);
  const malformed = await page.evaluate(async () => (await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" })).status);
  expect(malformed).toBe(400);
  const crossSite = await context.request.post("/api/assistant", { data: { message: "prazo" }, headers: { origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);
  await context.close();
});

test("disabling the assistant removes it from the store at once; Admin can still test", async ({ browser }) => {
  const page = system.page;
  await page.goto("/admin/assistant");
  await page.getByLabel("Mostrar o Assistente na loja").uncheck();
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Configuração do Assistente salva.")).toBeVisible();
  await expect(page.locator("[data-assistant-status]")).toHaveAttribute("data-assistant-status", "disabled");
  const preview = page.locator("#testar");
  await preview.getByLabel("Pergunta de teste").fill("prazo de entrega");
  await preview.getByRole("button", { name: "Testar" }).click();
  await expect(preview.locator("[data-assistant-preview-outcome]")).toHaveAttribute("data-assistant-preview-outcome", "matched");

  const { context, page: shopper } = await storefront(browser);
  await shopper.goto("/");
  await waitForStore(shopper);
  await expect(shopper.locator("[data-assistant-launcher]")).toHaveCount(0);
  const status = await shopper.evaluate(async () => (await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "prazo" }) })).status);
  expect(status).toBe(404);
  await context.close();

  // Back on for the rate limit check.
  await page.getByLabel("Mostrar o Assistente na loja").check();
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.locator("[data-assistant-status]")).toHaveAttribute("data-assistant-status", "enabled");
});

test("rate limit: 30 questions per minute per address, then 429", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  await page.goto("/sobre");
  const statuses = await page.evaluate(async () => {
    const results: number[] = [];
    for (let index = 0; index < 32; index += 1) {
      results.push((await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: `prazo ${index}` }) })).status);
    }
    return results;
  });
  expect(statuses).toContain(429);
  expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(30);
  await context.close();
});
