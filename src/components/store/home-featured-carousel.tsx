"use client";

import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { HomeMotionControl, useHomeCarousel } from "@/components/store/home-motion";
import { canOptimizeProductImageWithNext, getProductMediaRenderPlan, type ProductMediaAsset } from "@/lib/product-media";
import { formatMoney } from "@/lib/money";
import styles from "./home-motion.module.css";

export type HomeFeaturedSlide = { id: string; title: string; slug: string; priceInCents: number; soldOut: boolean; image: ProductMediaAsset & { alt: string } };

export function HomeFeaturedCarousel({ products }: { products: HomeFeaturedSlide[] }) {
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const eligible = products.filter((product) => !failedIds.includes(product.id));
  const { ref: carouselRef, activeIndex, playing, interactionProps, move } = useHomeCarousel(eligible.length);
  const product = eligible[activeIndex];
  if (!product) return null;
  const plan = getProductMediaRenderPlan(product.image, "card");
  const imageProps = {
    src: plan.src, alt: product.image.alt, width: plan.width, height: plan.height,
    sizes: "(max-width: 639px) calc(100vw - 80px), (max-width: 1023px) 360px, 360px",
    loading: "lazy" as const, decoding: "async" as const,
    className: "h-full w-full object-cover",
    onError: () => setFailedIds((ids) => [...ids, product.id]),
  };
  return (
    <section ref={carouselRef} aria-label="Produtos em destaque no estoque limitado" aria-roledescription="carrossel"
      data-playing={playing} className={`mx-auto w-full max-w-[360px] min-w-0 ${styles.featureViewport}`} {...interactionProps}>
      <div key={product.id} role="group" aria-roledescription="slide" aria-label={`${activeIndex + 1} de ${eligible.length}`}
        className={styles.featureSlide}>
        <Link href={`/produto/${product.slug}`} className="group block overflow-hidden rounded-lg bg-neutral-100 text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <div className="relative aspect-[4/5] overflow-hidden">
            {canOptimizeProductImageWithNext(plan, "card") ? <Image {...imageProps} alt={product.image.alt} quality={75} /> : <img {...imageProps} alt={product.image.alt} srcSet={plan.srcSet} />}
            {product.soldOut ? <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Esgotado</span> : null}
          </div>
          <div className="flex min-h-24 items-center justify-between gap-3 bg-white p-4">
            <div className="min-w-0"><h3 className="line-clamp-2 text-sm font-black leading-5">{product.title}</h3><p className="mt-1 font-black">{formatMoney(product.priceInCents)}</p></div>
            <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </div>
        </Link>
      </div>
      {eligible.length > 1 ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Produto em destaque anterior" onClick={() => move(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          <span className="min-w-9 text-center text-xs font-bold text-white/75" aria-live={playing ? "off" : "polite"} aria-atomic="true">{activeIndex + 1}/{eligible.length}</span>
          <button type="button" aria-label="Próximo produto em destaque" onClick={() => move(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <HomeMotionControl />
      </div> : null}
    </section>
  );
}
