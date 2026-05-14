"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function StoreLogo() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      href="/"
      aria-label="RARE"
      className="relative inline-flex h-12 w-[118px] shrink-0 items-center justify-start rounded-sm text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-[132px] lg:h-14 lg:w-[176px]"
    >
      {imageFailed ? (
        <span className="text-xl font-black tracking-[0.18em] text-white">RARE</span>
      ) : (
        <Image
          src="/brand/rare-logo.png"
          alt="RARE"
          fill
          sizes="(min-width: 1024px) 176px, (min-width: 640px) 132px, 118px"
          loading="eager"
          fetchPriority="high"
          className="object-contain object-left"
          onError={() => setImageFailed(true)}
        />
      )}
    </Link>
  );
}
