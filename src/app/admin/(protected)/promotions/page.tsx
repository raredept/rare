import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PromotionStatusBadge } from "@/app/admin/(protected)/promotions/status-badge";
import { requireAdmin } from "@/lib/auth";
import { formatBusinessDateTime, parseBusinessDateTime } from "@/lib/business-time";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { countTargetedProducts, effectiveStatusWhere, PROMOTION_SCOPE_LABELS, PROMOTION_STATUS_LABELS } from "@/lib/promotions/admin";
import { getEffectivePromotionStatus, type PromotionStatusValue } from "@/lib/promotions/engine";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const statuses = Object.keys(PROMOTION_STATUS_LABELS) as PromotionStatusValue[];
const sorts = {
  updated: [{ updatedAt: "desc" }],
  starts: [{ startsAt: { sort: "desc", nulls: "last" } }],
  ends: [{ endsAt: { sort: "asc", nulls: "last" } }],
  priority: [{ priority: "desc" }],
  name: [{ name: "asc" }],
} satisfies Record<string, Prisma.PromotionOrderByWithRelationInput[]>;

type SearchParams = { q?: string; status?: string; from?: string; to?: string; sort?: string; page?: string };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const filters = await searchParams;
  const now = new Date();
  const status = statuses.includes(filters.status as PromotionStatusValue) ? (filters.status as PromotionStatusValue) : null;
  const from = filters.from ? parseBusinessDateTime(`${filters.from}T00:00`) : null;
  const to = filters.to ? parseBusinessDateTime(`${filters.to}T23:59`) : null;
  const sortKey = (filters.sort && filters.sort in sorts ? filters.sort : "updated") as keyof typeof sorts;
  const page = Math.max(1, Math.min(500, Number.parseInt(filters.page ?? "1", 10) || 1));
  const query = filters.q?.trim().slice(0, 80);

  const where: Prisma.PromotionWhereInput = {
    AND: [
      query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } : {},
      status ? effectiveStatusWhere(status, now) : {},
      // Overlap with the requested period (open-ended promotions overlap everything).
      to ? { OR: [{ startsAt: null }, { startsAt: { lte: to } }] } : {},
      from ? { OR: [{ endsAt: null }, { endsAt: { gte: from } }] } : {},
    ],
  };
  const [total, promotions] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({ where, orderBy: [...sorts[sortKey], { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const affected = await Promise.all(promotions.map((promotion) => countTargetedProducts(promotion)));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkFor = (nextPage: number) => {
    const params = new URLSearchParams(Object.entries({ ...filters, page: String(nextPage) }).filter(([key, value]) => key !== "refresh" && typeof value === "string" && value) as [string, string][]);
    return `/admin/promotions?${params.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Central de Promoções</h1>
          <p className="mt-1 text-sm text-neutral-500">Preços promocionais calculados no servidor. Horários em Brasília.</p>
        </div>
        <Link href="/admin/promotions/new" className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-4 text-sm font-black text-white">Criar promoção</Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filtrar promoções">
        <label className="block lg:col-span-2"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-neutral-500">Buscar</span><input name="q" defaultValue={query} className="admin-input" placeholder="nome ou código" /></label>
        <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-neutral-500">Status</span>
          <select name="status" defaultValue={status ?? ""} className="admin-input"><option value="">Todos</option>{statuses.map((value) => <option key={value} value={value}>{PROMOTION_STATUS_LABELS[value]}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-neutral-500">De</span><input type="date" name="from" defaultValue={filters.from} className="admin-input" /></label>
        <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-neutral-500">Até</span><input type="date" name="to" defaultValue={filters.to} className="admin-input" /></label>
        <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-neutral-500">Ordenar</span>
          <select name="sort" defaultValue={sortKey} className="admin-input">
            <option value="updated">Atualização</option><option value="starts">Início</option><option value="ends">Fim</option><option value="priority">Prioridade</option><option value="name">Nome</option>
          </select></label>
        <button type="submit" className="h-11 rounded-lg border border-neutral-300 px-4 text-sm font-black lg:col-start-6">Filtrar</button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <caption className="sr-only">Promoções ({total})</caption>
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>{["Nome", "Status", "Tipo", "Desconto", "Escopo", "Início", "Fim", "Produtos", "Home"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-black">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {promotions.map((promotion, index) => (
              <tr key={promotion.id}>
                <td className="max-w-64 px-4 py-3"><Link href={`/admin/promotions/${promotion.id}`} className="font-black text-neutral-950 underline-offset-2 hover:underline">{promotion.name}</Link><span className="block truncate text-xs text-neutral-500">{promotion.slug}</span></td>
                <td className="px-4 py-3"><PromotionStatusBadge status={getEffectivePromotionStatus(promotion, now)} /></td>
                <td className="px-4 py-3">{promotion.type === "PERCENTAGE" ? "Percentual" : "Valor fixo"}</td>
                <td className="whitespace-nowrap px-4 py-3">{promotion.value === null ? "—" : promotion.type === "PERCENTAGE" ? `${promotion.value}%` : formatMoney(promotion.value)}</td>
                <td className="px-4 py-3">{PROMOTION_SCOPE_LABELS[promotion.scope]}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatBusinessDateTime(promotion.startsAt)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatBusinessDateTime(promotion.endsAt)}</td>
                <td className="px-4 py-3">{affected[index]}</td>
                <td className="px-4 py-3">{promotion.homepageFeatured ? "Sim" : "Não"}</td>
              </tr>
            ))}
            {!promotions.length ? <tr><td colSpan={9} className="px-4 py-10 text-center text-neutral-500">Nenhuma promoção encontrada.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <nav aria-label="Paginação de promoções" className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-500">Página {page} de {pages} · {total} promoção(ões)</span>
        <span className="flex gap-2">
          {page > 1 ? <Link href={linkFor(page - 1)} className="rounded-lg border border-neutral-300 px-3 py-2 font-black">Anterior</Link> : null}
          {page < pages ? <Link href={linkFor(page + 1)} className="rounded-lg border border-neutral-300 px-3 py-2 font-black">Próxima</Link> : null}
        </span>
      </nav>
    </div>
  );
}
