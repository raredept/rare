"use client";

import { useState } from "react";
import { ProductMediaPlaceholder } from "@/components/store/product-media-placeholder";
import { getProductMediaTypeFromUrl } from "@/lib/product-media";

type ProductMediaProps = {
  url: string;
  alt: string;
  className?: string;
  controls?: boolean;
  loading?: "eager" | "lazy";
  placeholderLabel?: string;
};

export function ProductMedia({
  url,
  alt,
  className = "",
  controls = false,
  loading = "lazy",
  placeholderLabel = "Mídia indisponível",
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
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  return <img src={url} alt={alt} loading={loading} className={className} onError={() => setFailed(true)} />;
}
