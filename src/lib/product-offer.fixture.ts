import type { OfferSourceProduct } from "@/lib/product-offer";

/** Test fixture (RARE-SEO-GOOGLE-01): a two-size product on a 10% promotion, one size fully reserved. */
export function makeOfferProduct(overrides: Partial<OfferSourceProduct> = {}): OfferSourceProduct {
  return {
    id: "prod_camiseta_1",
    title: "Camiseta Supreme",
    slug: "camiseta-supreme",
    description: "Camiseta Supreme NBA YoungBoy, algodão.",
    shortDescription: "Camiseta Supreme NBA YoungBoy",
    brand: "Supreme",
    category: { name: "Camisetas", slug: "camisetas", active: true },
    subcategory: null,
    images: [
      { url: "https://media.example/products/a-rare-v1-original.png", alt: "Frente" },
      { url: "https://media.example/products/b.webp", alt: "Costas" },
      { url: "https://media.example/products/c.mp4", alt: "Vídeo" },
      { url: "/uploads/d.gif", alt: "GIF" },
    ],
    variants: [
      { id: "var_p", size: "P", sku: null, stock: 2, reservedStock: 0, active: true },
      { id: "var_m", size: "M", sku: "SUP-M", stock: 1, reservedStock: 1, active: true },
      { id: "var_g", size: "G", sku: null, stock: 5, reservedStock: 0, active: false },
    ],
    pricing: { basePriceInCents: 31158, finalPriceInCents: 28042, discountInCents: 3116, percentOff: 10, promotion: { id: "promo_10", name: "BLACK FRIDAY SALE", slug: "black-friday-sale-10", badgeText: null, endsAt: null } },
    ...overrides,
  };
}
