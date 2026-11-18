import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminFixedSaveBar } from "@/components/admin/admin-fixed-save-bar";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { CookieConsent } from "@/components/store/cookie-consent";
import { HomeBrandsStrip } from "@/components/store/home-brands-strip";
import { HomeMotionProvider } from "@/components/store/home-motion";
import { formatPromotionHistoryAction } from "@/lib/order-display";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => createElement("a", { href, ...props }, children),
}));

describe("RARE-UIUX-REFINE-01 · P2/P3", () => {
  it("UIUX-BRANDS-001: each brand opens the catalog filtered by it; the looping copy is not focusable", () => {
    const html = renderToStaticMarkup(createElement(HomeMotionProvider, null, createElement(HomeBrandsStrip, { brands: ["BAPE", "Corteiz", "Stüssy", "Supreme"] })));
    expect(html).toContain('href="/categoria/tudo?brand=BAPE"');
    expect(html).toContain('href="/categoria/tudo?brand=St%C3%BCssy"');
    expect(html).toContain('aria-label="Ver peças Corteiz"');
    const copy = html.slice(html.indexOf('aria-hidden="true"'));
    expect(copy).toContain('tabindex="-1"');
  });

  it("UIUX-BRANDS-001: a click on the hero no longer writes the page-wide pause", () => {
    const source = readFileSync(path.resolve("src/components/store/home-motion.tsx"), "utf8");
    expect(source).toMatch(/function select\(next: number\) \{ setInteractionPaused\(true\); setIndex\(next\); \}/);
    expect(source).toContain('"rare:home-motion-paused:v2"');
  });

  it("UIUX-COOKIES-001/002: the shopper panel hides the store-team cookies and keeps both choices side by side", () => {
    const html = renderToStaticMarkup(createElement(CookieConsent));
    expect(html).not.toContain("rare_admin_session");
    expect(html).not.toContain("rare_admin_mfa_pending");
    // RARE-COOKIE-PUBLIC-HARDENING-01 superseded the "Ver detalhes técnicos" toggle: plain language only.
    expect(html).not.toContain("Ver detalhes técnicos");
    expect(html).not.toContain("rare_customer_session");
    expect(html).toContain("Sessão da conta");
  });

  it("UIUX-GLOBAL-001: no unlayered font reset beats the Tailwind utilities; phone fields keep 16 px", () => {
    const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");
    expect(css).not.toMatch(/\nbutton,\s*\ninput,\s*\nselect,\s*\ntextarea\s*\{\s*font:\s*inherit;\s*\}/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*font-size: 16px;/);
    expect(css).toMatch(/scroll-padding-top: 9\.5rem/);
  });

  it("UIUX-ADMIN-001: promotion history in Portuguese", () => {
    expect(formatPromotionHistoryAction("promotion.updated")).toBe("Editada");
    expect(formatPromotionHistoryAction("promotion.created")).toBe("Criada");
    expect(formatPromotionHistoryAction("promotion.something")).toBe("something");
  });

  it("UIUX-PDP-003: while the phone buy bar can show, the page ends below it (footer never hidden)", () => {
    const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 1023px\)\s*\{\s*html\[data-pdp-buy-bar="true"\] body\s*\{\s*padding-bottom: var\(--pdp-buy-bar-space, 5\.5rem\);/);
    const source = readFileSync(path.resolve("src/components/store/product-detail-client.tsx"), "utf8");
    expect(source).toContain('root.dataset.pdpBuyBar = "true"');
    expect(source).toContain("delete root.dataset.pdpBuyBar");
    expect(source).toContain('root.style.setProperty("--pdp-buy-bar-space"');
    expect(source).toContain("ref={buyBarRef}");
  });

  it("UIUX-ADMIN-004: the product save bar is portaled to <body> and still submits its form", () => {
    const button = renderToStaticMarkup(createElement(AdminSubmitButton, { idleLabel: "Salvar produto", pendingLabel: "Salvando...", form: "admin-product-form" }));
    expect(button).toContain('form="admin-product-form"');
    expect(button).toContain('type="submit"');
    // Server render: nothing until mounted (the portal target only exists in the browser).
    expect(renderToStaticMarkup(createElement(AdminFixedSaveBar, { className: "fixed" } as ComponentProps<typeof AdminFixedSaveBar>, "x"))).toBe("");
    const form = readFileSync(path.resolve("src/components/admin/product-form.tsx"), "utf8");
    expect(form).toMatch(/<AdminFixedSaveBar[^>]*>\s*<AdminSubmitButton\s+form="admin-product-form"/);
    expect(form).not.toMatch(/<div className="fixed inset-x-0 bottom-0/);
  });
});
