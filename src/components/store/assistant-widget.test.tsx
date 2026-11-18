import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { AssistantPanel } from "@/components/store/assistant-panel";
import { ASSISTANT_BOTTOM_OBSTACLES, isAssistantHiddenOnPath } from "@/components/store/assistant-launcher";
import { firstOfEachRole, splitWelcomeMessage } from "@/components/store/assistant/welcome";

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
    // Close and send are 44 px circles; the field is 48 px tall; suggestion rows 52 px; the support link 44 px.
    expect(panelSource.match(/h-11 w-11/g)).toHaveLength(2);
    expect(panelSource).toMatch(/className="h-12 min-w-0 flex-1/);
    expect(css).toMatch(/\.assistant-suggestion \{[^}]*min-height: 3\.25rem;/);
    expect(css).toMatch(/\.assistant-cta \{[^}]*min-height: 2\.75rem;/);
  });

  it("closes on Escape and gives focus back to the launcher", () => {
    expect(panelSource).toMatch(/event\.key !== "Escape"[\s\S]{0,300}onClose\(\)/);
    expect(panelSource).toContain('document.addEventListener("keydown", onKeyDown)');
    expect(launcherSource).toMatch(/launcherRef\.current\?\.focus\(\)/);
    expect(panelSource).toMatch(/if \(open\) inputRef\.current\?\.focus/);
  });

  it("keeps the panel inside the phone viewport: safe areas on both sides, dvh with a vh fallback", () => {
    const panelRule = css.match(/\n\.assistant-panel \{[^}]*\}/)?.[0] ?? "";
    expect(panelRule).toContain("env(safe-area-inset-left)");
    expect(panelRule).toContain("env(safe-area-inset-right)");
    expect(panelRule).toMatch(/env\(safe-area-inset-bottom\)\) \+ var\(--assistant-offset, 0px\)/);
    expect(panelRule).toMatch(/max-height: calc\(100vh[^;]*;\s*max-height: min\(40rem, calc\(100dvh/);
    expect(css).toMatch(/\[data-assistant-root\] \{[^}]*--assistant-top-room: max\(0\.75rem, env\(safe-area-inset-top\)\)/);
  });
});

describe("assistant panel presentation (RARE-ASSISTANT-UIUX-02)", () => {
  const bootstrap = {
    displayName: "Assistente RARE",
    welcomeMessage: "Oi! Posso ajudar com dúvidas sobre pedidos, entrega, pagamento e trocas.",
    inputPlaceholder: "Digite sua dúvida",
    suggestions: ["Qual o prazo de entrega?", "Quais formas de pagamento?"],
  };
  const open = renderToStaticMarkup(<AssistantPanel id="panel" open bootstrap={bootstrap} onClose={() => undefined} />);

  it("exposes its motion state: open while open, closed (and hidden) while closed, never inert when open", () => {
    expect(open).toMatch(/<section[^>]*data-state="open"/);
    expect(open).not.toMatch(/<section[^>]*\sinert/);
    expect(open).not.toMatch(/<section[^>]*\shidden=/);
    const closed = renderToStaticMarkup(<AssistantPanel id="panel" open={false} bootstrap={bootstrap} onClose={() => undefined} />);
    expect(closed).toMatch(/<section[^>]*data-state="closed"/);
    // The exit keeps the dialog on screen only as an inert, non-clickable layer for a short motion.
    expect(panelSource).toMatch(/inert=\{state === "closing"\}/);
    expect(panelSource).toMatch(/hidden=\{state === "closed"\}/);
    expect(panelSource).toMatch(/const PANEL_EXIT_MS = 180;/);
    expect(css).toMatch(/\.assistant-panel\[data-state="closing"\] \{\s*pointer-events: none;\s*animation: assistant-panel-out 160ms/);
  });

  it("sets the Admin's welcome as an editorial opening without adding or repeating copy", () => {
    expect(open).toMatch(/<p class="assistant-lead">Oi!<\/p>/);
    expect(open).toMatch(/<p class="assistant-welcome-body[^"]*">Posso ajudar com dúvidas sobre pedidos, entrega, pagamento e trocas\.<\/p>/);
    expect(open.match(/Oi!/g)).toHaveLength(1);
    expect(open).not.toMatch(/Olá\.|Como podemos ajudar\?/);
  });

  it("renders suggestions as full-width rows named by the question alone (decoration hidden)", () => {
    expect(open).toMatch(/<button type="button" class="assistant-suggestion[^"]*"><span class="min-w-0 flex-1 break-words">Qual o prazo de entrega\?<\/span><span aria-hidden="true" class="assistant-suggestion-arrow">/);
  });

  it("shows the brand wordmark as decoration and keeps the dialog named by the display name only", () => {
    // A CSS background, never an <img>: the panel holds no image or script element at all.
    expect(open).toMatch(/<span aria-hidden="true" class="assistant-wordmark /);
    expect(open).not.toMatch(/<img|<script/);
    expect(css).toMatch(/\.assistant-wordmark \{\s*background: url\("\/brand\/rare-logo\.png"\)/);
    expect(open).toMatch(/<h2 id="[^"]+" class="[^"]*">Assistente RARE<\/h2>/);
    expect(open).toContain("Online · respostas automáticas");
    expect(open).not.toMatch(/atendente|respondemos agora|\bIA\b/i);
  });

  it("starts with a disabled send button and a labelled field", () => {
    expect(open).toMatch(/<button type="submit" disabled="" aria-label="Enviar pergunta"/);
    expect(open).toContain('placeholder="Digite sua dúvida"');
  });

  it("has a typing state, author labels and a support link styled as part of the conversation", () => {
    expect(panelSource).toMatch(/data-assistant-typing/);
    expect(panelSource).toMatch(/<AuthorLabel align="end">Você<\/AuthorLabel>/);
    expect(panelSource).toMatch(/<AuthorLabel align="start">RARE<\/AuthorLabel>/);
    expect(panelSource).toMatch(/className = "assistant-cta group\/cta"/);
    // Functional messages and the request are unchanged by the redesign.
    expect(panelSource).toContain('fetch("/api/assistant"');
    expect(panelSource).toContain("Muitas perguntas seguidas. Aguarde um instante e tente de novo.");
    expect(panelSource).toContain("Não consegui responder agora. Verifique sua conexão e tente de novo.");
  });

  it("respects reduced motion: no transform-based entrance, no looping animation", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .assistant-launcher"));
    expect(reduced.length).toBeGreaterThan(100);
    expect(reduced).toMatch(/\.assistant-panel\[data-state="open"\] \{\s*animation: assistant-fade-in 120ms linear both;/);
    expect(reduced).toMatch(/\.assistant-typing > span,\s*\.assistant-status-dot::after,\s*\.assistant-skeleton \{\s*animation: none;/);
    expect(css).toMatch(/@keyframes assistant-fade-in \{\s*from \{\s*opacity: 0;\s*\}\s*\}/);
  });

  it("adds no motion or chat library to the bundle", () => {
    for (const source of [launcherSource, panelSource]) expect(source).not.toMatch(/framer-motion|from "motion|gsap|lottie/);
  });
});

describe("welcome message presentation", () => {
  it("lifts a short first sentence or line into the headline and keeps the rest", () => {
    expect(splitWelcomeMessage("Oi! Posso ajudar com entrega.")).toEqual({ lead: "Oi!", body: "Posso ajudar com entrega." });
    expect(splitWelcomeMessage("Olá, tudo bem?\nPergunte sobre trocas.")).toEqual({ lead: "Olá, tudo bem?", body: "Pergunte sobre trocas." });
    expect(splitWelcomeMessage("Como podemos ajudar?")).toEqual({ lead: "Como podemos ajudar?", body: "" });
  });

  it("keeps a message without a short opening whole, as body text", () => {
    const long = "Posso ajudar com dúvidas sobre pedidos, entrega, pagamento e trocas da loja RARE hoje.";
    expect(splitWelcomeMessage(long)).toEqual({ lead: null, body: long });
    expect(splitWelcomeMessage("   ")).toEqual({ lead: null, body: "" });
  });

  it("labels only the first message of each author", () => {
    const messages = [{ role: "user" as const }, { role: "assistant" as const }, { role: "user" as const }, { role: "assistant" as const }];
    const labelled = firstOfEachRole(messages);
    expect([...labelled]).toEqual([messages[0], messages[1]]);
  });
});
