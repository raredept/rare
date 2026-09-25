import type { ConsoleMessage, Page, TestInfo } from "@playwright/test";

export const productPath = `/produto/${process.env.PLAYWRIGHT_PRODUCT_SLUG ?? "camiseta-hellstar"}`;

export const publicAuditRoutes = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/categoria/tudo" },
  { name: "product", path: productPath },
  { name: "cart", path: "/finalizar-compra" },
  { name: "login", path: "/entrar" },
  { name: "register", path: "/cadastro" },
  { name: "contact", path: "/contato" },
  { name: "about", path: "/sobre" },
  { name: "returns", path: "/trocas-e-devolucoes" },
  { name: "shipping", path: "/politica-de-envio" },
  { name: "privacy-and-terms", path: "/privacidade-e-termos" },
] as const;

const expectedHosts = new Set(["127.0.0.1", "localhost"]);

// When the suite is pointed at a deployed environment, that host IS the subject
// under test, not a third party. Without this the specs abort their own
// navigation with ERR_BLOCKED_BY_CLIENT and every one of them fails.
function configuredBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://127.0.0.1:3100";
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
const documentedDevelopmentConsoleWarnings = [
  // Next.js emits this advisory only in development when any responsive card
  // becomes the sampled LCP. The first route-level candidate is already eager;
  // making every product image eager would regress network priority and mobile load.
  /Image with src [\s\S]* was detected as the Largest Contentful Paint \(LCP\)[\s\S]*loading="eager"/,
];

export async function blockExternalRequests(page: Page, baseURL = configuredBaseUrl()) {
  const allowedHosts = new Set(expectedHosts);
  const host = hostnameOf(baseURL);
  if (host) allowedHosts.add(host);

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((url.protocol === "http:" || url.protocol === "https:") && !allowedHosts.has(url.hostname)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

export function captureUnexpectedBrowserIssues(page: Page, baseURL = configuredBaseUrl()) {
  const issues: string[] = [];
  const monitoredOrigin = new URL(baseURL).origin;
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (message.type() === "warning" && documentedDevelopmentConsoleWarnings.some((pattern) => pattern.test(message.text()))) {
        return;
      }
      issues.push(`console.${message.type()}: ${message.text()}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.url().startsWith(monitoredOrigin) && response.status() >= 400) {
      issues.push(`response ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });

  return issues;
}

const MANIFEST_401 = "response 401: /manifest.webmanifest";

/**
 * Behind the staging Basic gate, browsers fetch the web manifest without
 * credentials (WebKit always does) and get 401. Production has no gate. Only
 * that is excused, only when the gate is configured, and the URL-less console
 * line only when the manifest is the sole 401.
 */
export function withoutStagingGateNoise(issues: readonly string[]) {
  if (!process.env.STAGING_ACCESS_USERNAME) return [...issues];
  const onlyManifest401 = issues.filter((issue) => issue.startsWith("response 401:")).every((issue) => issue === MANIFEST_401);
  return issues.filter((issue) => issue !== MANIFEST_401 && !(onlyManifest401 && /status of 401 \(\)$/.test(issue)));
}

export function formatAxeViolations(violations: Array<{ id: string; impact?: string | null; nodes: Array<{ target: unknown; failureSummary?: string }> }>) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${JSON.stringify(node.target)}: ${node.failureSummary ?? "sem resumo"}`)
        .join("\n");
      return `${violation.id} (${violation.impact ?? "impacto desconhecido"})\n${nodes}`;
    })
    .join("\n\n");
}

export function isMobileProject(testInfo: TestInfo) {
  return testInfo.project.name === "chromium-mobile";
}

/**
 * Pages fade in (store-page-transition, 180 ms). A contrast check taken mid-fade
 * reads text blended toward the background (#737373 → #747474, 4.54 → 4.47) and
 * fails intermittently although the final colours pass. Wait for the finite
 * entrance animations; infinite ones (loading pulse, carousel) are ignored.
 */
export async function waitForEntranceAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState === "finished" || animation.playState === "idle"),
  );
}

/**
 * Production serves its real media from R2 and Cloudflare injects its own
 * scripts. Blocking those hosts there makes a smoke run report failures it
 * created itself, so specs that measure console health leave them alone.
 */
export function isProductionBaseUrl(baseURL: string | undefined) {
  if (!baseURL) return false;
  const hostname = new URL(baseURL).hostname.toLowerCase();
  return hostname === "raredept.com.br" || hostname === "www.raredept.com.br";
}
