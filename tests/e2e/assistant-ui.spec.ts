import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { attachDiagnostics, expectNoHorizontalOverflow, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-ASSISTANT-UIUX-02: the storefront assistant's interface (launcher, panel, motion states,
// typing, long texts, support link, phone widths, cookie banner and PDP buy bar), on the production
// build in the lab (run with --https). The assistant is configured straight in the disposable
// database (no Admin login), and the endpoint is stubbed with page.route only where a state can not
// be produced on demand (slow answer, network error, very long answer). Logic is covered by
// assistant.spec.ts; this spec checks presentation and interaction and writes the visual evidence.
//
// QA_ASSISTANT_UI_PHASE=before captures the evidence only (the old interface has none of the new
// states), so the same file produces the BEFORE and AFTER screenshots. The lab database is WIN1252:
// seeded texts stay inside it (no arrows or emoji).

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1) with --https.");
test.setTimeout(600_000);

const phase = process.env.QA_ASSISTANT_UI_PHASE === "before" ? "before" : "after";
const afterOnly = phase === "before";
const shotsRoot = path.join(process.cwd(), "output", "assistant-uiux-02");

/** BEFORE goes to before/, AFTER to after-<browser project>/ (one set per engine). */
function shotsDir() {
  const dir = path.join(shotsRoot, phase === "before" ? "before" : `after-${test.info().project.name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const DISPLAY_NAME = "Assistente RARE";
const ENTRIES = [
  { question: "Qual o prazo de entrega?", answer: "O prazo aparece no checkout assim que você informa o CEP. Pedidos pagos até as 14h saem no mesmo dia útil.", keywords: ["entrega", "prazo", "frete", "chegar", "demora", "envio"], priority: 5 },
  { question: "Quais formas de pagamento?", answer: "Pix e cartão de crédito, com parcelamento quando disponível.", keywords: ["pagamento", "pix", "cartao", "parcelar"], priority: 4 },
  { question: "Como acompanho meu pedido?", answer: "Entre em Minha conta > Pedidos. O código de rastreio aparece assim que o pedido é enviado.", keywords: ["acompanhar", "rastreio", "pedido", "rastrear"], priority: 3 },
  { question: "Como faço uma troca?", answer: "Abra uma solicitação em Suporte em até 7 dias após o recebimento.", keywords: ["troca", "trocar", "devolucao", "tamanho"], priority: 2 },
];
const LONG_ANSWER = [
  "Resposta longa de teste com vários parágrafos para conferir a quebra de linha e a rolagem do histórico.",
  "Segundo parágrafo: https://www.exemplo-de-endereco-muito-longo.com.br/caminho/sem/espacos/que/precisa/quebrar/dentro/da/bolha?utm_source=teste&utm_medium=assistente",
  "Terceiro parágrafo com umapalavraenormesemespaconenhumquenaopodeestourarolarguradopaineldoassistentevirtualdarare.",
  "Último parágrafo. " + "Texto corrido para completar o tamanho da resposta. ".repeat(40),
].join("\n\n").slice(0, 2000);
const LONG_QUESTION = ("Pergunta longa de teste " + "com bastante texto para verificar a quebra ".repeat(14)).slice(0, 500);

async function seedAssistant() {
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "VirtualAssistantEntry"`);
    await db.query(`DELETE FROM "VirtualAssistantConfig"`);
    await db.query(
      `INSERT INTO "VirtualAssistantConfig" (id, enabled, "displayName", "welcomeMessage", "inputPlaceholder", "fallbackMessage", "supportCtaLabel", "supportCtaHref", "updatedAt")
       VALUES ('store', true, $1, $2, $3, $4, 'Falar com a equipe', '/suporte', now())`,
      [
        DISPLAY_NAME,
        "Oi! Posso ajudar com dúvidas sobre pedidos, entrega, pagamento e trocas.",
        "Digite sua dúvida",
        "Não encontrei uma resposta exata para isso. Você pode falar com a nossa equipe pelo suporte.",
      ],
    );
    for (const [index, entry] of ENTRIES.entries()) {
      await db.query(
        `INSERT INTO "VirtualAssistantEntry" (id, question, answer, keywords, active, priority, "sortOrder", "updatedAt") VALUES ($1, $2, $3, $4, true, $5, $6, now())`,
        [`qa_uiux02_${index}`, entry.question, entry.answer, entry.keywords, entry.priority, index],
      );
    }
  });
}

async function storefront(browser: Browser, options: { width?: number; height?: number; cookieConsent?: "refused" | "undecided"; reducedMotion?: "reduce" | "no-preference" } = {}) {
  const context = await browser.newContext({
    ...labContextOptions({ cookieConsent: options.cookieConsent }),
    viewport: { width: options.width ?? 1440, height: options.height ?? 900 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  attachDiagnostics(page);
  return { context, page };
}

async function waitForStore(page: Page) {
  await expect(page.locator("main#store-main h1, main#store-main h2").first()).toBeVisible({ timeout: 20_000 });
}

/** The widget props come from a 15 s cache in the layout: reload until the launcher shows. */
async function gotoWithLauncher(page: Page, route: string) {
  await expect.poll(async () => {
    await page.goto(route);
    await waitForStore(page);
    return page.locator("[data-assistant-launcher]").count();
  }, { timeout: 40_000, intervals: [0, 5_000, 5_000, 5_000, 5_000, 5_000, 5_000] }).toBe(1);
}

async function openPanel(page: Page) {
  await page.locator("[data-assistant-launcher]").click();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Sua pergunta")).toBeFocused();
  // Let the opening motion finish before measuring or capturing.
  await page.waitForTimeout(400);
  return panel;
}

async function ask(page: Page, text: string) {
  const answers = page.locator('[data-assistant-message="assistant"]');
  const before = await answers.count();
  await page.getByLabel("Sua pergunta").fill(text);
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(answers).toHaveCount(before + 1, { timeout: 15_000 });
  return answers.nth(before);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shotsDir(), `${name}.png`) });
}

/** Horizontal overflow inside the panel (a long URL or word must wrap, never widen the bubble). */
async function expectPanelContained(page: Page, label: string) {
  const overflow = await page.locator("[data-assistant-panel]").evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    const log = panel.querySelector('[role="log"]') as HTMLElement | null;
    const escaped = [...panel.querySelectorAll<HTMLElement>("[data-assistant-message], [data-assistant-message] *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.right > box.right + 0.5 || rect.left < box.left - 0.5);
      }).length;
    return { escaped, logOverflowX: log ? log.scrollWidth - log.clientWidth : 0 };
  });
  // BEFORE: recorded (soft) so the evidence run keeps capturing; AFTER: a hard failure.
  const check = afterOnly ? expect.soft : expect;
  check(overflow.escaped, `${label}: content outside the panel`).toBe(0);
  check(overflow.logOverflowX, `${label}: horizontal scroll in the conversation`).toBeLessThanOrEqual(1);
}

test.beforeAll(async () => {
  await seedAssistant();
});

test.afterAll(async () => {
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "VirtualAssistantEntry"`);
    await db.query(`DELETE FROM "VirtualAssistantConfig"`);
  });
});

test("evidence: desktop and phone, closed, open, conversation and fallback", async ({ browser }) => {
  for (const width of [1440, 390, 320]) {
    const { context, page } = await storefront(browser, { width, height: width > 500 ? 900 : 844 });
    await gotoWithLauncher(page, "/");
    await page.waitForTimeout(600);
    await shot(page, `closed-${width}`);
    if (width === 1440) {
      await page.locator("[data-assistant-launcher]").hover();
      await shot(page, `launcher-hover-${width}`);
    }
    await openPanel(page);
    await shot(page, `open-${width}`);
    await page.getByRole("dialog", { name: DISPLAY_NAME }).getByRole("button", { name: "Qual o prazo de entrega?" }).click();
    await expect(page.locator('[data-assistant-message="assistant"]').last()).toContainText("O prazo aparece no checkout");
    await ask(page, "dá pra parcelar no cartão?");
    await shot(page, `conversation-${width}`);
    const fallback = await ask(page, "vocês vendem ingressos de cinema?");
    await expect(fallback).toContainText("Não encontrei uma resposta exata");
    await expect(fallback.getByRole("link", { name: "Falar com a equipe" })).toHaveAttribute("href", "/suporte");
    await shot(page, `fallback-${width}`);
    await expectPanelContained(page, `conversation @${width}`);
    await context.close();
  }
});

test("evidence: cookie banner and PDP buy bar on phones", async ({ browser }) => {
  const slug = requireEnv("QA_BF_PRODUCT_SLUG");
  for (const width of [320, 390, 1440]) {
    const { context, page } = await storefront(browser, { width, height: width > 500 ? 900 : 844, cookieConsent: "undecided" });
    await gotoWithLauncher(page, "/");
    await expect(page.locator("[data-cookie-banner]")).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, `cookie-banner-closed-${width}`);
    if (!afterOnly) {
      // Every frame of the opening motion stays above the banner (sampled inside the page: one driver call).
      const lowest = await page.evaluate(() => new Promise<number>((resolve) => {
        const banner = document.querySelector("[data-cookie-banner]")!.getBoundingClientRect().top;
        let worst = -Infinity;
        let firstSeen = 0;
        const started = performance.now();
        document.querySelector<HTMLButtonElement>("[data-assistant-launcher]")!.click();
        // The loading frame and then the panel (its chunk may still be loading): both are measured,
        // until 600 ms after the panel itself shows up.
        const sample = () => {
          const now = performance.now();
          const frame = document.querySelector("[data-assistant-panel], [data-assistant-root] [role='status']");
          if (frame && frame.getClientRects().length) worst = Math.max(worst, frame.getBoundingClientRect().bottom - banner);
          if (!firstSeen && document.querySelector("[data-assistant-panel]")?.getClientRects().length) firstSeen = now;
          if ((firstSeen && now - firstSeen > 600) || now - started > 8_000) resolve(firstSeen ? worst : Infinity);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }));
      expect(lowest, `panel never dips over the banner while opening @${width}`).toBeLessThanOrEqual(0.5);
    } else {
      await page.locator("[data-assistant-launcher]").click();
    }
    await expect(page.locator("[data-assistant-panel]")).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, `cookie-banner-open-${width}`);
    const [panelBox, bannerBox] = [(await page.locator("[data-assistant-panel]").boundingBox())!, (await page.locator("[data-cookie-banner]").boundingBox())!];
    expect(panelBox.y + panelBox.height, `panel above banner @${width}`).toBeLessThanOrEqual(bannerBox.y + 0.5);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-assistant-panel]")).toBeHidden();
    await context.close();
  }
  for (const width of [320, 390]) {
    const { context, page } = await storefront(browser, { width, height: 844 });
    await gotoWithLauncher(page, `/produto/${slug}`);
    const bar = page.locator('[data-testid="pdp-buy-bar"]');
    await expect(bar).toBeVisible();
    await page.waitForTimeout(600);
    const [launcherBox, barBox] = [(await page.locator("[data-assistant-launcher]").boundingBox())!, (await bar.boundingBox())!];
    expect(launcherBox.y + launcherBox.height, `launcher above the buy bar @${width}`).toBeLessThanOrEqual(barBox.y + 0.5);
    await shot(page, `pdp-buy-bar-closed-${width}`);
    await openPanel(page);
    const panelBox = (await page.locator("[data-assistant-panel]").boundingBox())!;
    expect(panelBox.y + panelBox.height, `panel above the buy bar @${width}`).toBeLessThanOrEqual(barBox.y + 0.5);
    await shot(page, `pdp-buy-bar-open-${width}`);
    await context.close();
  }
});

test("evidence: typing, network error, long answer and long question at 320 px", async ({ browser }) => {
  const { context, page } = await storefront(browser, { width: 320, height: 640 });
  await gotoWithLauncher(page, "/");
  await openPanel(page);

  // Slow answer: the typing state shows while waiting, the send button is disabled.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/assistant", async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matched: true, answer: LONG_ANSWER, category: null, cta: null }) });
  });
  await page.getByLabel("Sua pergunta").fill(LONG_QUESTION);
  await page.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(page.locator('[data-assistant-message="user"]').last()).toContainText("Pergunta longa de teste");
  if (!afterOnly) {
    await expect(page.locator("[data-assistant-typing]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar pergunta" })).toBeDisabled();
  }
  await shot(page, "typing-320");
  release();
  await expect(page.locator('[data-assistant-message="assistant"]').last()).toContainText("umapalavraenorme");
  if (!afterOnly) await expect(page.locator("[data-assistant-typing]")).toHaveCount(0);
  await expectPanelContained(page, "long answer @320");
  if (!afterOnly) await expectNoHorizontalOverflow(page, "long answer @320");
  await shot(page, "long-answer-320");

  await page.unroute("**/api/assistant");
  await page.route("**/api/assistant", (route) => route.abort("failed"));
  const failed = await ask(page, "prazo");
  await expect(failed).toContainText("Verifique sua conexão");
  await shot(page, "network-error-320");
  await context.close();
});

test("launcher: opens, closes with the close button and Escape, and gives focus back", async ({ browser }) => {
  test.skip(afterOnly, "New interface only.");
  const { context, page } = await storefront(browser);
  await gotoWithLauncher(page, "/");
  const launcher = page.getByRole("button", { name: `Abrir ${DISPLAY_NAME}` });
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(launcher).toHaveAttribute("aria-haspopup", "dialog");

  await launcher.click();
  const dialog = page.getByRole("dialog", { name: DISPLAY_NAME });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await expect(page.getByLabel("Sua pergunta")).toBeFocused();

  // Close button: the panel plays its exit, becomes inert at once, then hidden; focus goes back.
  await dialog.getByRole("button", { name: `Fechar ${DISPLAY_NAME}` }).click();
  await expect(page.locator("[data-assistant-panel]")).toBeHidden();
  await expect(page.locator("[data-assistant-panel]")).toHaveAttribute("data-state", "closed");
  await expect(launcher).toBeFocused();

  // Keyboard: Enter opens, Escape closes.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Sua pergunta")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();
  await context.close();
});

test("panel motion state: closing is inert and short; reduced motion has no movement", async ({ browser }) => {
  test.skip(afterOnly, "New interface only.");
  const { context, page } = await storefront(browser);
  await gotoWithLauncher(page, "/");
  await page.locator("[data-assistant-launcher]").click();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toHaveAttribute("data-state", "open");
  // Read the closing frame inside the page (one driver call: no race with the exit timer).
  const closing = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>("[data-assistant-panel]")!;
    const button = element.querySelector<HTMLButtonElement>('button[aria-label^="Fechar"]')!;
    return new Promise<{ state: string | null; inert: boolean; hidden: boolean }>((resolve) => {
      button.click();
      requestAnimationFrame(() => resolve({ state: element.getAttribute("data-state"), inert: element.inert, hidden: element.hidden }));
    });
  });
  expect(closing).toEqual({ state: "closing", inert: true, hidden: false });
  await expect(panel).toBeHidden({ timeout: 2_000 });
  await context.close();

  const reduced = await storefront(browser, { reducedMotion: "reduce" });
  await gotoWithLauncher(reduced.page, "/");
  await reduced.page.locator("[data-assistant-launcher]").click();
  await expect(reduced.page.locator("[data-assistant-panel]")).toBeVisible();
  const motion = await reduced.page.locator("[data-assistant-panel]").evaluate((element) => {
    const style = getComputedStyle(element);
    return { animation: style.animationName, transform: style.transform };
  });
  expect(motion.transform === "none" || motion.transform === "matrix(1, 0, 0, 1, 0, 0)", `reduced motion transform ${motion.transform}`).toBe(true);
  expect(motion.animation).not.toMatch(/assistant-panel-in$/);
  await reduced.context.close();
});

test("suggestions, send disabled state, author labels and support link", async ({ browser }) => {
  test.skip(afterOnly, "New interface only.");
  const { context, page } = await storefront(browser, { width: 390, height: 844 });
  await gotoWithLauncher(page, "/");
  const dialog = page.getByRole("dialog", { name: DISPLAY_NAME });
  await openPanel(page);
  const send = dialog.getByRole("button", { name: "Enviar pergunta" });
  await expect(send).toBeDisabled();
  await page.getByLabel("Sua pergunta").fill("   ");
  await expect(send).toBeDisabled();
  await page.getByLabel("Sua pergunta").fill("prazo");
  await expect(send).toBeEnabled();
  await page.getByLabel("Sua pergunta").fill("");

  // Every suggestion is a full-width button named exactly by its question (decorations are hidden).
  for (const entry of ENTRIES) await expect(dialog.getByRole("button", { name: entry.question, exact: true })).toBeVisible();
  const first = (await dialog.getByRole("button", { name: ENTRIES[0].question, exact: true }).boundingBox())!;
  expect(first.height).toBeGreaterThanOrEqual(44);
  await dialog.getByRole("button", { name: ENTRIES[1].question, exact: true }).click();
  await expect(dialog.locator('[data-assistant-message="user"]')).toHaveText(/Quais formas de pagamento\?/);
  await expect(dialog.locator('[data-assistant-message="assistant"]').last()).toContainText("Pix e cartão");
  // Suggestions leave once the conversation starts.
  await expect(dialog.getByText("Perguntas frequentes")).toHaveCount(0);

  const fallback = await ask(page, "vocês vendem ingressos de cinema?");
  const link = fallback.getByRole("link", { name: "Falar com a equipe" });
  await expect(link).toHaveAttribute("href", "/suporte");
  const linkBox = (await link.boundingBox())!;
  expect(linkBox.height).toBeGreaterThanOrEqual(44);
  await expectPanelContained(page, "fallback @390");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include("[data-assistant-panel]").analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  await context.close();
});

test("phones 320–430: panel inside the viewport and safe offsets, input reachable", async ({ browser }) => {
  test.skip(afterOnly, "New interface only.");
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440]) {
    for (const height of width < 768 ? [568, 844] : [900]) {
      const { context, page } = await storefront(browser, { width, height });
      await gotoWithLauncher(page, "/");
      const launcher = (await page.locator("[data-assistant-launcher]").boundingBox())!;
      expect(launcher.x + launcher.width, `launcher right @${width}x${height}`).toBeLessThanOrEqual(width - 8);
      expect(launcher.y + launcher.height, `launcher bottom @${width}x${height}`).toBeLessThanOrEqual(height - 8);
      const panel = await openPanel(page);
      const box = (await panel.boundingBox())!;
      expect(box.x, `panel left @${width}x${height}`).toBeGreaterThanOrEqual(4);
      expect(box.x + box.width, `panel right @${width}x${height}`).toBeLessThanOrEqual(width - 4);
      expect(box.y, `panel top @${width}x${height}`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `panel bottom @${width}x${height}`).toBeLessThanOrEqual(height - 4);
      if (width < 640) expect(box.width, `phone panel uses the width @${width}`).toBeGreaterThanOrEqual(width - 24);
      else expect(box.width, `desktop panel width @${width}`).toBeGreaterThanOrEqual(380);
      await expect(page.getByLabel("Sua pergunta")).toBeInViewport();
      await expectNoHorizontalOverflow(page, `open @${width}x${height}`);
      await context.close();
    }
  }
});
