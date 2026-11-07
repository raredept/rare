import { appendFileSync } from "node:fs";
import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";
import { base32Decode, hotp, totpStep } from "../../src/lib/totp";

// Shared helpers for the BF/MFA/Asaas homologation specs (scripts/qa-staging-lab.ts runs them
// against a production build with APP_ENV=staging on a disposable database). Every spec that uses
// them is opt-in through QA_LAB_ENABLED, so `npm run test:e2e` is unaffected.

export const labEnabled = process.env.QA_LAB_ENABLED === "1";

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the lab specs.`);
  return value;
}

/**
 * Values that must never reach a server log (TOTP secrets, recovery codes, passwords). The runner
 * greps the server output for each of them after the run and deletes this file.
 */
export function recordSensitive(...values: string[]) {
  const file = process.env.QA_LAB_SENSITIVE_FILE;
  if (!file) return;
  appendFileSync(file, values.filter(Boolean).map((value) => `${value}\n`).join(""));
}

export function totpFor(secret: string, step = totpStep(Date.now())) {
  return hotp(base32Decode(secret), step);
}

/** A code from a 30-second window that has not been used yet (waits for the next window if needed). */
export async function freshTotp(secret: string, usedSteps: Set<number>) {
  let step = totpStep(Date.now());
  while (usedSteps.has(step)) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    step = totpStep(Date.now());
  }
  usedSteps.add(step);
  return { code: totpFor(secret, step), step };
}

export async function submitAdminPassword(page: Page, login: string, password: string, next?: string) {
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  await page.locator('input[name="email"]').fill(login);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

/** Password step + enrollment through the real UI. Returns the secret and the one-time recovery codes. */
export async function enrollAdmin(page: Page, login: string, password: string, usedSteps: Set<number>) {
  await submitAdminPassword(page, login, password);
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);
  const secret = (await page.locator('code[aria-label="Chave secreta para cadastro manual"]').innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  const { code } = await freshTotp(secret, usedSteps);
  recordSensitive(secret);
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const list = page.getByRole("list", { name: "Códigos de recuperação" });
  await expect(list).toBeVisible();
  const recoveryCodes = (await list.locator("li").allInnerTexts()).map((value) => value.trim());
  recordSensitive(...recoveryCodes);
  return { secret, recoveryCodes };
}

/** Form error messages (role=alert), not Next's empty route announcer, which is also an alert. */
export function formAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

export async function answerChallenge(page: Page, code: string) {
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "Verificar" }).click();
}

export async function cookieHeader(context: BrowserContext, names?: string[]) {
  const cookies = await context.cookies();
  return cookies.filter((cookie) => !names || names.includes(cookie.name)).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export function labBaseUrl() {
  return requireEnv("PLAYWRIGHT_BASE_URL");
}

/** Options for contexts created by hand (shared across serial tests): same base URL and gate as the config. */
export function labContextOptions() {
  return {
    baseURL: labBaseUrl(),
    // The lab's TLS proxy (WebKit runs) uses a throwaway self-signed certificate.
    ignoreHTTPSErrors: labBaseUrl().startsWith("https://localhost"),
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1440, height: 1000 },
    ...(process.env.STAGING_ACCESS_USERNAME
      ? {
          httpCredentials: { username: process.env.STAGING_ACCESS_USERNAME, password: process.env.STAGING_ACCESS_PASSWORD ?? "" },
          // Sent up front: WebKit on Windows cannot resend a POST body after the gate's 401
          // challenge ("rewinding of the data stream failed"), so every form post failed there.
          extraHTTPHeaders: { authorization: `Basic ${Buffer.from(`${process.env.STAGING_ACCESS_USERNAME}:${process.env.STAGING_ACCESS_PASSWORD ?? ""}`).toString("base64")}` },
        }
      : {}),
  };
}

/**
 * A request with exactly the cookies given and nothing else: a fresh request context per call, so no
 * cookie jar (the browser's or a previous response's) can leak into the check. No redirect is followed.
 */
export async function rawFetch(
  factory: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> },
  pathname: string,
  init: { method?: string; cookie?: string; headers?: Record<string, string>; data?: string | Buffer } = {},
) {
  const { baseURL, httpCredentials, ignoreHTTPSErrors } = labContextOptions() as { baseURL: string; ignoreHTTPSErrors: boolean; httpCredentials?: { username: string; password: string } };
  const api = await factory.newContext({ baseURL, ignoreHTTPSErrors, ...(httpCredentials ? { httpCredentials: { ...httpCredentials, send: "always" } } : {}) });
  try {
    const response = await api.fetch(pathname, {
      method: init.method ?? "GET",
      headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers ?? {}) },
      data: init.data,
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    return { status: response.status(), headers: response.headers(), text: await response.text() };
  } finally {
    await api.dispose();
  }
}

export function isRedirectToLogin(response: { status: number; headers: Record<string, string> }) {
  const location = response.headers.location ?? "";
  return [302, 303, 307, 308].includes(response.status) && /\/admin\/login/.test(location);
}

export async function withDatabase<T>(work: (client: pg.Client) => Promise<T>) {
  const client = new pg.Client({ connectionString: requireEnv("QA_DATABASE_URL") });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Value for a datetime-local input, in São Paulo time (the form's business clock), `offsetMs` from now. */
export function businessInputValue(offsetMs: number) {
  const date = new Date(Date.now() + offsetMs - 3 * 60 * 60_000);
  return date.toISOString().slice(0, 16);
}

/** QA_LAB_DEBUG=1: print page errors, console errors and failed requests (never bodies or cookies). */
export function attachDiagnostics(page: Page) {
  if (process.env.QA_LAB_DEBUG !== "1") return;
  page.on("pageerror", (error) => console.log(`PAGEERROR ${error.message.slice(0, 300)}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`CONSOLE ${message.text().slice(0, 300)}`);
  });
  page.on("requestfailed", (request) => console.log(`REQFAILED ${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ""}`));
  page.on("response", (response) => {
    if (response.status() >= 400) console.log(`HTTP ${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
  });
}

export async function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => dialog.accept().catch(() => undefined));
}

/** No horizontal overflow at this width (1px of subpixel tolerance). */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.scroll, `${label}: scrollWidth ${overflow.scroll} > clientWidth ${overflow.client}`).toBeLessThanOrEqual(overflow.client + 1);
}
