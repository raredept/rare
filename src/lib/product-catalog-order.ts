import { Prisma } from "@prisma/client";

// Manual order of the catalog. `Product.sortOrder` holds the product's position in ONE list that
// contains every product (active and hidden), numbered 1..N. The Admin list, the storefront and the
// "Posição no catálogo" field all read that same list, so the number the operator types is the place
// the piece takes. Before the first move every product still has the old default (0); the order is
// then decided by the tie-breakers below, and the first move renumbers the whole list.

/** Canonical manual order. The id makes it total, so two equal rows never swap between reads. */
export const PRODUCT_CATALOG_ORDER_BY = [
  { sortOrder: "asc" },
  { createdAt: "desc" },
  { id: "asc" },
] satisfies Prisma.ProductOrderByWithRelationInput[];

export const MAX_CATALOG_POSITION = 999_999;

type CatalogOrderClient = Pick<Prisma.TransactionClient, "product" | "$executeRaw">;

/** "3" → 3. Anything that is not a whole number ≥ 1 → null. */
export function parseCatalogPosition(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!/^\d{1,6}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_CATALOG_POSITION ? value : null;
}

/**
 * Takes `productId` out of `orderedIds` and puts it back at `position` (1-based). A position past
 * the end means "last". `productId` may be absent (a product being created).
 */
export function placeAtPosition(orderedIds: readonly string[], productId: string, position: number): string[] {
  const rest = orderedIds.filter((id) => id !== productId);
  const index = Math.min(Math.max(Math.trunc(position), 1), rest.length + 1) - 1;
  return [...rest.slice(0, index), productId, ...rest.slice(index)];
}

/** Moves `productId` right before (`up`) or right after (`down`) `neighborId`. */
export function placeNextTo(orderedIds: readonly string[], productId: string, neighborId: string, direction: "up" | "down"): string[] | null {
  if (productId === neighborId || !orderedIds.includes(productId)) return null;
  const rest = orderedIds.filter((id) => id !== productId);
  const neighborIndex = rest.indexOf(neighborId);
  if (neighborIndex < 0) return null;
  const index = direction === "up" ? neighborIndex : neighborIndex + 1;
  return [...rest.slice(0, index), productId, ...rest.slice(index)];
}

/** 1-based position of `productId`, or null when it is not in the list. */
export function positionOf(orderedIds: readonly string[], productId: string): number | null {
  const index = orderedIds.indexOf(productId);
  return index < 0 ? null : index + 1;
}

/** All product ids in the canonical manual order. */
export async function readCatalogOrder(client: Pick<Prisma.TransactionClient, "product">): Promise<string[]> {
  const rows = await client.product.findMany({ select: { id: true }, orderBy: PRODUCT_CATALOG_ORDER_BY });
  return rows.map((row) => row.id);
}

/**
 * Serializes every reorder: two operators moving pieces at the same time would otherwise each
 * renumber from their own snapshot and leave duplicate or skipped positions. Released at commit.
 */
export async function lockCatalogOrder(client: CatalogOrderClient) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('rare.product-catalog-order'))`;
}

/**
 * Writes positions 1..N for `orderedIds`, touching only rows whose number changes. Raw SQL on
 * purpose: Prisma's @updatedAt would otherwise mark every shifted product as edited, which feeds the
 * featured order tie-breaker, the sitemap and the Merchant feed.
 */
export async function writeCatalogOrder(client: CatalogOrderClient, orderedIds: readonly string[]) {
  if (!orderedIds.length) return 0;
  const positions = orderedIds.map((_, index) => index + 1);
  return client.$executeRaw`
    UPDATE "Product" AS product
    SET "sortOrder" = data.position
    FROM unnest(${[...orderedIds]}::text[], ${positions}::int[]) AS data(id, position)
    WHERE product."id" = data.id AND product."sortOrder" IS DISTINCT FROM data.position
  `;
}

export type CatalogMoveResult = { before: number | null; after: number; total: number; changed: boolean };

/**
 * Must run inside a transaction. Locks the order, reads it, applies `reorder` and renumbers when
 * the order actually changed.
 */
export async function moveInCatalogOrder(
  client: CatalogOrderClient,
  productId: string,
  reorder: (orderedIds: string[]) => string[] | null,
): Promise<CatalogMoveResult | null> {
  await lockCatalogOrder(client);
  const current = await readCatalogOrder(client);
  const next = reorder(current);
  if (!next) return null;
  const after = positionOf(next, productId);
  if (after === null) return null;
  const changed = next.length !== current.length || next.some((id, index) => id !== current[index]);
  if (changed) await writeCatalogOrder(client, next);
  return { before: positionOf(current, productId), after, total: next.length, changed };
}
