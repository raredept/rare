"use client";

import { useActionState, useMemo, useState } from "react";
import { savePromotionAction, type PromotionFormState } from "@/app/admin/(protected)/promotions/actions";
import { formatMoney } from "@/lib/money";
import { computePromotionDiscount } from "@/lib/promotions/engine";

export type PromotionFormValues = {
  id?: string;
  name: string;
  slug: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: string;
  scope: "ALL_PRODUCTS" | "SELECTED_PRODUCTS" | "SELECTED_CATEGORIES";
  startsAt: string;
  endsAt: string;
  priority: number;
  homepageFeatured: boolean;
  badgeText: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  bannerImageUrl: string;
  bannerMobileImageUrl: string;
  bannerAlt: string;
  productIds: string[];
  categoryIds: string[];
};

type ProductOption = { id: string; title: string; priceInCents: number; active: boolean; categoryId: string | null; subcategoryId: string | null };
type CategoryOption = { id: string; label: string };

const label = "mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500";

function parsePreviewValue(type: PromotionFormValues["type"], raw: string) {
  if (!raw.trim()) return null;
  if (type === "PERCENTAGE") {
    const value = Number(raw.replace(",", ".").replace("%", ""));
    return Number.isInteger(value) ? value : null;
  }
  const normalized = Number(raw.replace(/\s/g, "").replace(/[R$]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : null;
}

export function PromotionForm({ values, products, categories }: { values: PromotionFormValues; products: ProductOption[]; categories: CategoryOption[] }) {
  const [state, formAction, pending] = useActionState<PromotionFormState, FormData>(savePromotionAction, {});
  const [type, setType] = useState(values.type);
  const [rawValue, setRawValue] = useState(values.value);
  const [scope, setScope] = useState(values.scope);
  const [selectedProducts, setSelectedProducts] = useState(new Set(values.productIds));
  const [selectedCategories, setSelectedCategories] = useState(new Set(values.categoryIds));
  const [filter, setFilter] = useState("");

  const targeted = useMemo(() => products.filter((product) => {
    if (!product.active) return false;
    if (scope === "ALL_PRODUCTS") return true;
    if (scope === "SELECTED_PRODUCTS") return selectedProducts.has(product.id);
    return Boolean((product.categoryId && selectedCategories.has(product.categoryId)) || (product.subcategoryId && selectedCategories.has(product.subcategoryId)));
  }), [products, scope, selectedCategories, selectedProducts]);
  const previewValue = parsePreviewValue(type, rawValue);
  const preview = targeted.slice(0, 12).map((product) => {
    const discount = computePromotionDiscount({ type, value: previewValue }, product.priceInCents);
    return { ...product, finalPriceInCents: discount === null ? null : product.priceInCents - discount };
  });
  const notApplicable = targeted.filter((product) => computePromotionDiscount({ type, value: previewValue }, product.priceInCents) === null).length;
  const visibleProducts = products.filter((product) => product.title.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 200);

  function toggle(set: Set<string>, id: string, update: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  }

  return (
    <form action={formAction} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" noValidate>
      {values.id ? <input type="hidden" name="promotionId" value={values.id} /> : null}
      <div className="min-w-0 space-y-6">
        {state.errors?.length ? (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">
            <p className="font-black">Revise a promoção:</p>
            <ul className="mt-2 list-disc pl-5">{state.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}

        <fieldset className="grid min-w-0 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <legend className="px-1 text-sm font-black text-neutral-950">Identificação</legend>
          <label className="block sm:col-span-2"><span className={label}>Nome</span><input name="name" required maxLength={120} defaultValue={values.name} className="admin-input" /></label>
          <label className="block"><span className={label}>Código interno</span><input name="slug" maxLength={80} defaultValue={values.slug} placeholder="gerado a partir do nome" className="admin-input" /></label>
          <label className="block"><span className={label}>Prioridade</span><input name="priority" type="number" min={-1000} max={1000} step={1} defaultValue={values.priority} className="admin-input" />
            <span className="mt-1 block text-xs text-neutral-500">Maior vence quando duas promoções valem para o mesmo produto.</span></label>
        </fieldset>

        <fieldset className="grid min-w-0 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <legend className="px-1 text-sm font-black text-neutral-950">Desconto e período (horário de Brasília)</legend>
          <label className="block"><span className={label}>Tipo</span>
            <select name="type" value={type} onChange={(event) => setType(event.target.value as PromotionFormValues["type"])} className="admin-input">
              <option value="PERCENTAGE">Percentual (%)</option>
              <option value="FIXED_AMOUNT">Valor fixo (R$)</option>
            </select></label>
          <label className="block"><span className={label}>{type === "PERCENTAGE" ? "Percentual (1 a 100)" : "Valor do desconto (R$)"}</span>
            <input name="value" inputMode="decimal" value={rawValue} onChange={(event) => setRawValue(event.target.value)} className="admin-input" placeholder={type === "PERCENTAGE" ? "ex.: 25" : "ex.: 50,00"} /></label>
          <label className="block"><span className={label}>Início</span><input name="startsAt" type="datetime-local" defaultValue={values.startsAt} className="admin-input" /></label>
          <label className="block"><span className={label}>Fim</span><input name="endsAt" type="datetime-local" defaultValue={values.endsAt} className="admin-input" /></label>
          <p className="text-xs text-neutral-500 sm:col-span-2">Sem início: vale assim que for ativada. Sem fim: vale até ser pausada ou encerrada. O contador da home só aparece com data de fim.</p>
        </fieldset>

        <fieldset className="min-w-0 rounded-lg border border-neutral-200 bg-white p-5">
          <legend className="px-1 text-sm font-black text-neutral-950">Escopo</legend>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            {([["ALL_PRODUCTS", "Todos os produtos"], ["SELECTED_PRODUCTS", "Produtos selecionados"], ["SELECTED_CATEGORIES", "Categorias selecionadas"]] as const).map(([value, text]) => (
              <label key={value} className="inline-flex items-center gap-2"><input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} />{text}</label>
            ))}
          </div>
          {scope === "SELECTED_PRODUCTS" ? (
            <div className="mt-4">
              <label className="block"><span className={label}>Filtrar produtos</span><input value={filter} onChange={(event) => setFilter(event.target.value)} className="admin-input" placeholder="nome do produto" /></label>
              <p className="mt-2 text-xs text-neutral-500">{selectedProducts.size} selecionado(s)</p>
              <ul className="mt-2 max-h-72 overflow-y-auto rounded border border-neutral-200">
                {visibleProducts.map((product) => (
                  <li key={product.id} className="border-b border-neutral-100 last:border-0">
                    <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggle(selectedProducts, product.id, setSelectedProducts)} />
                        <span className="truncate">{product.title}{product.active ? "" : " (oculto)"}</span></span>
                      <span className="shrink-0 text-xs text-neutral-500">{formatMoney(product.priceInCents)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {scope === "SELECTED_CATEGORIES" ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <li key={category.id}><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCategories.has(category.id)} onChange={() => toggle(selectedCategories, category.id, setSelectedCategories)} />{category.label}</label></li>
              ))}
            </ul>
          ) : null}
          {[...selectedProducts].map((id) => <input key={id} type="hidden" name="productIds" value={id} />)}
          {[...selectedCategories].map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
        </fieldset>

        <fieldset className="grid min-w-0 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <legend className="px-1 text-sm font-black text-neutral-950">Comunicação (texto simples, sem HTML)</legend>
          <label className="inline-flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="homepageFeatured" defaultChecked={values.homepageFeatured} /> Destacar na página inicial</label>
          <label className="block"><span className={label}>Selo (badge)</span><input name="badgeText" maxLength={24} defaultValue={values.badgeText} className="admin-input" placeholder="ex.: BLACK FRIDAY" /></label>
          <label className="block"><span className={label}>Título</span><input name="headline" maxLength={80} defaultValue={values.headline} className="admin-input" /></label>
          <label className="block sm:col-span-2"><span className={label}>Subtítulo</span><input name="subheadline" maxLength={200} defaultValue={values.subheadline} className="admin-input" /></label>
          <label className="block"><span className={label}>Texto do botão</span><input name="ctaLabel" maxLength={40} defaultValue={values.ctaLabel} className="admin-input" /></label>
          <label className="block"><span className={label}>Link do botão (interno)</span><input name="ctaHref" maxLength={300} defaultValue={values.ctaHref} className="admin-input" placeholder="/categoria/tudo" /></label>
          <label className="block"><span className={label}>Banner desktop (URL)</span><input name="bannerImageUrl" maxLength={600} defaultValue={values.bannerImageUrl} className="admin-input" /></label>
          <label className="block"><span className={label}>Banner mobile (URL)</span><input name="bannerMobileImageUrl" maxLength={600} defaultValue={values.bannerMobileImageUrl} className="admin-input" /></label>
          <label className="block sm:col-span-2"><span className={label}>Texto alternativo do banner</span><input name="bannerAlt" maxLength={200} defaultValue={values.bannerAlt} className="admin-input" /></label>
        </fieldset>

        <button type="submit" disabled={pending} className="h-12 rounded-lg bg-black px-6 text-sm font-black text-white disabled:opacity-60">
          {pending ? "Salvando..." : values.id ? "Salvar alterações" : "Criar rascunho"}
        </button>
      </div>

      <aside className="h-fit rounded-lg border border-neutral-200 bg-white p-5 xl:sticky xl:top-24" aria-labelledby="promotion-effect-title">
        <h2 id="promotion-effect-title" className="text-sm font-black text-neutral-950">Efeito nos preços (prévia)</h2>
        <p className="mt-1 text-xs text-neutral-500">{targeted.length} produto(s) ativo(s) no escopo{notApplicable ? `, ${notApplicable} sem desconto (preço final abaixo de R$ 1,00)` : ""}. Calculado com a mesma regra do servidor; nada é salvo até você enviar.</p>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {preview.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">{product.title}</span>
              <span className="shrink-0 text-right">
                {product.finalPriceInCents === null ? (
                  <span className="text-xs text-neutral-500">não se aplica</span>
                ) : (
                  <><s className="mr-1 text-xs text-neutral-500">{formatMoney(product.priceInCents)}</s><strong>{formatMoney(product.finalPriceInCents)}</strong></>
                )}
              </span>
            </li>
          ))}
        </ul>
        {targeted.length > preview.length ? <p className="mt-2 text-xs text-neutral-500">e mais {targeted.length - preview.length}…</p> : null}
      </aside>
    </form>
  );
}
