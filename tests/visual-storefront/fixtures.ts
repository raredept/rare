import type { StorefrontProduct, HomeCategoryTiles } from "@/lib/storefront";
import type { HomeBannerSlide } from "@/lib/home-banners";

const fixtureDate = new Date("2026-10-07T00:00:00.000Z");
export const fixtureCategories = [
  { id: "qa-camisetas", name: "Camisetas", slug: "camisetas", parentId: null, active: true, sortOrder: 0, createdAt: fixtureDate, updatedAt: fixtureDate, children: [] },
  { id: "qa-calcas", name: "Calças", slug: "calcas", parentId: null, active: true, sortOrder: 1, createdAt: fixtureDate, updatedAt: fixtureDate, children: [] },
  { id: "qa-acessorios", name: "Acessórios", slug: "acessorios", parentId: null, active: true, sortOrder: 2, createdAt: fixtureDate, updatedAt: fixtureDate,
    children: [{ id: "qa-bags", name: "Bags", slug: "bags", parentId: "qa-acessorios", active: true, sortOrder: 0, createdAt: fixtureDate, updatedAt: fixtureDate, children: [] }] },
];

function product(index: number, changes: Record<string, unknown> = {}): StorefrontProduct {
  return {
    id: `qa-product-${index}`, title: `QA Fixture — Peça ${index}`, slug: `qa-peca-${index}`,
    shortDescription: "Produto sintético exclusivo da validação local.", description: "Fixture de apresentação e interação. Não representa produto, oferta ou estoque real da RARE.",
    priceInCents: 19900 + index * 100, brand: "QA Fixture", active: true, featured: index < 7, sortOrder: index, featuredSortOrder: index,
    createdAt: fixtureDate, updatedAt: fixtureDate, categoryId: "qa-camisetas", subcategoryId: null,
    category: fixtureCategories[0], subcategory: null,
    images: [
      { id: `qa-image-${index}-front`, productId: `qa-product-${index}`, url: "/seed-products/conjunto-nike-tech.svg", alt: "Ilustração seed local — fixture QA", sortOrder: 0 },
      { id: `qa-image-${index}-back`, productId: `qa-product-${index}`, url: "/seed-products/calca-high-strapped.svg", alt: "Segunda ilustração seed local — fixture QA", sortOrder: 1 },
    ],
    variants: [
      { id: `qa-variant-${index}-m`, productId: `qa-product-${index}`, size: "M", stock: 4, reservedStock: 1, active: true, sku: `QA-${index}-M` },
      { id: `qa-variant-${index}-g`, productId: `qa-product-${index}`, size: "G", stock: 0, reservedStock: 0, active: true, sku: `QA-${index}-G` },
    ],
    ...changes,
  } as unknown as StorefrontProduct;
}

// These synthetic records exist only in this test directory; no writes or seeds.
export const fixtureProducts = Array.from({ length: 14 }, (_, index) => product(index + 1));
fixtureProducts[0] = product(1, { title: "QA Fixture — Camiseta", slug: "qa-camiseta" });
fixtureProducts[1] = product(2, { slug: "qa-esgotado", variants: [{ id: "qa-sold-out", size: "M", stock: 0, reservedStock: 0, active: true }] });
fixtureProducts[2] = product(3, { slug: "qa-reservado", variants: [{ id: "qa-reserved", size: "M", stock: 3, reservedStock: 3, active: true }] });
fixtureProducts[3] = product(4, { slug: "qa-variante-inativa", variants: [{ id: "qa-inactive-variant", size: "M", stock: 8, reservedStock: 0, active: false }] });
fixtureProducts[4] = product(5, { slug: "qa-sem-imagem", images: [] });
fixtureProducts[5] = product(6, { slug: "qa-imagem-ausente", images: [{ id: "qa-missing-image", url: "/qa-intentionally-missing-image.webp", alt: "Fallback de imagem ausente — QA", sortOrder: 0 }] });
fixtureProducts[6] = product(7, { slug: "qa-video-ausente", images: [{ id: "qa-missing-video", url: "/qa-intentionally-missing-video.mp4", alt: "Fallback de vídeo ausente — QA", sortOrder: 0 }, { id: "qa-video-poster", url: "/seed-products/bermuda-adidas.svg", alt: "Poster seed local — QA", sortOrder: 1 }] });
fixtureProducts[7] = product(8, { category: fixtureCategories[1], categoryId: "qa-calcas" });
fixtureProducts[8] = product(9, { category: fixtureCategories[2], categoryId: "qa-acessorios", subcategory: fixtureCategories[2].children[0], subcategoryId: "qa-bags" });
fixtureProducts[13] = product(14, { slug: "qa-produto-inativo", active: false });

export const fixtureSettings = {
  id: "store", storeName: "RARE — Fixture QA", instagramUrl: "https://www.instagram.com/rare.deptt/", whatsappNumber: null,
  whatsappDefaultMessage: "Fixture QA: nenhum atendimento será enviado.", shippingMode: "disabled", shippingInstructions: null,
  manualShippingInCents: 0, fixedShippingInCents: 0, freeShippingMinInCents: null, freeShippingThresholdInCents: null, checkoutRequiresAddress: true,
};

export const fixtureBanners: HomeBannerSlide[] = [
  { id: "qa-banner-1", eyebrow: "Fixture QA", title: "Preview local de apresentação.", description: "Sem catálogo real, pagamentos, envio ou backend.", ctaLabel: "Ver catálogo de fixtures", href: "/categoria/tudo", imageUrl: "/seed-products/conjunto-nike-tech.svg", mobileImageUrl: "/seed-products/bermuda-adidas.svg", alt: "Ilustração seed local — fixture QA", active: true, sortOrder: 0 },
  { id: "qa-banner-2", eyebrow: "Fixture QA", title: "Estados visuais isolados.", description: "Disponível, esgotado, reservado e fallback de mídia.", ctaLabel: "Ver fixture principal", href: "/produto/qa-camiseta", imageUrl: "/seed-products/calca-high-strapped.svg", alt: "Ilustração seed local — fixture QA", active: true, sortOrder: 1 },
];

export const fixtureCategoryTiles: HomeCategoryTiles = {
  primary: fixtureCategories.map((category) => ({ name: category.name, slug: category.slug, href: `/categoria/${category.slug}`, description: "Seleção de fixtures locais.", total: fixtureProducts.filter((item) => item.active && item.category?.slug === category.slug).length, status: "available" })),
  accessories: [{ name: "Bags", slug: "bags", href: "/categoria/bags", description: "Fixture local.", total: 1, status: "available" }],
};

export const fixtureCustomer = { id: "qa-customer", name: "Cliente Fixture QA", email: "fixture@rare.invalid", phone: null, cpf: null, active: true };
