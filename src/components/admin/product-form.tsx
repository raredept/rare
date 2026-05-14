import { saveProductAction } from "@/app/admin/(protected)/products/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { formatMoney } from "@/lib/money";
import type { ReactNode } from "react";

type ProductFormProps = {
  product?: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    brand: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    priceInCents: number;
    compareAtPriceInCents: number | null;
    weightGrams: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    active: boolean;
    featured: boolean;
    sortOrder: number;
    images: { url: string }[];
    variants: { size: string; stock: number; sku: string | null }[];
  };
  categories: { id: string; name: string; parentId: string | null }[];
  error?: string;
};

export function ProductForm({ product, categories, error }: ProductFormProps) {
  const action = saveProductAction.bind(null, product?.id ?? null);
  const topCategories = categories.filter((category) => !category.parentId);
  const subcategories = categories.filter((category) => category.parentId);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" encType="multipart/form-data">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 lg:col-span-2" role="alert">
          {error}
        </div>
      ) : null}
      <section className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <Field label="Título">
          <input name="title" defaultValue={product?.title} required className="admin-input" />
        </Field>
        <Field label="Slug">
          <input name="slug" defaultValue={product?.slug} placeholder="gerado automaticamente se vazio" className="admin-input" />
        </Field>
        <Field label="Descrição curta">
          <input name="shortDescription" defaultValue={product?.shortDescription} required className="admin-input" />
        </Field>
        <Field label="Descrição">
          <textarea name="description" defaultValue={product?.description} required rows={6} className="admin-input min-h-40" />
        </Field>
        <Field label="Marca">
          <input name="brand" defaultValue={product?.brand ?? ""} className="admin-input" />
        </Field>
      </section>

      <aside className="space-y-5">
        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <Field label="Preço">
            <input name="price" defaultValue={product ? formatMoney(product.priceInCents) : ""} required className="admin-input" />
          </Field>
          <Field label="Preço comparativo">
            <input
              name="compareAtPrice"
              defaultValue={product?.compareAtPriceInCents ? formatMoney(product.compareAtPriceInCents) : ""}
              className="admin-input"
            />
          </Field>
          <Field label="Categoria">
            <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="admin-input">
              <option value="">Sem categoria</option>
              {topCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subcategoria">
            <select name="subcategoryId" defaultValue={product?.subcategoryId ?? ""} className="admin-input">
              <option value="">Sem subcategoria</option>
              {subcategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordem na home">
            <input name="sortOrder" type="number" min={0} defaultValue={product?.sortOrder ?? 0} className="admin-input" />
          </Field>
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="active" type="checkbox" defaultChecked={product?.active ?? true} className="h-4 w-4" />
            Produto ativo
          </label>
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} className="h-4 w-4" />
            Destaque na home
          </label>
        </section>

        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-neutral-500">Dados para frete futuro</h2>
            <p className="mt-1 text-xs font-semibold text-neutral-500">
              Essas medidas serao usadas para calculo de frete real em fase futura.
            </p>
          </div>
          <Field label="Peso em gramas">
            <input name="weightGrams" type="number" min={1} step={1} defaultValue={product?.weightGrams ?? ""} className="admin-input" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Altura (cm)">
              <input name="heightCm" type="number" min={1} step={1} defaultValue={product?.heightCm ?? ""} className="admin-input" />
            </Field>
            <Field label="Largura (cm)">
              <input name="widthCm" type="number" min={1} step={1} defaultValue={product?.widthCm ?? ""} className="admin-input" />
            </Field>
            <Field label="Comprimento (cm)">
              <input name="lengthCm" type="number" min={1} step={1} defaultValue={product?.lengthCm ?? ""} className="admin-input" />
            </Field>
          </div>
        </section>

        <ProductImageManager images={product?.images ?? []} />

        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <Field label="Variações / estoque">
            <textarea
              name="variants"
              required
              rows={6}
              defaultValue={product?.variants.map((variant) => `${variant.size}:${variant.stock}${variant.sku ? `:${variant.sku}` : ""}`).join("\n")}
              placeholder={"P:2\nM:5\nÚnico:4"}
              className="admin-input font-mono"
            />
          </Field>
          <p className="text-xs font-semibold text-neutral-500">Formato: Tamanho:Estoque ou Tamanho:Estoque:SKU.</p>
        </section>

        <AdminSubmitButton
          idleLabel={product ? "Salvar produto" : "Criar produto"}
          pendingLabel={product ? "Salvando..." : "Criando..."}
          className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white"
        />
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
