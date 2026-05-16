export type HomeHeroSlide = {
  id: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  ctaLabel?: string;
  href?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  alt: string;
  active: boolean;
};

export const homeHeroSlides = [
  {
    id: "rare-curadoria-streetwear",
    eyebrow: "RARE",
    title: "Curadoria streetwear em drops selecionados",
    description: "Importados premium, peças de presença e estoque controlado para quem acompanha cultura de rua.",
    ctaLabel: "Ver curadoria",
    href: "/",
    imageUrl: "",
    alt: "Banner editorial RARE com curadoria streetwear",
    active: true,
  },
  {
    id: "drops-selecionados",
    eyebrow: "Drops selecionados",
    title: "Novas entradas com visual limpo e raro",
    description: "Camisetas, jaquetas, conjuntos e acessórios escolhidos para composições de impacto.",
    ctaLabel: "Explorar destaques",
    href: "/categoria/camisetas",
    imageUrl: "",
    alt: "Banner RARE para drops selecionados",
    active: true,
  },
  {
    id: "importados-premium",
    eyebrow: "Importados premium",
    title: "Peças internacionais para elevar o outfit",
    description: "Uma seleção direta, sem excesso, pensada para compra rápida e segura.",
    ctaLabel: "Comprar agora",
    href: "/categoria/acessorios",
    imageUrl: "",
    alt: "Banner RARE de importados premium",
    active: true,
  },
] satisfies HomeHeroSlide[];

export function getActiveHomeHeroSlides(slides: HomeHeroSlide[]) {
  return slides.filter((slide) => slide.active);
}

export function shouldRenderHomeHeroControls(slideCount: number) {
  return slideCount > 1;
}

export function normalizeHomeHeroSlideIndex(index: number, slideCount: number) {
  if (slideCount <= 0) return 0;
  return ((index % slideCount) + slideCount) % slideCount;
}

export function getNextHomeHeroSlideIndex(currentIndex: number, slideCount: number) {
  return normalizeHomeHeroSlideIndex(currentIndex + 1, slideCount);
}

export function getPreviousHomeHeroSlideIndex(currentIndex: number, slideCount: number) {
  return normalizeHomeHeroSlideIndex(currentIndex - 1, slideCount);
}

export function selectHomeHeroSlideIndex(targetIndex: number, slideCount: number) {
  return normalizeHomeHeroSlideIndex(targetIndex, slideCount);
}
