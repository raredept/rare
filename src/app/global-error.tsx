"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportFrontendError } from "@/lib/frontend-observability";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportFrontendError(error, typeof window === "undefined" ? "/" : window.location.pathname);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-50 text-neutral-950">
        <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-16 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-600">RARE</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">A loja encontrou um erro temporário.</h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-neutral-600">
              Nenhum dado interno foi exibido. Tente recarregar ou volte para a página inicial.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={reset} className="min-h-12 rounded-md bg-black px-5 text-xs font-black uppercase tracking-[0.16em] text-white">Tentar novamente</button>
              <Link href="/" className="inline-flex min-h-12 items-center rounded-md border border-neutral-300 bg-white px-5 text-xs font-black uppercase tracking-[0.16em] text-neutral-950">Ir para a Home</Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
