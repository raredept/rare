// Cookie consent contract (pure: no DOM, no Node APIs). Shared by the banner, the analytics
// client, the ingestion route and the cookie policy page.
//
// The consent record holds a policy version, the optional categories and the decision time.
// Nothing in it identifies a person: no id, no e-mail, no IP.

export const COOKIE_CONSENT_COOKIE = "rare_cookie_consent";
/** Bump when a category or its purpose changes: older records stop counting and the banner asks again. */
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_DAYS = 180;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = COOKIE_CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;

/** Random visitor id, created only after analytics consent and removed when it is withdrawn. */
export const ANALYTICS_VISITOR_COOKIE = "rare_analytics_visitor";
export const ANALYTICS_VISITOR_MAX_AGE_DAYS = 180;
/** Random id of one browser tab session (sessionStorage), created only after analytics consent. */
export const ANALYTICS_SESSION_STORAGE_KEY = "rare_analytics_session";

export const CONSENT_CATEGORIES = ["ESSENTIAL", "ANALYTICS"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export type CookieConsent = {
  version: number;
  /** ESSENTIAL is always on and is not stored. */
  analytics: boolean;
  /** Unix seconds of the decision. */
  decidedAt: number;
};

const CONSENT_PATTERN = /^v(\d{1,4})\.a([01])\.(\d{9,11})$/;

export function serializeCookieConsent(consent: CookieConsent) {
  return `v${consent.version}.a${consent.analytics ? 1 : 0}.${Math.trunc(consent.decidedAt)}`;
}

/** Null for a missing, malformed, outdated or expired record: the visitor is asked again. */
export function parseCookieConsent(raw: string | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): CookieConsent | null {
  const match = CONSENT_PATTERN.exec((raw ?? "").trim());
  if (!match) return null;
  const version = Number(match[1]);
  const decidedAt = Number(match[3]);
  if (version !== COOKIE_CONSENT_VERSION) return null;
  if (decidedAt > nowSeconds + 300 || nowSeconds - decidedAt > COOKIE_CONSENT_MAX_AGE_SECONDS) return null;
  return { version, analytics: match[2] === "1", decidedAt };
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string) {
  for (const part of (cookieHeader ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function readCookieConsent(cookieHeader: string | null | undefined, nowSeconds?: number) {
  return parseCookieConsent(readCookieValue(cookieHeader, COOKIE_CONSENT_COOKIE), nowSeconds);
}

/** Analytics is opt-in: no record, or a record that refuses it, means no behavioural tracking. */
export function hasAnalyticsConsent(consent: CookieConsent | null) {
  return consent?.analytics === true;
}

export type StorageEntry = {
  name: string;
  kind: "cookie" | "localStorage" | "sessionStorage";
  purpose: string;
  duration: string;
  party: "Próprio (raredept.com.br)" | "Terceiro";
};

export type ConsentCategoryInfo = {
  id: ConsentCategory;
  label: string;
  required: boolean;
  purpose: string;
  entries: StorageEntry[];
};

const FIRST_PARTY = "Próprio (raredept.com.br)" as const;

/**
 * Everything this app stores in the browser. src/lib/cookie-consent.test.ts fails when the code
 * sets a cookie or a storage key that is not listed here, so the policy cannot drift from the app.
 */
export const COOKIE_CATALOG: ConsentCategoryInfo[] = [
  {
    id: "ESSENTIAL",
    label: "Essenciais",
    required: true,
    purpose: "Necessários para a loja funcionar: manter a sessão, o carrinho, a entrega escolhida e a sua decisão sobre cookies. Não podem ser desativados.",
    entries: [
      { name: COOKIE_CONSENT_COOKIE, kind: "cookie", purpose: "Guarda a sua decisão sobre cookies (versão da política, categorias e data). Não identifica você.", duration: `${COOKIE_CONSENT_MAX_AGE_DAYS} dias`, party: FIRST_PARTY },
      { name: "rare_customer_session", kind: "cookie", purpose: "Mantém você conectado à sua conta depois do login.", duration: "30 dias", party: FIRST_PARTY },
      { name: "rare_admin_session", kind: "cookie", purpose: "Sessão do painel administrativo (apenas equipe da loja).", duration: "8 horas", party: FIRST_PARTY },
      { name: "rare_admin_mfa_pending", kind: "cookie", purpose: "Etapa do segundo fator no login do painel administrativo (apenas equipe da loja).", duration: "até 10 minutos", party: FIRST_PARTY },
      { name: "rare_store_cart", kind: "localStorage", purpose: "Itens do seu carrinho neste navegador.", duration: "até você esvaziar o carrinho ou limpar o navegador", party: FIRST_PARTY },
      { name: "rare_store_shipping_selection", kind: "localStorage", purpose: "Opção de entrega escolhida no carrinho.", duration: "até concluir a compra ou limpar o navegador", party: FIRST_PARTY },
      { name: "rare:home-motion-paused", kind: "localStorage", purpose: "Lembra se você pausou as animações da página inicial.", duration: "até limpar o navegador", party: FIRST_PARTY },
    ],
  },
  {
    id: "ANALYTICS",
    label: "Análise de uso",
    required: false,
    purpose: "Medição própria da loja, sem ferramentas de terceiros: páginas e produtos vistos, cliques em produtos e itens adicionados ao carrinho, para entender o que interessa aos visitantes. Só é ativada com o seu consentimento e usa identificadores aleatórios, sem nome, e-mail, CPF, telefone ou endereço IP.",
    entries: [
      { name: ANALYTICS_VISITOR_COOKIE, kind: "cookie", purpose: "Identificador aleatório deste navegador, para contar visitas sem saber quem você é.", duration: `${ANALYTICS_VISITOR_MAX_AGE_DAYS} dias (apagado ao recusar)`, party: FIRST_PARTY },
      { name: ANALYTICS_SESSION_STORAGE_KEY, kind: "sessionStorage", purpose: "Identificador aleatório da visita atual, para agrupar as páginas de uma mesma sessão.", duration: "até fechar a aba (apagado ao recusar)", party: FIRST_PARTY },
    ],
  },
];

export function getConsentCategory(id: ConsentCategory) {
  return COOKIE_CATALOG.find((category) => category.id === id)!;
}
