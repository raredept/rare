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
    id: "rare-streetwear-importado",
    eyebrow: "RARE",
    title: "Streetwear importado, escolhido a dedo.",
    description: "Peças raras para sair do básico, com estoque limitado e atendimento direto.",
    ctaLabel: "Ver catálogo",
    href: "/categoria/tudo",
    imageUrl: "",
    alt: "Banner editorial RARE com streetwear importado",
    active: true,
  },
  {
    id: "drops-limitados",
    eyebrow: "Drops limitados",
    title: "Peças raras para sair do básico.",
    description: "Camisetas, jaquetas, conjuntos e acessórios para compor o corre.",
    ctaLabel: "Ver destaques",
    href: "/categoria/destaques",
    imageUrl: "",
    alt: "Banner RARE para drops limitados",
    active: true,
  },
  {
    id: "streetwear-presenca",
    eyebrow: "Streetwear importado",
    title: "Drops para quem veste presença.",
    description: "Escolha sua peça e finalize no checkout com Pix ou cartão.",
    ctaLabel: "Comprar agora",
    href: "/categoria/tudo",
    imageUrl: "",
    alt: "Banner RARE de streetwear importado",
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
