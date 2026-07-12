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
const documentedDevelopmentConsoleWarnings = [
  // Next.js emits this advisory only in development when any responsive card
  // becomes the sampled LCP. The first route-level candidate is already eager;
  // making every product image eager would regress network priority and mobile load.
  /Image with src [\s\S]* was detected as the Largest Contentful Paint \(LCP\)[\s\S]*loading="eager"/,
];

export async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((url.protocol === "http:" || url.protocol === "https:") && !expectedHosts.has(url.hostname)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

export function captureUnexpectedBrowserIssues(page: Page) {
  const issues: string[] = [];
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
    if (response.url().startsWith("http://127.0.0.1:3100") && response.status() >= 400) {
      issues.push(`response ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });

  return issues;
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
