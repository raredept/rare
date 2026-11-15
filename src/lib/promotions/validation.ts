import { parseBusinessDateTime } from "@/lib/business-time";
import { parseMoneyToCents } from "@/lib/money";
import { resolveSafeInternalPath } from "@/lib/safe-redirect";
import { computePromotionDiscount, type PromotionScopeValue, type PromotionTypeValue } from "@/lib/promotions/engine";

// Admin input for promotions. Only the fields listed here are read from the form (allowlist):
// status, audit fields, creator/updater and ids are never taken from the payload.

export const PROMOTION_TYPES: readonly PromotionTypeValue[] = ["PERCENTAGE", "FIXED_AMOUNT"];
export const PROMOTION_SCOPES: readonly PromotionScopeValue[] = ["ALL_PRODUCTS", "SELECTED_PRODUCTS", "SELECTED_CATEGORIES"];
const MAX_FIXED_DISCOUNT_IN_CENTS = 10_000_000;
const MAX_TARGETS = 500;

export type PromotionInput = {
  name: string;
  slug: string;
  type: PromotionTypeValue;
  value: number | null;
  scope: PromotionScopeValue;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  homepageFeatured: boolean;
  badgeText: string | null;
  headline: string | null;
  subheadline: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  bannerImageUrl: string | null;
  bannerMobileImageUrl: string | null;
  bannerAlt: string | null;
  productIds: string[];
  categoryIds: string[];
};

export type PromotionInputResult = { ok: true; input: PromotionInput } | { ok: false; errors: string[] };

/** Plain text only: control characters and angle brackets are removed; length is capped. */
export function cleanCommercialText(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export function slugifyPromotionCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function safeHref(value: FormDataEntryValue | null) {
  const text = cleanCommercialText(value, 300);
  if (!text) return { value: null, ok: true };
  const resolved = resolveSafeInternalPath(text, () => true, "");
  return resolved ? { value: resolved, ok: true } : { value: null, ok: false };
}

function safeMediaUrl(value: FormDataEntryValue | null) {
  const text = cleanCommercialText(value, 600);
  if (!text) return { value: null, ok: true };
  if (text.startsWith("/") && !text.startsWith("//")) return { value: resolveSafeInternalPath(text, () => true, "") || null, ok: true };
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? { value: url.toString(), ok: true } : { value: null, ok: false };
  } catch {
    return { value: null, ok: false };
  }
}

function idList(formData: FormData, key: string) {
  const values = formData.getAll(key).filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(item));
  return [...new Set(values)].slice(0, MAX_TARGETS + 1);
}

/**
 * Parses and validates the form. `requireComplete` is used to activate (or to save an already
 * active promotion): a DRAFT may be incomplete, a live promotion may not.
 */
export function parsePromotionForm(formData: FormData, options: { requireComplete: boolean; now: Date }): PromotionInputResult {
  const errors: string[] = [];
  const name = cleanCommercialText(formData.get("name"), 120);
  if (!name) errors.push("Informe o nome da promoção.");
  const rawSlug = cleanCommercialText(formData.get("slug"), 80) ?? name ?? "";
  const slug = slugifyPromotionCode(rawSlug);
  if (!slug) errors.push("Informe um código interno válido.");

  const typeValue = formData.get("type");
  const type = PROMOTION_TYPES.includes(typeValue as PromotionTypeValue) ? (typeValue as PromotionTypeValue) : null;
  if (!type) errors.push("Tipo de desconto inválido.");
  const scopeValue = formData.get("scope");
  const scope = PROMOTION_SCOPES.includes(scopeValue as PromotionScopeValue) ? (scopeValue as PromotionScopeValue) : null;
  if (!scope) errors.push("Escopo inválido.");

  const rawValue = formData.get("value");
  let value: number | null = null;
  if (typeof rawValue === "string" && rawValue.trim()) {
    if (type === "PERCENTAGE") {
      const percent = Number(rawValue.replace(",", ".").replace("%", "").trim());
      if (!Number.isInteger(percent)) errors.push("O percentual deve ser um número inteiro.");
      else if (percent <= 0) errors.push("O desconto deve ser maior que zero.");
      else if (percent > 100) errors.push("O percentual não pode passar de 100%.");
      else value = percent;
    } else if (type === "FIXED_AMOUNT") {
      if (/-/.test(rawValue)) errors.push("O desconto não pode ser negativo.");
      const cents = parseMoneyToCents(rawValue);
      if (cents <= 0) errors.push("O desconto deve ser maior que zero.");
      else if (cents > MAX_FIXED_DISCOUNT_IN_CENTS) errors.push("Desconto fixo alto demais.");
      else value = cents;
    }
  } else if (options.requireComplete) {
    errors.push("Informe o valor do desconto.");
  }

  const rawStart = formData.get("startsAt");
  const rawEnd = formData.get("endsAt");
  const startsAt = typeof rawStart === "string" && rawStart.trim() ? parseBusinessDateTime(rawStart) : null;
  const endsAt = typeof rawEnd === "string" && rawEnd.trim() ? parseBusinessDateTime(rawEnd) : null;
  if (typeof rawStart === "string" && rawStart.trim() && !startsAt) errors.push("Data de início inválida.");
  if (typeof rawEnd === "string" && rawEnd.trim() && !endsAt) errors.push("Data de fim inválida.");
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) errors.push("O fim deve ser depois do início.");
  if (options.requireComplete && endsAt && endsAt.getTime() <= options.now.getTime()) errors.push("O fim da promoção já passou.");

  const priority = Number(formData.get("priority") ?? 0);
  if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) errors.push("Prioridade deve ser um inteiro entre -1000 e 1000.");

  const productIds = idList(formData, "productIds");
  const categoryIds = idList(formData, "categoryIds");
  if (productIds.length > MAX_TARGETS || categoryIds.length > MAX_TARGETS) errors.push("Seleção grande demais; use o escopo por categoria ou todos os produtos.");
  if (options.requireComplete && scope === "SELECTED_PRODUCTS" && productIds.length === 0) errors.push("Selecione ao menos um produto.");
  if (options.requireComplete && scope === "SELECTED_CATEGORIES" && categoryIds.length === 0) errors.push("Selecione ao menos uma categoria.");

  const ctaHref = safeHref(formData.get("ctaHref"));
  if (!ctaHref.ok) errors.push("O link do CTA deve ser um caminho interno da loja (ex.: /categoria/tudo).");
  const banner = safeMediaUrl(formData.get("bannerImageUrl"));
  const bannerMobile = safeMediaUrl(formData.get("bannerMobileImageUrl"));
  if (!banner.ok || !bannerMobile.ok) errors.push("A imagem do banner deve ser um caminho interno ou uma URL https.");
  const bannerAlt = cleanCommercialText(formData.get("bannerAlt"), 200);
  if ((banner.value || bannerMobile.value) && !bannerAlt) errors.push("Descreva a imagem do banner (texto alternativo).");

  const homepageFeatured = formData.get("homepageFeatured") === "on" || formData.get("homepageFeatured") === "true";
  const headline = cleanCommercialText(formData.get("headline"), 80);
  if (options.requireComplete && homepageFeatured && !headline) errors.push("Campanha em destaque na home precisa de um título.");

  if (errors.length || !name || !type || !scope) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name,
      slug,
      type,
      value,
      scope,
      startsAt,
      endsAt,
      priority,
      homepageFeatured,
      badgeText: cleanCommercialText(formData.get("badgeText"), 24),
      headline,
      subheadline: cleanCommercialText(formData.get("subheadline"), 200),
      ctaLabel: cleanCommercialText(formData.get("ctaLabel"), 40),
      ctaHref: ctaHref.value,
      bannerImageUrl: banner.value,
      bannerMobileImageUrl: bannerMobile.value,
      bannerAlt,
      productIds: scope === "SELECTED_PRODUCTS" ? productIds : [],
      categoryIds: scope === "SELECTED_CATEGORIES" ? categoryIds : [],
    },
  };
}

export type PromotionEffectPreview = {
  productId: string;
  title: string;
  basePriceInCents: number;
  finalPriceInCents: number | null;
  reason: "applies" | "price_too_low";
};

/** "What will this do to prices?" for the form preview, before saving. */
export function previewPromotionEffect(
  rule: { type: PromotionTypeValue; value: number | null },
  products: ReadonlyArray<{ id: string; title: string; priceInCents: number }>,
): PromotionEffectPreview[] {
  return products.map((product) => {
    const discount = computePromotionDiscount(rule, product.priceInCents);
    return {
      productId: product.id,
      title: product.title,
      basePriceInCents: product.priceInCents,
      finalPriceInCents: discount === null ? null : product.priceInCents - discount,
      reason: discount === null ? "price_too_low" : "applies",
    };
  });
}
