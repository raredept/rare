import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ADMIN_PAGE_SIZE, normalizeAdminPage } from "@/lib/admin-pagination";
import { formatMoney } from "@/lib/money";
import { paidRevenueStatuses } from "@/lib/order-display";
import { maskCpf } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; status?: string | string[] }>;
};

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const page = normalizeAdminPage(filters.page);
  const query = typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : undefined;
  const status = filters.status === "active" || filters.status === "inactive" ? filters.status : undefined;
  const where: Prisma.CustomerWhereInput = {
    ...(status === "active" ? { active: true } : {}),
    ...(status === "inactive" ? { active: false } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      active: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE + 1,
  });
  const hasNextPage = rows.length > ADMIN_PAGE_SIZE;
  const customers = rows.slice(0, ADMIN_PAGE_SIZE);
  const spendingGroups = customers.length
    ? await prisma.order.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customers.map((customer) => customer.id) },
          status: { in: paidRevenueStatuses },
        },
        _sum: { totalInCents: true },
      })
    : [];
  const spendingByCustomer = new Map(
    spendingGroups.map((group) => [group.customerId, group._sum.totalInCents ?? 0]),
  );

  return (
    <div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Relacionamento</p>
        <h1 className="text-2xl font-black text-neutral-950">Clientes</h1>
        <p className="text-sm text-neutral-500">Consulta paginada de cadastros, pedidos e receita confirmada por cliente.</p>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_180px_120px_auto]">
        <input name="q" defaultValue={query ?? ""} maxLength={100} aria-label="Buscar por nome ou e-mail" placeholder="Buscar por nome ou e-mail" className="admin-input" />
        <select aria-label="Filtrar por status" name="status" defaultValue={status ?? ""} className="admin-input">
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button className="min-h-11 rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
        {(query || status) ? (
          <Link href="/admin/customers" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-700 px-4 text-xs font-black text-neutral-300">
            Limpar
          </Link>
        ) : null}
      </form>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_130px_140px_140px_110px_110px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 xl:grid">
          <span>Cliente</span>
          <span>Pedidos</span>
          <span>Receita paga</span>
          <span>Cadastro</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {customers.length ? customers.map((customer) => (
            <div key={customer.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_130px_140px_140px_110px_110px] xl:items-center">
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="font-black text-neutral-950">{customer.name}</p>
                <p className="text-sm font-semibold text-neutral-600">{customer.email}</p>
                {customer.cpf ? <p className="text-xs font-semibold text-neutral-500">CPF {maskCpf(customer.cpf)}</p> : null}
              </div>
              <span className="text-sm font-black text-neutral-950">{customer._count.orders}</span>
              <span className="whitespace-nowrap text-sm font-black text-neutral-950">
                {formatMoney(spendingByCustomer.get(customer.id) ?? 0)}
              </span>
              <span className="text-sm font-semibold text-neutral-600">{formatAdminDate(customer.createdAt)}</span>
              <span className="text-sm font-black text-neutral-700">{customer.active ? "Ativo" : "Inativo"}</span>
              <Link href={`/admin/customers/${customer.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 px-3 text-xs font-black">
                Abrir
              </Link>
            </div>
          )) : (
            <p className="px-6 py-12 text-center text-sm font-semibold text-neutral-500">Nenhum cliente encontrado.</p>
          )}
        </div>
        <AdminPagination
          basePath="/admin/customers"
          page={page}
          hasNextPage={hasNextPage}
          params={{ q: query, status }}
        />
      </section>
    </div>
  );
}

function formatAdminDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}
