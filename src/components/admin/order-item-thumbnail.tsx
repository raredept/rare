"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canOptimizeProductImageWithNext, getProductMediaRenderPlan } from "@/lib/product-media";

const SIZES = "80px";

/**
 * Order item thumbnail. Uses the catalog's small renditions (generated "-thumbnail" variant via
 * srcset, or the Next image optimizer for local paths), never the original file on its own when a
 * smaller one exists. Missing, video-only or failing media shows a placeholder instead of a broken
 * image icon. The parent box fixes the size, so loading does not shift the layout.
 */
export function AdminOrderItemThumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const plan = url ? getProductMediaRenderPlan({ url }, "thumbnail") : null;

  // An image that failed before hydration never reaches onError: check it once mounted.
  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) setFailed(true);
  }, [url]);

  if (!plan || failed || plan.renderAs !== "img") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-neutral-500" data-testid="admin-order-item-placeholder">
        <ImageOff className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="text-[8px] font-black uppercase leading-tight sm:text-[9px] sm:tracking-wide">Sem imagem</span>
      </div>
    );
  }

  if (canOptimizeProductImageWithNext(plan, "thumbnail")) {
    return (
      <Image
        ref={imageRef}
        src={plan.src}
        alt={alt}
        width={160}
        height={200}
        sizes={SIZES}
        quality={75}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      ref={imageRef}
      src={plan.src}
      srcSet={plan.srcSet}
      sizes={SIZES}
      alt={alt}
      width={160}
      height={200}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
