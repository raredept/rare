import { saveProductAction } from "@/app/admin/(protected)/products/actions";
import { AdminFixedSaveBar } from "@/components/admin/admin-fixed-save-bar";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AdminUnsavedChanges } from "@/components/admin/admin-unsaved-changes";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { ProductVariantsEditor } from "@/components/admin/product-variants-editor";
import { sortProductFormCategoryOptions } from "@/lib/admin-category-options";
import { formatMoney } from "@/lib/money";
import type { ReactNode } from "react";
import { STOCK_POLICY_LABELS, type StockPolicy } from "@/lib/stock-policy";
import { PRODUCT_SHIPPING_LIMITS, type ProductShippingField } from "@/lib/product-shipping-readiness";

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
    featuredSortOrder: number | null;
    images: { id?: string; url: string }[];
    variants: { size: string; stock: number; sku: string | null }[];
    stockPolicy?: StockPolicy;
  };
  categories: { id: string; name: string; parentId: string | null; active?: boolean }[];
  error?: string;
  shippingDraft?: Partial<Record<ProductShippingField, string>>;
  /** Current place of the product in the manual catalog order (1 = first) and the list size. */
  catalogPosition?: { position: number; total: number };
};

export function ProductForm({ product, categories, error, shippingDraft, catalogPosition }: ProductFormProps) {
  const action = saveProductAction.bind(null, product?.id ?? null);
  const activeCategories = categories.filter((category) => category.active !== false);
  const topCategories = sortProductFormCategoryOptions(activeCategories.filter((category) => !category.parentId));
  const subcategories = sortProductFormCategoryOptions(activeCategories.filter((category) => category.parentId));

  return (
    <form id="admin-product-form" action={action} className="grid gap-6 pb-24 xl:grid-cols-[minmax(0,1fr)_420px] xl:pb-0">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 xl:col-span-2" role="alert">
          {error}
        </div>
      ) : null}

      <div className="min-w-0 space-y-6">
        <section className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título">
              <input name="title" defaultValue={product?.title} required className="admin-input" />
            </Field>
            <Field label="Slug">
              <input name="slug" defaultValue={product?.slug} placeholder="gerado automaticamente se vazio" className="admin-input" />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field label="Descrição curta">
              <input name="shortDescription" defaultValue={product?.shortDescription} required className="admin-input" />
            </Field>
            <Field label="Marca">
              <input name="brand" defaultValue={product?.brand ?? ""} className="admin-input" />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea name="description" defaultValue={product?.description} required rows={5} className="admin-input min-h-32" />
          </Field>
        </section>

        <ProductImageManager images={product?.images ?? []} />
      </div>

      <aside aria-label="Preço, categoria e publicação" className="space-y-5">
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
          <Field
            label="Posição no catálogo"
            help={
              product && catalogPosition
                ? `Hoje é a ${catalogPosition.position}ª de ${catalogPosition.total} peças. 1 = primeira da loja; as outras peças andam uma casa. Peças esgotadas aparecem depois das disponíveis.`
                : "1 = primeira da loja (padrão para peça nova); as outras peças andam uma casa. Peças esgotadas aparecem depois das disponíveis."
            }
          >
            <input
              name="catalogPosition"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              required
              defaultValue={product ? (catalogPosition?.position ?? "") : 1}
              className="admin-input"
            />
          </Field>
          {product && catalogPosition ? <input type="hidden" name="originalCatalogPosition" value={catalogPosition.position} /> : null}
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="active" type="checkbox" defaultChecked={product?.active ?? true} className="h-4 w-4" />
            Produto ativo
          </label>
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="featured" type="checkbox" defaultChecked={product?.featured ?? false} className="h-4 w-4" />
            Produto em destaque
          </label>
          <Field label="Ordem nos destaques" help="Produtos com número menor aparecem primeiro em Destaques do mês e na home. Ative o destaque para usar essa ordem. Não muda a posição no catálogo geral.">
            <input
              name="featuredSortOrder"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              defaultValue={product?.featuredSortOrder ?? ""}
              placeholder="Ex.: 1"
              className="admin-input"
            />
          </Field>
        </section>

        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-neutral-500">Dados para frete automático</h2>
            <p className="mt-1 text-xs font-semibold text-neutral-500">
              Produtos ativos precisam ter peso e medidas reais maiores que zero. Inativos podem ficar vazios ate completar o cadastro.
            </p>
          </div>
          <Field label="Peso em gramas">
            <input name="weightGrams" type="number" min={1} max={PRODUCT_SHIPPING_LIMITS.weightGrams.max} step={1} inputMode="numeric" defaultValue={shippingDraft?.weightGrams ?? product?.weightGrams ?? ""} className="admin-input" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Altura (cm)">
              <input name="heightCm" type="number" min={1} max={PRODUCT_SHIPPING_LIMITS.heightCm.max} step={1} inputMode="numeric" defaultValue={shippingDraft?.heightCm ?? product?.heightCm ?? ""} className="admin-input" />
            </Field>
            <Field label="Largura (cm)">
              <input name="widthCm" type="number" min={1} max={PRODUCT_SHIPPING_LIMITS.widthCm.max} step={1} inputMode="numeric" defaultValue={shippingDraft?.widthCm ?? product?.widthCm ?? ""} className="admin-input" />
            </Field>
            <Field label="Comprimento (cm)">
              <input name="lengthCm" type="number" min={1} max={PRODUCT_SHIPPING_LIMITS.lengthCm.max} step={1} inputMode="numeric" defaultValue={shippingDraft?.lengthCm ?? product?.lengthCm ?? ""} className="admin-input" />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          <Field
            label="Política de estoque"
            help="Padrão: item de reposição, com alerta de estoque baixo, crítico e esgotado. Única: peça única — 1 unidade é o normal, 0 após a venda significa vendida e nunca gera alerta; aceita no máximo 1 unidade no total."
          >
            <select name="stockPolicy" defaultValue={product?.stockPolicy ?? "STANDARD"} className="admin-input">
              <option value="STANDARD">{STOCK_POLICY_LABELS.STANDARD} (reposição)</option>
              <option value="UNIQUE">{STOCK_POLICY_LABELS.UNIQUE} (peça única)</option>
            </select>
          </Field>
          <ProductVariantsEditor variants={product?.variants ?? []} />
        </section>

        <div className="hidden xl:block">
          <AdminSubmitButton
            idleLabel={product ? "Salvar produto" : "Criar produto"}
            pendingLabel={product ? "Salvando..." : "Criando..."}
            className="h-12 w-full rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white"
          />
          <p className="mt-2 text-center"><AdminUnsavedChanges formId="admin-product-form" /></p>
        </div>
      </aside>
      {/* UIUX-ADMIN-004: below 1280 px the only save button used to sit at the very end of a ~4.000 px
          page; it now stays fixed at the bottom of the screen (portaled, see AdminFixedSaveBar). Same
          form, same action; the form's pb-24 keeps its last fields clear of the bar. */}
      <AdminFixedSaveBar className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur xl:hidden">
        <AdminSubmitButton
          form="admin-product-form"
          idleLabel={product ? "Salvar produto" : "Criar produto"}
          pendingLabel={product ? "Salvando..." : "Criando..."}
          className="h-12 flex-1 rounded-lg bg-black text-sm font-black uppercase tracking-wide text-white sm:max-w-xs"
        />
        <AdminUnsavedChanges formId="admin-product-form" />
      </AdminFixedSaveBar>
    </form>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
      {help ? <span className="mt-2 block text-xs font-semibold leading-5 text-neutral-500">{help}</span> : null}
    </label>
  );
}
