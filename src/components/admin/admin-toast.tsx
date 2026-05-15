"use client";

import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "warning" | "info";

type ToastState = {
  key: string;
  tone: ToastTone;
  message: string;
};

const successMessages = new Map([
  ["product-created", "Produto criado com sucesso."],
  ["product-saved", "Produto salvo com sucesso."],
  ["product-hidden", "Produto ocultado."],
  ["product-visible", "Produto ativado."],
  ["product-deleted", "Produto removido."],
  ["category-created", "Categoria criada com sucesso."],
  ["category-saved", "Categoria salva com sucesso."],
  ["category-hidden", "Categoria ocultada."],
  ["category-visible", "Categoria ativada."],
  ["category-deleted", "Categoria removida."],
  ["banner-created", "Banner criado com sucesso."],
  ["banner-saved", "Banner salvo com sucesso."],
  ["banner-hidden", "Banner ocultado."],
  ["banner-visible", "Banner ativado."],
  ["banner-removed", "Banner removido."],
  ["banner-reordered", "Ordem dos banners atualizada."],
  ["settings-saved", "Configurações salvas."],
  ["order-status-saved", "Status do pedido atualizado."],
]);

const errorMessages = new Map([
  ["product-save-failed", "Não foi possível salvar o produto."],
  ["category-save-failed", "Não foi possível salvar a categoria."],
  ["banner-save-failed", "Não foi possível salvar o banner."],
  ["settings-save-failed", "Não foi possível salvar as configurações."],
  ["order-status-failed", "Não foi possível atualizar o pedido."],
]);

function resolveToast(success: string | null, error: string | null): ToastState | null {
  if (error) {
    return {
      key: `error:${error}`,
      tone: "error",
      message: errorMessages.get(error) ?? error,
    };
  }

  if (success) {
    return {
      key: `success:${success}`,
      tone: "success",
      message: successMessages.get(success) ?? success,
    };
  }

  return null;
}

export function AdminToast() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const nextToast = useMemo(() => resolveToast(success, error), [success, error]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const toast = nextToast && dismissedKey !== nextToast.key ? nextToast : null;

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setDismissedKey(toast.key), 5200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) return null;

  const toneClass = {
    success: "border-emerald-400/35 bg-emerald-500/15 text-emerald-50",
    error: "border-red-400/35 bg-red-500/15 text-red-50",
    warning: "border-amber-400/35 bg-amber-500/15 text-amber-50",
    info: "border-sky-400/35 bg-sky-500/15 text-sky-50",
  }[toast.tone];

  return (
    <div
      key={toast.key}
      className={`admin-toast fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm font-bold shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur md:right-6 md:top-6 ${toneClass}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <span className="min-w-0 flex-1 leading-5">{toast.message}</span>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/70 transition hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        onClick={() => setDismissedKey(toast.key)}
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
