// Pure stock policy rules (no database, no Node APIs): shared by the Admin lists, the dashboard,
// readiness and the integrity audit.
//
// STANDARD: a replenishable item. Quantity matters: normal / low / critical / sold out.
// UNIQUE:   a one-of-a-kind piece. One unit on the shelf is its normal state and zero after a sale
//           means "sold", never "critical". A UNIQUE piece is only critical when its numbers
//           contradict each other (see StockInconsistency).

export const STOCK_POLICIES = ["STANDARD", "UNIQUE"] as const;
export type StockPolicy = (typeof STOCK_POLICIES)[number];

export const STOCK_POLICY_LABELS: Record<StockPolicy, string> = {
  STANDARD: "Padrão",
  UNIQUE: "Única",
};

export function isStockPolicy(value: unknown): value is StockPolicy {
  return typeof value === "string" && (STOCK_POLICIES as readonly string[]).includes(value);
}

/** STANDARD only: at or below this sellable count a variant is "low". */
export const LOW_STOCK_THRESHOLD = 3;
/** STANDARD only: at or below this sellable count (and above zero) a variant is "critical". */
export const CRITICAL_STOCK_THRESHOLD = 1;

export type StockState = "available" | "low" | "critical" | "reserved" | "sold" | "sold_out" | "inconsistent";

export const STOCK_STATE_LABELS: Record<StockState, string> = {
  available: "Disponível",
  low: "Estoque baixo",
  critical: "Estoque crítico",
  reserved: "Reservada",
  sold: "Vendida",
  sold_out: "Esgotada",
  inconsistent: "Inconsistente",
};

export type StockStateTone = "ok" | "warning" | "danger" | "muted";

export const STOCK_STATE_TONES: Record<StockState, StockStateTone> = {
  available: "ok",
  low: "warning",
  critical: "danger",
  reserved: "muted",
  sold: "muted",
  sold_out: "muted",
  inconsistent: "danger",
};

export type StockInconsistency =
  | "negative_stock"
  | "negative_reserved"
  | "reserved_exceeds_stock"
  | "reservation_mismatch"
  | "unique_multiple_units"
  | "unique_double_sale"
  | "unique_double_reservation"
  | "unique_sold_but_purchasable"
  | "unique_sold_with_stock";

export const STOCK_INCONSISTENCY_LABELS: Record<StockInconsistency, string> = {
  negative_stock: "Estoque físico negativo",
  negative_reserved: "Reserva negativa",
  reserved_exceeds_stock: "Reserva maior que o estoque físico",
  reservation_mismatch: "Reserva não confere com os pedidos em aberto",
  unique_multiple_units: "Peça única com mais de uma unidade",
  unique_double_sale: "Peça única vendida mais de uma vez",
  unique_double_reservation: "Peça única reservada mais de uma vez",
  unique_sold_but_purchasable: "Peça única vendida, mas ainda comprável",
  unique_sold_with_stock: "Peça única vendida com unidade ainda em estoque",
};

export type StockVariantInput = { active: boolean; stock: number; reservedStock: number };

export type ProductStockInput = {
  policy: StockPolicy;
  /** Product visible in the store. */
  active: boolean;
  variants: StockVariantInput[];
  /** Units in orders that count as revenue (paid, processing, shipped, delivered). */
  soldUnits?: number;
  /** Units in orders still holding a reservation (pending, awaiting payment). Omit when unknown. */
  openReservedUnits?: number;
  /** Orders still holding a reservation. Omit when unknown. */
  openReservationOrders?: number;
};

export type ProductStockSummary = {
  policy: StockPolicy;
  state: StockState;
  /** Units on the shelf in active variants (a deactivated size is not offered and is not counted). */
  physical: number;
  /** Units held by open checkouts, every variant. */
  reserved: number;
  /** Units a shopper can buy now (active variants of an active product are what the store sells). */
  available: number;
  inconsistencies: StockInconsistency[];
};

function sellable(variant: StockVariantInput) {
  return Math.max(0, variant.stock - variant.reservedStock);
}

/** Quantity level of a replenishable (STANDARD) count. */
export function getStandardStockLevel(availableUnits: number): Extract<StockState, "available" | "low" | "critical" | "sold_out"> {
  if (availableUnits <= 0) return "sold_out";
  if (availableUnits <= CRITICAL_STOCK_THRESHOLD) return "critical";
  if (availableUnits <= LOW_STOCK_THRESHOLD) return "low";
  return "available";
}

function physicalUnits(variants: StockVariantInput[]) {
  return variants.filter((variant) => variant.active).reduce((total, variant) => total + variant.stock, 0);
}

export function findStockInconsistencies(input: ProductStockInput): StockInconsistency[] {
  const found = new Set<StockInconsistency>();
  const physical = physicalUnits(input.variants);
  const reserved = input.variants.reduce((total, variant) => total + variant.reservedStock, 0);
  const soldUnits = input.soldUnits ?? 0;

  for (const variant of input.variants) {
    if (variant.stock < 0) found.add("negative_stock");
    if (variant.reservedStock < 0) found.add("negative_reserved");
    if (variant.reservedStock > variant.stock) found.add("reserved_exceeds_stock");
  }
  if (input.openReservedUnits !== undefined && input.openReservedUnits !== reserved) found.add("reservation_mismatch");

  if (input.policy === "UNIQUE") {
    if (physical > 1) found.add("unique_multiple_units");
    if (soldUnits > 1) found.add("unique_double_sale");
    if (reserved > 1 || (input.openReservationOrders ?? 0) > 1 || (input.openReservedUnits ?? 0) > 1) found.add("unique_double_reservation");
    if (soldUnits >= 1 && physical >= 1) {
      const purchasable = input.active && input.variants.some((variant) => variant.active && sellable(variant) > 0);
      found.add(purchasable ? "unique_sold_but_purchasable" : "unique_sold_with_stock");
    }
  }

  return [...found];
}

/**
 * One state per product. Quantity never makes a UNIQUE piece low or critical: it is available,
 * reserved, sold or (zero units without a sale) sold out — or inconsistent.
 */
export function summarizeProductStock(input: ProductStockInput): ProductStockSummary {
  const physical = physicalUnits(input.variants);
  const reserved = input.variants.reduce((total, variant) => total + variant.reservedStock, 0);
  const available = input.variants.filter((variant) => variant.active).reduce((total, variant) => total + sellable(variant), 0);
  const inconsistencies = findStockInconsistencies(input);
  const base = { policy: input.policy, physical, reserved, available, inconsistencies };

  if (inconsistencies.length) return { ...base, state: "inconsistent" };
  if (input.policy === "STANDARD") return { ...base, state: getStandardStockLevel(available) };

  if (available > 0) return { ...base, state: "available" };
  if (reserved > 0) return { ...base, state: "reserved" };
  if ((input.soldUnits ?? 0) > 0) return { ...base, state: "sold" };
  return { ...base, state: "sold_out" };
}

/** Only these states ask for the operator's attention as "critical". */
export function isCriticalStockState(state: StockState) {
  return state === "critical" || state === "inconsistent";
}
