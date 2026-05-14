export function getAvailableStock(stock: number, reservedStock: number) {
  return Math.max(0, stock - reservedStock);
}

export function isVariantPurchasable(variant: { active: boolean; stock: number; reservedStock: number }, quantity = 1) {
  return variant.active && quantity > 0 && getAvailableStock(variant.stock, variant.reservedStock) >= quantity;
}
