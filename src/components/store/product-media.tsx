"use client";

import { useState } from "react";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { getProductMediaTypeFromUrl } from "@/lib/product-media";

type ProductMediaProps = {
  url: string;
  alt: string;
  className?: string;
  controls?: boolean;
  height?: number;
  loading?: "eager" | "lazy";
  placeholderLabel?: string;
  poster?: string;
  preload?: "none" | "metadata" | "auto";
  sizes?: string;
  width?: number;
};

export function ProductMedia({
  url,
  alt,
  className = "",
  controls = false,
  height,
  loading = "lazy",
  placeholderLabel = "Mídia indisponível",
  poster,
  preload,
  sizes,
  width,
}: ProductMediaProps) {
  const [failed, setFailed] = useState(false);
  const mediaType = getProductMediaTypeFromUrl(url);

  if (failed) {
    return <ProductMediaPlaceholder label={placeholderLabel} className={className} />;
  }

  if (mediaType === "video") {
    return (
      <video
        src={url}
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
      src={url}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
