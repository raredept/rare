import { describe, expect, it } from "vitest";
import {
  getActiveHomeHeroSlides,
  getNextHomeHeroSlideIndex,
  getPreviousHomeHeroSlideIndex,
  normalizeHomeHeroSlideIndex,
  selectHomeHeroSlideIndex,
  shouldRenderHomeHeroControls,
  type HomeHeroSlide,
} from "@/lib/home-hero-slides";

const slides = [
  {
    id: "active-1",
    title: "Slide ativo",
    imageUrl: "",
    alt: "Slide ativo",
    active: true,
  },
  {
    id: "inactive",
    title: "Slide inativo",
    imageUrl: "",
    alt: "Slide inativo",
    active: false,
  },
  {
    id: "active-2",
    title: "Outro slide ativo",
    imageUrl: "",
    alt: "Outro slide ativo",
    active: true,
  },
] satisfies HomeHeroSlide[];

describe("home hero slides", () => {
  it("keeps only active slides in the public carousel", () => {
    const activeSlides = getActiveHomeHeroSlides(slides);

    expect(activeSlides.map((slide) => slide.id)).toEqual(["active-1", "active-2"]);
  });

  it("normalizes slide indexes for previous, next, and dots", () => {
    expect(getNextHomeHeroSlideIndex(0, 3)).toBe(1);
    expect(getNextHomeHeroSlideIndex(2, 3)).toBe(0);
    expect(getPreviousHomeHeroSlideIndex(0, 3)).toBe(2);
    expect(getPreviousHomeHeroSlideIndex(2, 3)).toBe(1);
    expect(selectHomeHeroSlideIndex(4, 3)).toBe(1);
    expect(normalizeHomeHeroSlideIndex(-4, 3)).toBe(2);
  });

  it("does not render controls when the carousel has zero or one active slide", () => {
    expect(shouldRenderHomeHeroControls(0)).toBe(false);
    expect(shouldRenderHomeHeroControls(1)).toBe(false);
    expect(shouldRenderHomeHeroControls(2)).toBe(true);
  });
});
