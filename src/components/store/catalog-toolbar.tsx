"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import type { CatalogBasePath } from "@/lib/catalog-pagination";
import {
  buildCatalogHref,
  CATALOG_SORT_LABELS,
  CATALOG_SORTS,
  countActiveFilters,
  type CatalogFacets,
  type CatalogPriceBand,
  type CatalogRefinements,
  type CatalogSort,
} from "@/lib/catalog-refinements";

type CatalogToolbarProps = {
  slug: string;
  query?: string;
  brand?: string;
  refinements: CatalogRefinements;
  /** Null when the scope could not offer options (e.g. older data shape): only the sort shows. */
  facets: CatalogFacets | null;
  total: number;
  /** "/colecao" on a collection page (RARE-COLLECTIONS-CART-01); the URLs keep the same query string. */
  basePath?: CatalogBasePath;
};

type Draft = { brand: string; size: string; price: string; available: boolean; promo: boolean };

/**
 * UIUX-CATALOG-001: "N produtos · [Filtrar] [Ordenar]". The filter panel is a native modal dialog
 * (focus kept inside, Esc closes): a drawer on the right from 640 px, a bottom sheet on phones. Every
 * choice lives in the URL, so a filtered page can be shared and the back button works.
 */
export function CatalogToolbar({ slug, query, brand, refinements, facets, total, basePath = "/categoria" }: CatalogToolbarProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const initialDraft: Draft = { brand: brand?.trim() ?? "", size: refinements.size ?? "", price: refinements.price ?? "", available: refinements.available, promo: refinements.promo };
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const activeFilters = countActiveFilters(refinements, brand);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function openPanel() {
    setDraft(initialDraft);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }

  function navigate(next: Partial<CatalogRefinements> & { brand?: string }) {
    router.push(buildCatalogHref(slug, { query, brand: next.brand ?? brand, ...refinements, ...next, page: 1 }, basePath));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    navigate({
      brand: draft.brand,
      size: draft.size || undefined,
      price: (draft.price || undefined) as CatalogPriceBand | undefined,
      available: draft.available,
      promo: draft.promo,
    });
  }

  function clearFilters() {
    setOpen(false);
    navigate({ brand: "", size: undefined, price: undefined, available: false, promo: false });
  }

  // A click on the backdrop (the dialog itself, outside its panel) closes it.
  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closePanel();
  }

  const radioGroup = (name: keyof Pick<Draft, "brand" | "size" | "price">, legend: string, options: { value: string; label: string; count: number }[], allLabel: string) =>
    options.length ? (
      <fieldset className="border-b border-neutral-200 py-5">
        <legend className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">{legend}</legend>
        <div className="mt-3 grid gap-1">
          {[{ value: "", label: allLabel, count: -1 }, ...options].map((option) => (
            <label key={option.value || "all"} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 has-[:checked]:bg-neutral-100 has-[:checked]:font-black">
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`${id}-${name}`}
                  value={option.value}
                  checked={draft[name] === option.value}
                  onChange={() => setDraft((current) => ({ ...current, [name]: option.value }))}
                  className="h-4 w-4 accent-black"
                />
                {option.label}
              </span>
              {option.count >= 0 ? <span className="text-xs font-bold text-neutral-500">{option.count}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
    ) : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-neutral-200 py-3" data-testid="catalog-toolbar">
      <p className="text-sm font-black text-neutral-950" aria-live="polite">
        {total} {total === 1 ? "produto" : "produtos"}
      </p>
      {/* Font on the wrapper: the global `button { font: inherit }` (UIUX-GLOBAL-001) beats classes on the button. */}
      {/* flex-wrap + max-w-full: on a 320 px phone the sort select (16 px there, so iOS does not zoom)
          cannot sit beside "Filtrar"; it drops to its own line instead of widening the page. */}
      <div className="flex max-w-full flex-wrap items-center gap-2 text-xs font-black">
        {facets ? (
          <button
            ref={openerRef}
            type="button"
            onClick={openPanel}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 px-4 text-xs font-black uppercase tracking-[0.12em] text-neutral-950 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtrar
            {activeFilters ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[11px] text-white">
                {activeFilters}
                <span className="sr-only"> {activeFilters === 1 ? "filtro ativo" : "filtros ativos"}</span>
              </span>
            ) : null}
          </button>
        ) : null}
        <label className="relative inline-flex min-h-11 max-w-full items-center rounded-full border border-neutral-300 pl-4 pr-2 text-xs font-black uppercase tracking-[0.12em] text-neutral-950 focus-within:ring-2 focus-within:ring-neutral-950 hover:border-neutral-950">
          <span className="sr-only">Ordenar por</span>
          <span aria-hidden="true" className="hidden sm:inline">Ordenar:&nbsp;</span>
          <select
            value={refinements.sort}
            onChange={(event) => navigate({ sort: event.target.value as CatalogSort })}
            className="min-h-11 cursor-pointer appearance-none bg-transparent pr-6 text-xs font-black uppercase tracking-[0.12em] outline-none"
            data-testid="catalog-sort"
          >
            {CATALOG_SORTS.map((sort) => (
              <option key={sort} value={sort}>{CATALOG_SORT_LABELS[sort]}</option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-3 text-[10px]">▾</span>
        </label>
      </div>

      {facets ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={`${id}-title`}
          onClose={() => {
            if (open) closePanel();
          }}
          onClick={onDialogClick}
          className="fixed m-0 max-h-none max-w-none flex-col bg-white p-0 text-neutral-950 shadow-2xl backdrop:bg-black/50 open:flex max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[85dvh] max-sm:w-full max-sm:rounded-t-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:w-[26rem]"
        >
          <form onSubmit={applyFilters} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
              <h2 id={`${id}-title`} className="text-lg font-black">Filtrar</h2>
              <button type="button" onClick={closePanel} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950" aria-label="Fechar filtros">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {radioGroup("brand", "Marca", facets.brands, "Todas as marcas")}
              {radioGroup("size", "Tamanho disponível", facets.sizes, "Todos os tamanhos")}
              {radioGroup("price", "Preço", facets.prices, "Qualquer preço")}
              <fieldset className="py-5">
                <legend className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Mostrar</legend>
                <div className="mt-3 grid gap-1">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" checked={draft.available} onChange={(event) => setDraft((current) => ({ ...current, available: event.target.checked }))} className="h-4 w-4 accent-black" />
                      Disponível agora
                    </span>
                    <span className="text-xs font-bold text-neutral-500">{facets.availableCount}</span>
                  </label>
                  {facets.promoCount > 0 || draft.promo ? (
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                      <span className="flex items-center gap-3">
                        <input type="checkbox" checked={draft.promo} onChange={(event) => setDraft((current) => ({ ...current, promo: event.target.checked }))} className="h-4 w-4 accent-black" />
                        Em promoção
                      </span>
                      <span className="text-xs font-bold text-neutral-500">{facets.promoCount}</span>
                    </label>
                  ) : null}
                </div>
              </fieldset>
              <p className="pb-5 text-xs font-semibold leading-5 text-neutral-500">Preço = valor da peça agora, já com promoção automática; cupom e frete entram no checkout.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-neutral-200 px-5 py-4 text-xs font-black">
              <button type="button" onClick={clearFilters} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 text-xs font-black uppercase tracking-[0.12em] hover:border-neutral-950">
                Limpar
              </button>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-neutral-800">
                Aplicar filtros
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
