"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("admin_route_error", { digest: error.digest });
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-6" role="alert">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Falha temporária</p>
      <h1 className="mt-3 text-2xl font-black text-white">Não foi possível carregar esta área.</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        Tente novamente ou volte para a visão geral para conferir o estado atual.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="admin-chip-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition hover:bg-neutral-200"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Tentar novamente
        </button>
        <Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-700 px-4 text-sm font-black text-white transition hover:border-neutral-400">
          Voltar à visão geral
        </Link>
      </div>
    </section>
  );
}
