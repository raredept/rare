"use client";

import { useState } from "react";

type ProductCardHoverImageProps = {
  src: string;
};

export function ProductCardHoverImage({ src }: ProductCardHoverImageProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setHidden(true)}
      className="store-product-hover-image pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
    />
  );
}
