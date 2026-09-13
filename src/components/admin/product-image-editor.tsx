"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { DEFAULT_IMAGE_FRAMING, editorPreviewUrl, getImageFrameLayout, PRODUCT_FRAME, type ImageFraming, type ProductImageEditorAsset } from "@/lib/product-image-framing";
import styles from "./product-image-editor.module.css";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-600 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40";

export default function ProductImageEditor({ asset, onApply, onCancel }: {
  asset: ProductImageEditorAsset;
  onApply: (asset: ProductImageEditorAsset) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; framing: ImageFraming } | null>(null);
  const [framing, setFraming] = useState(asset.framing);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const layout = getImageFrameLayout(asset.width, asset.height, framing);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { controller.current?.abort(); element?.close(); };
  }, []);

  function cancel() { controller.current?.abort(); onCancel(); }
  function update(key: "zoom" | "x" | "y", value: number) {
    setFraming((current) => ({ ...current, [key]: value }));
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xDistance = (PRODUCT_FRAME.width - layout.width) * rect.width / PRODUCT_FRAME.width;
    const yDistance = (PRODUCT_FRAME.height - layout.height) * rect.height / PRODUCT_FRAME.height;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    setFraming({ ...start.framing,
      x: Math.abs(xDistance) < 1 ? start.framing.x : clamp(start.framing.x + (event.clientX - start.x) / xDistance),
      y: Math.abs(yDistance) < 1 ? start.framing.y : clamp(start.framing.y + (event.clientY - start.y) / yDistance),
    });
  }
  async function apply() {
    if (busy || !ready) return;
    setBusy(true); setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/admin/product-images/editor", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ action: "apply", reference: asset.reference, framing }) });
      const result = await response.json();
      if (!response.ok || !result.asset) throw new Error(result.error ?? "Não foi possível aplicar o enquadramento.");
      if (!abort.signal.aborted) onApply(result.asset);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Falha ao aplicar. A mídia anterior foi preservada.");
    } finally { if (!abort.signal.aborted) setBusy(false); }
  }

  return <dialog ref={dialog} aria-labelledby="image-editor-title" aria-describedby="image-editor-help"
    onCancel={(event) => { event.preventDefault(); cancel(); }}
    className="m-auto max-h-[94dvh] w-[min(94vw,860px)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-950 p-4 text-neutral-100 shadow-2xl backdrop:bg-black/80 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="image-editor-title" className="text-lg font-black">Enquadrar imagem</h2>
        <p id="image-editor-help" className="mt-1 text-sm text-neutral-300">Moldura do catálogo 4:5. Arraste a foto ou use os controles. O original será preservado.</p></div>
      <button type="button" className={buttonClass} onClick={cancel} aria-label="Fechar editor"><X size={18} /></button>
    </div>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div>
        <div role="group" aria-label="Prévia do catálogo. Use as setas para reposicionar." tabIndex={0}
          className={`${styles.frame} relative mx-auto aspect-[4/5] w-full max-w-[360px] touch-none overflow-hidden rounded-lg border border-neutral-600 outline-none focus-visible:ring-2 focus-visible:ring-white`}
          onPointerDown={(event) => { if (busy) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, framing }; }}
          onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(event) => {
            if (busy || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const key = event.key === "ArrowLeft" || event.key === "ArrowRight" ? "x" : "y";
            const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -0.02 : 0.02;
            update(key, Math.max(0, Math.min(1, framing[key] + delta)));
          }}>
          <img src={editorPreviewUrl(asset.reference)} alt="Prévia do enquadramento" draggable={false}
            onLoad={() => setReady(true)} onError={() => { setReady(false); setError("Não foi possível carregar o original. Recarregue o editor."); }}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: `${layout.width / PRODUCT_FRAME.width * 100}%`, height: `${layout.height / PRODUCT_FRAME.height * 100}%`, left: `${layout.left / PRODUCT_FRAME.width * 100}%`, top: `${layout.top / PRODUCT_FRAME.height * 100}%` }} />
        </div>
        <p className="mt-2 text-center text-xs text-neutral-300">As áreas vazias são transparentes e usam o fundo do card.</p>
      </div>
      <div className="space-y-5">
        <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-2 text-sm font-bold">Como usar a foto</legend>
          {([ ["cover", "Preencher com recorte"], ["contain", "Encaixar o produto inteiro"] ] as const).map(([mode, label]) =>
            <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-neutral-700 p-3 text-sm">
              <input type="radio" name="image-framing-mode" value={mode} checked={framing.mode === mode} onChange={() => setFraming({ ...framing, mode, zoom: 1 })} />{label}
            </label>)}
        </fieldset>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="sr-only">Ajustes de enquadramento</legend>
          <Range label="Zoom" value={framing.zoom} min={framing.mode === "cover" ? 1 : 0.25} max={framing.mode === "cover" ? 3 : 1} onChange={(value) => update("zoom", value)} />
          <Range label="Posição horizontal" value={framing.x} min={0} max={1} onChange={(value) => update("x", value)} />
          <Range label="Posição vertical" value={framing.y} min={0} max={1} onChange={(value) => update("y", value)} />
          <button type="button" className={buttonClass} onClick={() => setFraming({ ...DEFAULT_IMAGE_FRAMING })}><RotateCcw size={16} />Redefinir</button>
        </fieldset>
        <p className="text-xs leading-5 text-neutral-300">Aplicar atualiza esta edição do formulário. Salve o produto para publicar a imagem. Cancelar mantém a mídia anterior.</p>
        {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button type="button" className={buttonClass} onClick={cancel}>Cancelar</button>
      <button type="button" className={`${buttonClass} bg-black text-white`} disabled={busy || !ready} onClick={apply}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}{busy ? "Aplicando…" : "Aplicar enquadramento"}
      </button>
    </div>
  </dialog>;
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-sm font-bold"><span className="flex justify-between gap-3">{label}<output>{Math.round(value * 100)}%</output></span>
    <input type="range" aria-label={label} aria-valuetext={`${Math.round(value * 100)}%`} min={min} max={max} step={0.01} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 block h-11 w-full accent-white" />
  </label>;
}
