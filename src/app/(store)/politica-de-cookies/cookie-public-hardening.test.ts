import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CookiePolicyPage, { metadata } from "@/app/(store)/politica-de-cookies/page";
import { CookieConsent } from "@/components/store/cookie-consent";
import { COOKIE_CATALOG } from "@/lib/cookie-consent";
import { INTERNAL_STORAGE_INVENTORY } from "@/lib/cookie-storage-inventory";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => createElement("a", { href, ...props }, children),
}));

// RARE-COOKIE-PUBLIC-HARDENING-01: what the shopper can read must explain the storage in plain
// language without the technical names, and must say nothing about the store team's Admin or MFA.
const TECHNICAL_NAMES = [
  "rare_admin_session",
  "rare_admin_mfa_pending",
  "rare_customer_session",
  "rare_cookie_consent",
  "rare_store_cart",
  "rare_store_shipping_selection",
  "rare:home-motion-paused:v2",
  "rare_analytics_visitor",
  "rare_analytics_session",
];
const STAFF_WORDING = /rare_admin|administrativ|painel da equipe|equipe da loja|segundo fator|\bMFA\b|cookies internos/i;

function visibleText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ");
}

describe("RARE-COOKIE-PUBLIC-HARDENING-01 · /politica-de-cookies", () => {
  const html = renderToStaticMarkup(createElement(CookiePolicyPage));
  const text = visibleText(html);

  it.each(TECHNICAL_NAMES)("does not contain %s", (name) => {
    expect(html).not.toContain(name);
  });

  it("does not contain any inventory key, any rare_/rare: prefix, nor Admin/MFA wording", () => {
    for (const item of INTERNAL_STORAGE_INVENTORY) expect(html, item.name).not.toContain(item.name);
    expect(html).not.toMatch(/rare[_:]/);
    expect(text).not.toMatch(STAFF_WORDING);
    expect(JSON.stringify(metadata)).not.toMatch(/rare[_:]/);
  });

  it("drops the technical Name column and keeps Purpose, Type, Duration and Origin", () => {
    expect(html).not.toMatch(/>\s*Nome\s*</);
    expect(html).not.toContain("<table");
    for (const heading of ["Tipo", "Duração", "Origem"]) expect(html).toContain(`>${heading}</dt>`);
  });

  it("still explains session, cart, delivery, privacy preferences, usage analysis and durations", () => {
    for (const concept of ["Sessão da conta", "Carrinho", "Entrega", "Preferências de privacidade", "Preferências visuais", "Análise de uso", "Identificador do navegador", "Identificador da visita"]) {
      expect(text, concept).toContain(concept);
    }
    for (const duration of ["180 dias", "até 30 dias", "até fechar a aba", "até limpar o navegador", "400 dias"]) expect(text, duration).toContain(duration);
    expect(text).toContain("(sempre ativos)");
    expect(text).toContain("(opcional)");
    expect(text).toContain("Recusar é tão simples quanto aceitar");
    expect(text).toContain("os identificadores de análise são apagados deste navegador");
  });

  it("renders every public catalog entry", () => {
    for (const entry of COOKIE_CATALOG.flatMap((category) => category.entries)) {
      expect(text, entry.id).toContain(entry.label);
      expect(text, entry.id).toContain(entry.duration);
    }
  });

  it("makes no unsupported legal or anonymity claim", () => {
    expect(text).not.toMatch(/100% an[oô]nim|totalmente an[oô]nim|LGPD compliant|100% conforme|em conformidade com a LGPD/i);
  });
});

describe("RARE-COOKIE-PUBLIC-HARDENING-01 · preferences panel", () => {
  const html = renderToStaticMarkup(createElement(CookieConsent));
  const text = visibleText(html);

  it("has no technical-details toggle and no rare_ text", () => {
    expect(html).not.toContain("Ver detalhes técnicos");
    expect(html).not.toContain("<details");
    expect(html).not.toMatch(/rare[_:]/);
    for (const name of TECHNICAL_NAMES) expect(html, name).not.toContain(name);
    expect(text).not.toMatch(STAFF_WORDING);
  });

  it("keeps Essenciais always on, the analytics switch and the three choices", () => {
    expect(text).toContain("Essenciais");
    expect(text).toContain("Sempre ativos");
    expect(text).toContain("Necessários para manter recursos como sua sessão, carrinho, entrega escolhida e preferências de privacidade.");
    for (const label of ["Preferências de privacidade", "Sessão da conta", "Carrinho", "Entrega", "Preferências visuais"]) expect(text, label).toContain(label);
    expect(text).toContain("Análise de uso");
    expect(text).toContain("Só funciona quando você autoriza.");
    expect(html).toMatch(/role="switch"/);
    for (const action of ["Salvar preferências", "Aceitar todos", "Recusar não essenciais"]) expect(text, action).toContain(action);
  });
});
