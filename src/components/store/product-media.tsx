"use client";

import { useState, type RefObject } from "react";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import {
  getProductMediaRenderPlan,
  type ProductMediaAsset,
  type ProductMediaContext,
} from "@/lib/product-media";

type ProductMediaProps = {
  media: ProductMediaAsset;
  alt: string;
  context: ProductMediaContext;
  className?: string;
  controls?: boolean;
  placeholderLabel?: string;
  poster?: string;
  preload?: "none" | "metadata" | "auto";
  priority?: boolean;
  imageRef?: RefObject<HTMLImageElement | null>;
};

export function ProductMedia({
  media,
  alt,
  context,
  className = "",
  controls = false,
  placeholderLabel = "Mídia indisponível",
  poster,
  preload,
  priority,
  imageRef,
}: ProductMediaProps) {
  const [failed, setFailed] = useState(false);
  const renderPlan = getProductMediaRenderPlan(media, context, { priority });

  if (failed || renderPlan.renderAs === "placeholder") {
    return <ProductMediaPlaceholder label={placeholderLabel} className={className} />;
  }

  if (renderPlan.renderAs === "video") {
    return (
      <video
        src={renderPlan.src}
        aria-label={alt}
        className={className}
        controls={controls}
        muted={!controls}
        playsInline
        loop={!controls}
        poster={poster}
        preload={preload ?? (controls ? "metadata" : "none")}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      ref={imageRef}
      src={renderPlan.src}
      srcSet={renderPlan.srcSet}
      alt={alt}
      width={renderPlan.width}
      height={renderPlan.height}
      sizes={renderPlan.sizes}
      loading={renderPlan.loading}
      decoding={renderPlan.decoding}
      fetchPriority={renderPlan.fetchPriority}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
