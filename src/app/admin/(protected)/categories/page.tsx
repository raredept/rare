import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCategoryAction, saveCategoryAction, toggleCategoryActiveAction } from "@/app/admin/(protected)/categories/actions";
import { accessoryCatalogSubcategories } from "@/lib/catalog-categories";
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
  const childrenByParent = new Map<string, typeof categories>();
  for (const category of categories) {
    if (!category.parentId) continue;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category]);
  }
  const orderedCategories = [
    ...topCategories.flatMap((category) => [category, ...(childrenByParent.get(category.id) ?? [])]),
    ...categories.filter((category) => category.parentId && !categories.some((parent) => parent.id === category.parentId)),
  ];
  const query = filters.q?.trim().toLowerCase();
  const filteredCategories = orderedCategories.filter((category) => {
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
  const accessoriesCategory = topCategories.find((category) => category.slug === "acessorios");
  const accessoryChildren = categories.filter((category) => category.parentId === accessoriesCategory?.id);
  const accessoryChecklist = accessoryCatalogSubcategories.map((expected) => ({
    expected,
    category: accessoryChildren.find((category) => category.slug === expected.slug),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Catalogo</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Categorias</h1>
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

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
        <form action={saveCategoryAction} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
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
          <AdminSubmitButton
            idleLabel="Salvar categoria"
            pendingLabel="Salvando..."
            className="h-11 w-full rounded-lg bg-black text-sm font-black text-white"
          />
        </form>

        <section className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <h2 className="text-sm font-black uppercase tracking-wide text-neutral-300">Acessórios no dropdown</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-neutral-500">
            Itens esperados para o menu publico. A ordem vem do catalogo e respeita o cadastro ativo no banco.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={accessoriesCategory?.active ? "neutral" : "muted"}>Ver todos</Badge>
            {accessoryChecklist.map(({ expected, category }) => (
              <Badge key={expected.slug} tone={category?.active ? "neutral" : "muted"}>
                {expected.name}
              </Badge>
            ))}
          </div>
          {!accessoriesCategory || accessoryChecklist.some((item) => !item.category) ? (
            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100">
              Revise o banco: alguma subcategoria esperada de Acessorios nao foi encontrada.
            </p>
          ) : null}
        </section>
        </div>

        <section className="space-y-4">
          <form className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] md:grid-cols-[minmax(0,1fr)_170px_210px_auto]">
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

          <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/80 shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <div className="scrollbar-none overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1fr_180px_110px_120px_210px] bg-black px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500">
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
                      <div
                        key={category.id}
                        className="grid grid-cols-[1fr_180px_110px_120px_210px] items-center px-5 py-4 text-sm transition hover:bg-white/[0.03]"
                      >
                        <div>
                          <p className={`font-black text-neutral-950 ${category.parent ? "pl-5" : ""}`}>
                            {category.parent ? "Sub / " : ""}
                            {category.name}
                          </p>
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
                            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black"
                          >
                            Editar
                          </Link>
                          <form action={toggleCategoryActiveAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <input type="hidden" name="active" value={String(category.active)} />
                            <AdminSubmitButton
                              idleLabel={category.active ? "Ocultar" : "Ativar"}
                              pendingLabel={category.active ? "Ocultando..." : "Ativando..."}
                              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black"
                            />
                          </form>
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <ConfirmButton
                              type="submit"
                              message="Excluir categoria? Produtos vinculados ficarão sem esta categoria."
                              pendingChildren="Excluindo..."
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="border-t border-neutral-800 px-6 py-12 text-center">
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
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-3 shadow-[0_14px_45px_rgba(0,0,0,0.18)]">
      <p className="text-lg font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" }) {
  const classes = {
    neutral: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    muted: "border-neutral-700 bg-neutral-900 text-neutral-400",
  };

  return <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}
