"use client";

import { RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { shouldOfferServerActionRefresh } from "@/lib/server-action-recovery";

// UIUX-ADMIN-PROMO-001: a form opened before a deploy posts to a Server Action the new build no
// longer knows. That is not a server failure and "try again" cannot fix it — only a reload can.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isStaleScreen = shouldOfferServerActionRefresh(error);

  useEffect(() => {
    console.error("admin_route_error", { digest: error.digest, staleServerAction: isStaleScreen });
  }, [error, isStaleScreen]);

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-6" role="alert" aria-labelledby="admin-error-title">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">
        {isStaleScreen ? "Tela desatualizada" : "Algo deu errado"}
      </p>
      <h1 id="admin-error-title" className="mt-3 text-2xl font-black text-white">
        {isStaleScreen ? "Esta tela foi atualizada enquanto estava aberta." : "Não foi possível concluir esta ação."}
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        {isStaleScreen
          ? "Recarregue a página para continuar. O que ainda não tinha sido salvo precisa ser preenchido de novo — nada é reenviado automaticamente."
          : "Confira na lista se a alteração foi registrada antes de repetir. Se o problema continuar, envie o código abaixo para o suporte."}
      </p>
      {error.digest ? (
        <p className="mt-4 text-xs text-neutral-400">
          Código do erro: <code className="select-all rounded bg-black/40 px-1.5 py-0.5 font-mono text-neutral-200">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 text-sm font-black sm:flex-row">
        {isStaleScreen ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="admin-chip-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition hover:bg-neutral-200"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Recarregar página
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="admin-chip-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition hover:bg-neutral-200"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Tentar novamente
          </button>
        )}
        <Link href="/admin" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-700 px-4 text-sm font-black text-white transition hover:border-neutral-400">
          Voltar à visão geral
        </Link>
      </div>
    </section>
  );
}
