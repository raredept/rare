import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  answerChallenge,
  enrollAdmin,
  expectNoHorizontalOverflow,
  formAlert,
  freshTotp,
  labBaseUrl,
  labContextOptions,
  labEnabled,
  rawFetch,
  recordSensitive,
  requireEnv,
  submitAdminPassword,
  withDatabase,
} from "./lab-helpers";

// Admin MFA and Admin authorization, in a real browser against a production build with
// APP_ENV=staging (scripts/qa-staging-lab.ts). Serial and sharing one browser context: each step
// depends on the account state left by the previous one. The MFA limiter (5 attempts / 5 min per
// account and address, 20 per address) is budgeted per account in the comments below.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
// Each authorization probe visits a dozen pages in a clean browser; the default 30 s is too short.
test.setTimeout(300_000);

const ADMIN_PAGES = ["/admin", "/admin/analytics", "/admin/promotions", "/admin/promotions/new", "/admin/security", "/admin/orders", "/admin/readiness"];
const ADMIN_APIS: Array<{ method: string; path: string }> = [
  { method: "POST", path: "/api/admin/uploads" },
  { method: "POST", path: "/api/admin/uploads/presign" },
  { method: "GET", path: "/api/admin/product-images/editor" },
  { method: "POST", path: "/api/admin/push-subscriptions" },
  { method: "DELETE", path: "/api/admin/push-subscriptions" },
];
// Encodings a naive prefix check could miss. Whatever the proxy does, the page must still refuse.
const EVASIVE_PATHS = ["/%61dmin/promotions", "/admin/%2e%2e/admin/promotions", "/ADMIN/promotions", "/admin//promotions", "/admin/promotions%2F..%2F"];
const ADMIN_CONTENT = /Criar promoção|Nova promoção|Promoções no período|Segurança da conta|Sair/;

type Cookie = { name: string; value: string };

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext(labContextOptions());
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
});

async function sessionCookies(names?: string[]): Promise<Cookie[]> {
  return (await context.cookies()).filter((cookie) => !names || names.includes(cookie.name)).map(({ name, value }) => ({ name, value }));
}

function header(cookies: Cookie[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

/** What a browser holding exactly these cookies gets: login for every page, 401/403 for every API. */
async function expectNoAdminAccess(browser: Browser, playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<never> } }, cookies: Cookie[], label: string) {
  const probe = await browser.newContext(labContextOptions());
  try {
    if (cookies.length) await probe.addCookies(cookies.map((cookie) => ({ ...cookie, url: labBaseUrl() })));
    const tab = await probe.newPage();
    for (const pathname of [...ADMIN_PAGES, ...EVASIVE_PATHS]) {
      await tab.goto(pathname, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      // A revoked-but-well-formed session passes the edge check and is refused by the page, whose
      // loading boundary streams a 200 with the redirect inside: wait for the browser to follow it.
      await tab.waitForURL(/\/admin\/login/, { timeout: 6_000 }).catch(() => undefined);
      const url = new URL(tab.url());
      const body = await tab.locator("body").innerText().catch(() => "");
      const refused = url.pathname === "/admin/login" || /não encontrad|404/i.test(body);
      expect(refused, `${label}: ${pathname} ended on ${url.pathname}`).toBe(true);
      expect(body, `${label}: ${pathname} showed Admin content`).not.toMatch(ADMIN_CONTENT);
    }
  } finally {
    await probe.close();
  }
  for (const api of ADMIN_APIS) {
    const response = await rawFetch(playwright.request, api.path, {
      method: api.method,
      cookie: header(cookies),
      headers: { "content-type": "application/json", origin: new URL(labBaseUrl()).origin },
      data: api.method === "GET" ? undefined : "{}",
    });
    // Routes guarded by requireAdmin() (pre-existing) answer a redirect to the login instead of
    // 401 when the token is well formed but revoked; both refuse, and neither returns data.
    const refused = [401, 403].includes(response.status) || ([302, 303, 307, 308].includes(response.status) && /\/admin\/login/.test(response.headers.location ?? ""));
    expect(refused, `${label}: ${api.method} ${api.path} answered ${response.status} ${response.headers.location ?? ""}`).toBe(true);
    if (response.status !== 401 && response.status !== 403) test.info().annotations.push({ type: "api-redirect-instead-of-401", description: `${label}: ${api.method} ${api.path}` });
  }
}

async function logout() {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sair" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

function secretOnScreen() {
  return page.locator('code[aria-label="Chave secreta para cadastro manual"]').innerText().then((value) => value.replace(/\s/g, ""));
}

const usedA = new Set<number>();
const usedB = new Set<number>();
const usedD = new Set<number>();
let enrollmentA: { secret: string; recoveryCodes: string[]; code: string };

test("anonymous requests reach no Admin page, API or encoded variant", async ({ browser, playwright }) => {
  await expectNoAdminAccess(browser, playwright as never, [], "anonymous");
});

test("a customer session is not an Admin session", async ({ browser, playwright }) => {
  const customer = await browser.newContext(labContextOptions());
  const tab = await customer.newPage();
  await tab.goto("/entrar");
  await tab.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await tab.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await tab.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(tab).not.toHaveURL(/\/entrar/);
  const cookies = (await customer.cookies()).map(({ name, value }) => ({ name, value }));
  expect(cookies.some((cookie) => cookie.name === "rare_customer_session")).toBe(true);
  await customer.close();
  await expectNoAdminAccess(browser, playwright as never, cookies, "customer cookie");
});

test("the password alone yields only a pending credential that opens nothing", async ({ browser, playwright }) => {
  // The attributes as the server sends them (WebKit on Windows reports SameSite=None for every cookie).
  const loginResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/admin/login");
  await submitAdminPassword(page, requireEnv("QA_MFA_A_LOGIN"), requireEnv("QA_MFA_A_PASSWORD"));
  const setCookies = (await (await loginResponse).headersArray()).filter((item) => item.name.toLowerCase() === "set-cookie").map((item) => item.value);
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);
  const pendingHeader = setCookies.find((value) => value.startsWith("rare_admin_mfa_pending="));
  expect(pendingHeader).toMatch(/;\s*HttpOnly/i);
  expect(pendingHeader).toMatch(/;\s*SameSite=Strict/i);
  expect(pendingHeader).toMatch(/;\s*Secure/i);
  expect(pendingHeader).toMatch(/;\s*Path=\/admin/i);
  expect(pendingHeader).toMatch(/;\s*Max-Age=600/i);
  expect(setCookies.some((value) => value.startsWith("rare_admin_session="))).toBe(false);
  const all = await context.cookies();
  const pending = all.find((cookie) => cookie.name === "rare_admin_mfa_pending");
  expect(pending?.httpOnly).toBe(true);
  expect(all.some((cookie) => cookie.name === "rare_admin_session")).toBe(false);
  await expectNoAdminAccess(browser, playwright as never, await sessionCookies(), "pending cookie");
  // The pending token presented as if it were a session cookie is refused as well.
  await expectNoAdminAccess(browser, playwright as never, [{ name: "rare_admin_session", value: pending?.value ?? "" }], "pending token as session");

  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/mfa/setup");
    await expectNoHorizontalOverflow(page, `MFA setup @${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("enrollment: a wrong code is refused, the right one activates and shows recovery codes once", async () => {
  // Limiter budget for A: 1 (wrong) + 2 (right).
  await page.goto("/admin/mfa/setup");
  const secret = await secretOnScreen();
  recordSensitive(secret);
  const current = (await freshTotp(secret, new Set())).code;
  await page.locator('input[name="code"]').fill(current === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  await expect(formAlert(page)).toContainText("Código inválido");
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);

  const { code } = await freshTotp(secret, usedA);
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const list = page.getByRole("list", { name: "Códigos de recuperação" });
  await expect(list).toBeVisible();
  const recoveryCodes = (await list.locator("li").allInnerTexts()).map((value) => value.trim());
  recordSensitive(...recoveryCodes);
  expect(recoveryCodes).toHaveLength(10);
  for (const recovery of recoveryCodes) expect(recovery).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  enrollmentA = { secret, recoveryCodes, code };

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "rare_admin_session")?.httpOnly).toBe(true);
  expect(cookies.some((cookie) => cookie.name === "rare_admin_mfa_pending")).toBe(false);

  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await expect(page.getByRole("button", { name: "Sair" }).first()).toBeAttached();

  await page.goto("/admin/mfa/setup");
  await expect(page.getByText("A verificação em duas etapas já está ativa nesta conta.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Códigos de recuperação" })).toHaveCount(0);

  await withDatabase(async (db) => {
    const login = requireEnv("QA_MFA_A_LOGIN");
    const unused = await db.query(`SELECT COUNT(*)::int AS n FROM "AdminMfaRecoveryCode" r JOIN "User" u ON u.id = r."userId" WHERE u.email = $1 AND r."usedAt" IS NULL`, [login]);
    expect(unused.rows[0].n).toBe(10);
    const stored = await db.query(`SELECT "mfaSecretEncrypted" AS s FROM "User" WHERE email = $1`, [login]);
    expect(stored.rows[0].s).not.toContain(secret);
    const hashes = await db.query(`SELECT r."codeHash" AS h FROM "AdminMfaRecoveryCode" r JOIN "User" u ON u.id = r."userId" WHERE u.email = $1`, [login]);
    for (const row of hashes.rows) for (const recovery of recoveryCodes) expect(row.h).not.toContain(recovery.replace("-", ""));
    const audit = await db.query(`SELECT a.after FROM "AdminAuditLog" a JOIN "User" u ON u.id = a."entityId" WHERE u.email = $1 AND a.action = 'mfa.enrolled'`, [login]);
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0].after)).toContain('"backupCodesIssued":10');
    for (const recovery of recoveryCodes) expect(JSON.stringify(audit.rows[0].after)).not.toContain(recovery);
  });
});

test("the full session reaches the Admin; logout revokes it, including a copied cookie", async ({ browser, playwright }) => {
  const full = await rawFetch(playwright.request, "/admin/promotions", { cookie: header(await sessionCookies()) });
  expect(full.status).toBe(200);
  expect(full.text).toContain("Criar promoção");
  const copied = await sessionCookies(["rare_admin_session"]);
  await logout();
  await expectNoAdminAccess(browser, playwright as never, copied, "session cookie copied before logout");
});

test("challenge: a replayed TOTP is refused, a recovery code works once, then the limiter holds", async () => {
  await submitAdminPassword(page, requireEnv("QA_MFA_A_LOGIN"), requireEnv("QA_MFA_A_PASSWORD"));
  await answerChallenge(page, enrollmentA.code); // A: 3 (same code as the enrollment)
  await expect(formAlert(page)).toContainText(/já foi usado|Código inválido/);
  await expect(page).toHaveURL(/\/admin\/mfa$/);

  await answerChallenge(page, enrollmentA.recoveryCodes[0]); // A: 4
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await logout();

  await submitAdminPassword(page, requireEnv("QA_MFA_A_LOGIN"), requireEnv("QA_MFA_A_PASSWORD"));
  await answerChallenge(page, enrollmentA.recoveryCodes[0]); // A: 5 (reused recovery code)
  await expect(formAlert(page)).toContainText("Código inválido");

  await answerChallenge(page, "123456"); // A: 6, refused before any code is checked
  await expect(formAlert(page)).toContainText("Muitas tentativas");
  const { code } = await freshTotp(enrollmentA.secret, usedA);
  await answerChallenge(page, code); // even a valid code
  await expect(formAlert(page)).toContainText("Muitas tentativas");
  await expect(page).toHaveURL(/\/admin\/mfa$/);

  await withDatabase(async (db) => {
    const { rows } = await db.query(`SELECT active, "mfaEnabledAt" IS NOT NULL AS enrolled FROM "User" WHERE email = $1`, [requireEnv("QA_MFA_A_LOGIN")]);
    expect(rows[0]).toEqual({ active: true, enrolled: true }); // temporary limiter, no account lock
  });

  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/mfa");
    await expectNoHorizontalOverflow(page, `MFA challenge @${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.clearCookies();
});

test("second Admin and the reset runbook: sessions, secret and recovery codes all stop working", async ({ browser, playwright }) => {
  const login = requireEnv("QA_MFA_B_LOGIN");
  const password = requireEnv("QA_MFA_B_PASSWORD");
  const first = await enrollAdmin(page, login, password, usedB); // B: 1
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  const copied = await sessionCookies(["rare_admin_session"]);

  const result = spawnSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "scripts/admin-mfa-reset.ts"], {
    env: {
      ...process.env,
      DATABASE_URL: requireEnv("QA_DATABASE_URL"),
      ADMIN_MFA_RESET_EMAIL: login,
      ADMIN_MFA_RESET_CONFIRM: `RESET-MFA:${login}`,
      ADMIN_MFA_RESET_REASON: "QA lab: runbook rehearsal",
    },
    encoding: "utf8",
    timeout: 90_000,
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('"reset":true');

  await withDatabase(async (db) => {
    const user = await db.query(`SELECT id, "mfaEnabledAt", "mfaSecretEncrypted" FROM "User" WHERE email = $1`, [login]);
    expect(user.rows[0].mfaEnabledAt).toBeNull();
    expect(user.rows[0].mfaSecretEncrypted).toBeNull();
    const codes = await db.query(`SELECT COUNT(*)::int AS n FROM "AdminMfaRecoveryCode" WHERE "userId" = $1`, [user.rows[0].id]);
    expect(codes.rows[0].n).toBe(0);
    const audit = await db.query(`SELECT after FROM "AdminAuditLog" WHERE "entityId" = $1 AND action = 'mfa.reset'`, [user.rows[0].id]);
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0].after)).toContain('"sessionsRevoked":true');
    const bell = await db.query(`SELECT COUNT(*)::int AS n FROM "AdminNotification" WHERE type = 'security_mfa_reset'`);
    expect(bell.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  await expectNoAdminAccess(browser, playwright as never, copied, "session issued before the MFA reset");

  await context.clearCookies();
  await submitAdminPassword(page, login, password);
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/); // enrollment required again
  const newSecret = await secretOnScreen();
  recordSensitive(newSecret);
  expect(newSecret).not.toBe(first.secret);
  await page.locator('input[name="code"]').fill((await freshTotp(first.secret, new Set())).code); // B: 2, old secret
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  await expect(formAlert(page)).toContainText("Código inválido");

  await page.locator('input[name="code"]').fill((await freshTotp(newSecret, usedB)).code); // B: 3
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const list = page.getByRole("list", { name: "Códigos de recuperação" });
  await expect(list).toBeVisible();
  const second = (await list.locator("li").allInnerTexts()).map((value) => value.trim());
  recordSensitive(...second);
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  await logout();

  await submitAdminPassword(page, login, password);
  await answerChallenge(page, first.recoveryCodes[1]); // B: 4, recovery code from before the reset
  await expect(formAlert(page)).toContainText("Código inválido");
  await answerChallenge(page, second[0]); // B: 5
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  await context.clearCookies();
});

test("a hostile next parameter never leaves the store after the second factor", async ({ playwright }) => {
  const login = requireEnv("QA_MFA_D_LOGIN");
  const password = requireEnv("QA_MFA_D_PASSWORD");
  const host = new URL(labBaseUrl()).host;

  await submitAdminPassword(page, login, password, "//evil.example/steal");
  await expect(page).toHaveURL(/\/admin\/mfa\/setup$/);
  const secret = await secretOnScreen();
  recordSensitive(secret);
  await page.locator('input[name="code"]').fill((await freshTotp(secret, usedD)).code); // D: 1
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const continueLink = page.getByRole("link", { name: "Já guardei, continuar" });
  await expect(continueLink).toBeVisible();
  const codes = (await page.getByRole("list", { name: "Códigos de recuperação" }).locator("li").allInnerTexts()).map((value) => value.trim());
  recordSensitive(...codes);
  expect(await continueLink.getAttribute("href")).toMatch(/^\/admin(\/|$|\?)/);

  const hostile = ["https://evil.example/admin", "/%2F%2Fevil.example", "/\\evil.example", "/admin/../../evil.example"];
  for (const [index, next] of hostile.entries()) {
    await context.clearCookies();
    await submitAdminPassword(page, login, password, next);
    await answerChallenge(page, codes[index]); // D: 2..5
    await page.waitForLoadState("domcontentloaded");
    const landed = new URL(page.url());
    expect(landed.host, `next=${next} landed on ${page.url()}`).toBe(host);
    expect(landed.pathname.startsWith("/admin"), `next=${next} landed on ${landed.pathname}`).toBe(true);
  }

  // A forged forwarded host must not leak into the login redirect.
  const redirect = await rawFetch(playwright.request, "/admin/promotions", { headers: { "x-forwarded-host": "evil.example", host: "evil.example" } });
  expect(redirect.headers.location ?? "").not.toContain("evil.example");
  await context.clearCookies();
});
