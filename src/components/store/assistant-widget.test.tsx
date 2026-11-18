import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { AssistantPanel } from "@/components/store/assistant-panel";
import { ASSISTANT_BOTTOM_OBSTACLES, isAssistantHiddenOnPath } from "@/components/store/assistant-launcher";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
/** Code only: comments may name what the code must not do. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const launcherSource = read("src/components/store/assistant-launcher.tsx");
const panelSource = read("src/components/store/assistant-panel.tsx");
const chromeSource = read("src/components/store/store-chrome.tsx");
const css = read("src/app/globals.css");

const hostile = {
  displayName: "<img src=x onerror=alert(1)>",
  welcomeMessage: "<script>alert(1)</script>\nSegunda linha",
  inputPlaceholder: "javascript:alert(1)",
  suggestions: ["<b>negrito</b>?", "Qual o prazo de entrega?"],
};

describe("assistant panel rendering", () => {
  const html = renderToStaticMarkup(<AssistantPanel id="panel" open bootstrap={hostile} onClose={() => undefined} />);

  it("renders every Admin-provided text as text, never as markup", () => {
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>negrito");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;negrito&lt;/b&gt;?");
  });

  it("is a labelled, non-modal dialog with a live conversation log and labelled controls", () => {
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="false"/);
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/role="log"[^>]*aria-live="polite"/);
    expect(html).toContain('aria-label="Enviar pergunta"');
    expect(html).toContain("Sua pergunta");
    expect(html).toContain(`aria-label="Fechar ${"&lt;img src=x onerror=alert(1)&gt;"}"`);
  });

  it("shows the suggested questions that came from the database", () => {
    expect(html).toContain("Perguntas frequentes");
    expect(html).toContain("Qual o prazo de entrega?");
  });

  it("is hidden (not just transparent) while closed", () => {
    const closed = renderToStaticMarkup(<AssistantPanel id="panel" open={false} bootstrap={hostile} onClose={() => undefined} />);
    expect(closed).toMatch(/<section[^>]*hidden=""/);
    expect(css).toMatch(/\.assistant-panel\[hidden\]\s*\{\s*display:\s*none !important;/);
  });
});

describe("assistant privacy and footprint", () => {
  it("never uses HTML injection, browser storage, cookies or analytics", () => {
    for (const source of [code(launcherSource), code(panelSource)]) {
      expect(source).not.toContain("dangerouslySetInnerHTML");
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|storeConsent/);
      expect(source).not.toMatch(/site-analytics|trackSiteEvent|sendBeacon|gtag|dataLayer/);
    }
  });

  it("does not touch the consent store at all", () => {
    expect(code(launcherSource)).not.toMatch(/cookie-consent/);
  });

  it("loads the conversation panel lazily (separate chunk, only after a hover, focus or tap)", () => {
    expect(launcherSource).toMatch(/lazy\(\(\) => import\("@\/components\/store\/assistant-panel"\)/);
    expect(launcherSource).toMatch(/\{requested \? \(\s*<Suspense fallback=\{open \? <PanelLoading/);
    expect(launcherSource).not.toMatch(/^import \{ AssistantPanel \}/m);
  });

  it("does not ship zod or the server store to the browser", () => {
    expect(panelSource).not.toMatch(/from "zod"|@\/lib\/assistant\/config"|@\/lib\/prisma/);
    expect(launcherSource).not.toMatch(/from "zod"|@\/lib\/assistant\/config"|@\/lib\/prisma/);
    expect(panelSource).toMatch(/import type \{ PublicAssistantBootstrap \}/);
    expect(launcherSource).toMatch(/import type \{ PublicAssistantBootstrap \}/);
  });

  it("is mounted by the store frame only when the bootstrap exists (disabled or failing → nothing)", () => {
    expect(chromeSource).toContain("{assistant ? <AssistantLauncher bootstrap={assistant} /> : null}");
    expect(chromeSource).toContain("getPublicAssistantBootstrap()");
  });
});

describe("assistant placement", () => {
  it("stays out of the checkout and order payment pages", () => {
    for (const hidden of ["/finalizar-compra", "/finalizar-compra/x", "/pedido/sucesso", "/pedido/pix/abc"]) expect(isAssistantHiddenOnPath(hidden)).toBe(true);
    for (const shown of ["/", "/produto/camiseta", "/categoria/tudo", "/cart", "/pedidos", "/suporte", null]) expect(isAssistantHiddenOnPath(shown)).toBe(false);
  });

  it("respects the iPhone safe area and sits above the cookie banner, under modal overlays", () => {
    expect(css).toMatch(/\.assistant-launcher \{[^}]*env\(safe-area-inset-right\)[^}]*env\(safe-area-inset-bottom\)\) \+ var\(--assistant-offset, 0px\)/);
    expect(ASSISTANT_BOTTOM_OBSTACLES).toEqual(["[data-cookie-banner]", '[data-testid="pdp-buy-bar"]']);
    expect(read("src/components/store/cookie-consent.tsx")).toContain("data-cookie-banner");
    expect(read("src/components/store/product-detail-client.tsx")).toContain('data-testid="pdp-buy-bar"');
    expect(launcherSource).toMatch(/fixed z-30/);
    expect(panelSource).toMatch(/fixed z-\[60\]/);
  });

  it("keeps touch targets at least 44px", () => {
    expect(launcherSource).toMatch(/min-h-12 min-w-12/);
    expect(panelSource).toMatch(/h-11 w-11/);
    expect(panelSource).toMatch(/h-12 w-12/);
  });

  it("closes on Escape and gives focus back to the launcher", () => {
    expect(panelSource).toMatch(/event\.key !== "Escape"[\s\S]{0,300}onClose\(\)/);
    expect(panelSource).toContain('document.addEventListener("keydown", onKeyDown)');
    expect(launcherSource).toMatch(/launcherRef\.current\?\.focus\(\)/);
    expect(panelSource).toMatch(/if \(open\) inputRef\.current\?\.focus/);
  });
});
