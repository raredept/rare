/**
 * SKU (stock keeping unit): the internal code that identifies one sellable unit — a product
 * variant (size). A product "without variants" is a single variant (e.g. size "Único").
 *
 * Rules:
 * - optional: absent is NULL, never "";
 * - stored normalized: trimmed and upper case;
 * - A-Z, 0-9, "-" and "_" only, 3 to 64 characters;
 * - unique across every variant (normalized form). Enforced here and by the unique index
 *   "ProductVariant_sku_key" in the database.
 */

export const SKU_MIN_LENGTH = 3;
export const SKU_MAX_LENGTH = 64;
export const SKU_PATTERN = /^[A-Z0-9_-]+$/;

export const SKU_TAKEN_MESSAGE = "Este SKU já está sendo utilizado por outro item.";
export const SKU_FORMAT_MESSAGE = `SKU inválido. Use de ${SKU_MIN_LENGTH} a ${SKU_MAX_LENGTH} caracteres: letras sem acento, números, hífen (-) ou sublinhado (_).`;
export const SKU_FIELD_HELP = "Código interno usado para identificar o item no estoque.";
export const SKU_FIELD_PLACEHOLDER = "Ex.: CRTZ-TSH-BLK-G";

/** Trim + upper case. Blank (or non-string) input becomes null. */
export function normalizeSku(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function isValidSku(sku: string) {
  return sku.length >= SKU_MIN_LENGTH && sku.length <= SKU_MAX_LENGTH && SKU_PATTERN.test(sku);
}

export type SkuParseResult = { ok: true; sku: string | null } | { ok: false; error: string };

/**
 * Normalizes and validates one submitted SKU. `currentSku` is the value the same variant already
 * has: an unchanged legacy value saved before these rules existed is accepted as is, so an old
 * product can still have its stock edited without first rewriting its SKU.
 */
export function parseSkuInput(raw: unknown, currentSku?: string | null): SkuParseResult {
  const sku = normalizeSku(raw);
  if (sku === null) return { ok: true, sku: null };
  if (isValidSku(sku)) return { ok: true, sku };
  if (currentSku && normalizeSku(currentSku) === sku) return { ok: true, sku };
  return { ok: false, error: SKU_FORMAT_MESSAGE };
}

/** First SKU that appears more than once in the same submission, if any. */
export function findRepeatedSku(skus: Array<string | null>) {
  const seen = new Set<string>();
  for (const sku of skus) {
    if (!sku) continue;
    if (seen.has(sku)) return sku;
    seen.add(sku);
  }
  return null;
}

/**
 * A search term that could be a SKU, in the stored (normalized) form. Used to extend text
 * searches without changing how they treat other terms.
 */
export function skuSearchTerm(query: string | null | undefined) {
  const term = normalizeSku(query ?? "");
  return term && term.length <= SKU_MAX_LENGTH ? term : null;
}
