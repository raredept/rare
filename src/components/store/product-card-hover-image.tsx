"use client";

import { useState } from "react";
import Image from "next/image";
import { canOptimizeProductImageWithNext, getProductMediaRenderPlan, type ProductMediaAsset } from "@/lib/product-media";

type ProductCardHoverImageProps = {
  media: ProductMediaAsset;
};

export function ProductCardHoverImage({ media }: ProductCardHoverImageProps) {
  const [hidden, setHidden] = useState(false);
  const renderPlan = getProductMediaRenderPlan(media, "card");

  if (hidden || renderPlan.renderAs !== "img") return null;

  const className = "store-product-hover-image pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100";

  if (canOptimizeProductImageWithNext(renderPlan, "card")) {
    return (
      <Image
        src={renderPlan.src}
        alt=""
        width={renderPlan.width}
        height={renderPlan.height}
        sizes={renderPlan.sizes}
        quality={75}
        loading="lazy"
        decoding="async"
        onError={() => setHidden(true)}
        className={className}
      />
    );
  }

  return (
    <img
      src={renderPlan.src}
      srcSet={renderPlan.srcSet}
      alt=""
      width={renderPlan.width}
      height={renderPlan.height}
      sizes={renderPlan.sizes}
      loading={renderPlan.loading}
      decoding={renderPlan.decoding}
      fetchPriority={renderPlan.fetchPriority}
      onError={() => setHidden(true)}
      className={className}
    />
  );
}
