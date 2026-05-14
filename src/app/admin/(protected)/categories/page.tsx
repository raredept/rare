import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCategoryAction, saveCategoryAction, toggleCategoryActiveAction } from "@/app/admin/(protected)/categories/actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CategoriesPageProps = {
  searchParams?: Promise<{ q?: string; status?: string; parent?: string }>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps = {}) {
  const filters = (await searchParams) ?? {};
  const categories = await prisma.category.findMany({
    include: {
      parent: true,
      _count: {
        select: {
          children: true,
          products: true,
          subcategoryProducts: true,
        },
      },
    },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const topCategories = categories.filter((category) => !category.parentId);
  const query = filters.q?.trim().toLowerCase();
  const filteredCategories = categories.filter((category) => {
    const matchesQuery =
      !query ||
      category.name.toLowerCase().includes(query) ||
      category.slug.toLowerCase().includes(query) ||
      category.parent?.name.toLowerCase().includes(query);
    const matchesStatus =
      !filters.status ||
      (filters.status === "active" && category.active) ||
      (filters.status === "hidden" && !category.active);
    const matchesParent =
      !filters.parent ||
      (filters.parent === "root" && !category.parentId) ||
      (filters.parent !== "root" && category.parentId === filters.parent);

    return matchesQuery && matchesStatus && matchesParent;
  });
  const activeCount = categories.filter((category) => category.active).length;
  const hiddenCount = categories.length - activeCount;
  const subcategoryCount = categories.filter((category) => category.parentId).length;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Categorias</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Organize categorias principais, subcategorias e status de exibicao do catalogo publico.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[420px]">
          <SummaryMetric label="Ativas" value={activeCount} />
          <SummaryMetric label="Ocultas" value={hiddenCount} />
          <SummaryMetric label="Subcategorias" value={subcategoryCount} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <form action={saveCategoryAction} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-black text-neutral-950">Nova categoria</h2>
            <p className="mt-1 text-xs font-semibold text-neutral-500">Use subcategoria para itens dentro de Acessorios.</p>
          </div>
          <input name="name" placeholder="Nome" required className="admin-input" />
          <input name="slug" placeholder="Slug opcional" className="admin-input" />
          <select name="parentId" className="admin-input" defaultValue="">
            <option value="">Categoria principal</option>
            {topCategories.map((category) => (
              <option key={category.id} value={category.id}>
                Subcategoria de {category.name}
              </option>
            ))}
          </select>
          <input name="sortOrder" type="number" min={0} defaultValue={0} className="admin-input" aria-label="Ordem" />
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="active" type="checkbox" defaultChecked className="h-4 w-4" />
            Ativa
          </label>
          <button className="h-11 w-full rounded-lg bg-black text-sm font-black text-white">Salvar categoria</button>
        </form>

        <section className="space-y-4">
          <form className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_170px_210px_auto]">
            <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar por nome, slug ou pai" className="admin-input" />
            <select name="status" defaultValue={filters.status ?? ""} className="admin-input">
              <option value="">Todos status</option>
              <option value="active">Ativas</option>
              <option value="hidden">Ocultas</option>
            </select>
            <select name="parent" defaultValue={filters.parent ?? ""} className="admin-input">
              <option value="">Todas hierarquias</option>
              <option value="root">Principais</option>
              {topCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  Subcategorias de {category.name}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
          </form>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="scrollbar-none overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1fr_180px_110px_120px_210px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500">
                  <span>Categoria</span>
                  <span>Hierarquia</span>
                  <span>Status</span>
                  <span>Uso</span>
                  <span>Acoes</span>
                </div>
                <div className="divide-y divide-neutral-200">
                  {filteredCategories.map((category) => {
                    const linkedProducts = category._count.products + category._count.subcategoryProducts;
                    return (
                      <div key={category.id} className="grid grid-cols-[1fr_180px_110px_120px_210px] items-center px-5 py-4 text-sm">
                        <div>
                          <p className="font-black text-neutral-950">{category.name}</p>
                          <p className="mt-1 text-xs font-semibold text-neutral-500">/{category.slug}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Ordem {category.sortOrder}</p>
                        </div>
                        <div className="text-sm font-semibold text-neutral-600">
                          <p>{category.parent ? "Subcategoria" : "Principal"}</p>
                          <p className="mt-1 text-xs text-neutral-500">{category.parent?.name ?? "Sem categoria pai"}</p>
                        </div>
                        <Badge tone={category.active ? "neutral" : "muted"}>{category.active ? "Ativa" : "Oculta"}</Badge>
                        <div className="text-xs font-bold text-neutral-500">
                          <p>{linkedProducts} produto(s)</p>
                          <p>{category._count.children} subcategoria(s)</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/categories/${category.id}/edit`}
                            className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black"
                          >
                            Editar
                          </Link>
                          <form action={toggleCategoryActiveAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <input type="hidden" name="active" value={String(category.active)} />
                            <button className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black" type="submit">
                              {category.active ? "Ocultar" : "Ativar"}
                            </button>
                          </form>
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <ConfirmButton
                              type="submit"
                              message="Excluir categoria? Produtos vinculados ficarão sem esta categoria."
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700"
                            >
                              Excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {!filteredCategories.length ? (
              <div className="border-t border-neutral-200 px-6 py-12 text-center">
                <h2 className="text-base font-black text-neutral-950">Nenhuma categoria encontrada</h2>
                <p className="mt-2 text-sm text-neutral-500">Revise a busca ou limpe os filtros para voltar a lista completa.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
      <p className="text-lg font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" }) {
  const classes = {
    neutral: "border-emerald-200 bg-emerald-50 text-emerald-700",
    muted: "border-neutral-200 bg-neutral-50 text-neutral-500",
  };

  return <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
