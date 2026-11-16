"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { SKU_FIELD_HELP, SKU_FIELD_PLACEHOLDER, SKU_MAX_LENGTH } from "@/lib/sku";

type VariantRow = { key: number; size: string; stock: string; sku: string };

type ProductVariantsEditorProps = {
  variants: { size: string; stock: number; sku: string | null }[];
};

const removeButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35";

/**
 * One row per sellable unit: size, stock and SKU side by side. A product sold without sizes keeps
 * a single row (e.g. "Único"), whose SKU is the product's SKU. Sends variantSize / variantStock /
 * variantSku in row order.
 */
export function ProductVariantsEditor({ variants }: ProductVariantsEditorProps) {
  const nextKey = useRef(variants.length + 1);
  const [rows, setRows] = useState<VariantRow[]>(() =>
    variants.length
      ? variants.map((variant, index) => ({ key: index, size: variant.size, stock: String(variant.stock), sku: variant.sku ?? "" }))
      : [{ key: 0, size: "", stock: "", sku: "" }],
  );

  function updateRow(key: number, field: "size" | "stock" | "sku", value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    const key = nextKey.current++;
    setRows((current) => [...current, { key, size: "", stock: "", sku: "" }]);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  return (
    <fieldset className="min-w-0 space-y-3" aria-describedby="variant-sku-help">
      <legend className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Variações / estoque / SKU</legend>
      <div className="grid grid-cols-[minmax(0,3.25rem)_minmax(0,3.25rem)_minmax(0,1fr)_2.75rem] gap-2 text-[10px] font-black uppercase tracking-normal text-neutral-500" aria-hidden="true">
        <span>Tamanho</span>
        <span>Estoque</span>
        <span>SKU</span>
        <span />
      </div>
      <ul className="space-y-2" data-testid="product-variant-rows">
        {rows.map((row, index) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,3.25rem)_minmax(0,3.25rem)_minmax(0,1fr)_2.75rem] items-center gap-2">
            <input
              name="variantSize"
              value={row.size}
              onChange={(event) => updateRow(row.key, "size", event.target.value)}
              required
              maxLength={40}
              placeholder="Único"
              aria-label={`Tamanho da variação ${index + 1}`}
              className="admin-input min-w-0 px-2"
            />
            <input
              name="variantStock"
              value={row.stock}
              onChange={(event) => updateRow(row.key, "stock", event.target.value)}
              required
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              aria-label={`Estoque da variação ${index + 1}`}
              className="admin-input min-w-0 px-2"
            />
            <input
              name="variantSku"
              value={row.sku}
              onChange={(event) => updateRow(row.key, "sku", event.target.value)}
              maxLength={SKU_MAX_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              pattern="\s*[A-Za-z0-9_\-]{3,64}\s*"
              title="De 3 a 64 caracteres: letras sem acento, números, hífen (-) ou sublinhado (_)."
              placeholder={SKU_FIELD_PLACEHOLDER}
              aria-label={`SKU da variação ${index + 1}`}
              className="admin-input min-w-0 px-2 font-mono text-xs! uppercase placeholder:normal-case"
            />
            <button
              type="button"
              className={removeButtonClass}
              onClick={() => removeRow(row.key)}
              disabled={rows.length === 1}
              aria-label={`Remover variação ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Adicionar variação
      </button>
      <p id="variant-sku-help" className="text-xs font-semibold leading-5 text-neutral-500">
        <span className="font-black text-neutral-400">SKU:</span> {SKU_FIELD_HELP} Opcional e único por variação; é salvo em
        maiúsculas. Produto sem tamanhos usa uma variação só (ex.: Único).
      </p>
    </fieldset>
  );
}
