import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/(protected)/categories/actions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const topCategories = categories.filter((category) => !category.parentId);

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Categorias</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form action={saveCategoryAction} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Nova categoria</h2>
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
          <input name="sortOrder" type="number" min={0} defaultValue={0} className="admin-input" />
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="active" type="checkbox" defaultChecked className="h-4 w-4" />
            Ativa
          </label>
          <button className="h-11 w-full rounded-lg bg-black text-sm font-black text-white">Salvar</button>
        </form>

        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="scrollbar-none overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[1fr_150px_90px_150px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500">
                <span>Nome</span>
                <span>Categoria pai</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              <div className="divide-y divide-neutral-200">
                {categories.map((category) => (
                  <div key={category.id} className="grid grid-cols-[1fr_150px_90px_150px] items-center px-5 py-4 text-sm">
                    <div>
                      <p className="font-black text-neutral-950">{category.name}</p>
                      <p className="text-xs font-semibold text-neutral-500">/{category.slug}</p>
                    </div>
                    <span className="font-semibold text-neutral-600">{category.parent?.name ?? "-"}</span>
                    <span className="font-bold text-neutral-700">{category.active ? "Ativa" : "Oculta"}</span>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/categories/${category.id}/edit`}
                        className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-black"
                      >
                        Editar
                      </Link>
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
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
