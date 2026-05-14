import { notFound } from "next/navigation";
import { saveCategoryAction } from "@/app/admin/(protected)/categories/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const [category, categories] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findMany({ where: { id: { not: id }, parentId: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  if (!category) notFound();

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Editar categoria</h1>
      <form action={saveCategoryAction} className="mt-6 max-w-xl space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <input type="hidden" name="id" value={category.id} />
        <input name="name" defaultValue={category.name} required className="admin-input" />
        <input name="slug" defaultValue={category.slug} className="admin-input" />
        <select name="parentId" defaultValue={category.parentId ?? ""} className="admin-input">
          <option value="">Categoria principal</option>
          {categories.map((parent) => (
            <option key={parent.id} value={parent.id}>
              Subcategoria de {parent.name}
            </option>
          ))}
        </select>
        <input name="sortOrder" type="number" min={0} defaultValue={category.sortOrder} className="admin-input" />
        <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
          <input name="active" type="checkbox" defaultChecked={category.active} className="h-4 w-4" />
          Ativa
        </label>
        <AdminSubmitButton
          idleLabel="Salvar categoria"
          pendingLabel="Salvando..."
          className="h-11 rounded-lg bg-black px-6 text-sm font-black text-white"
        />
      </form>
    </div>
  );
}
