"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportFrontendError } from "@/lib/frontend-observability";

export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportFrontendError(error, window.location.pathname);
  }, [error]);

  return (
    <section className="store-shell flex min-h-[56vh] items-center py-14" aria-labelledby="storefront-error-title">
      <div className="max-w-2xl">
        <p className="store-section-label">Erro temporário</p>
        <h1 id="storefront-error-title" className="mt-4 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-5 text-base font-semibold leading-8 text-neutral-600">
          Tente novamente. Se o problema continuar, volte ao catálogo ou use os canais oficiais da RARE.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="store-button-primary">Tentar novamente</button>
          <Link href="/categoria/tudo" className="store-button-secondary">Ver catálogo</Link>
        </div>
      </div>
    </section>
  );
}
