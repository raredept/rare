import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { isPaidRevenueStatus } from "@/lib/order-display";
import { maskCpf } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  const filters = await searchParams;
  const query = filters.q?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      ...(filters.status === "active" ? { active: true } : {}),
      ...(filters.status === "inactive" ? { active: false } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      active: true,
      createdAt: true,
      orders: {
        select: {
          status: true,
          totalInCents: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-neutral-950">Clientes</h1>
        <p className="text-sm text-neutral-500">Consulta operacional de cadastros, pedidos e total gasto.</p>
      </div>

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_180px_120px]">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar por nome ou e-mail" className="admin-input" />
        <select name="status" defaultValue={filters.status ?? ""} className="admin-input">
          <option value="">Todos status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button className="rounded-lg bg-black px-4 text-sm font-black text-white">Filtrar</button>
      </form>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[1fr_130px_120px_130px_120px_110px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Cliente</span>
          <span>Pedidos</span>
          <span>Total gasto</span>
          <span>Cadastro</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {customers.length ? (
            customers.map((customer) => {
              const paidOrders = customer.orders.filter((order) => isPaidRevenueStatus(order.status));
              const totalSpent = paidOrders.reduce((sum, order) => sum + order.totalInCents, 0);
              return (
                <div key={customer.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_130px_120px_130px_120px_110px] lg:items-center">
                  <div>
                    <p className="font-black text-neutral-950">{customer.name}</p>
                    <p className="text-sm font-semibold text-neutral-600">{customer.email}</p>
                    {customer.cpf ? <p className="text-xs font-semibold text-neutral-500">CPF {maskCpf(customer.cpf)}</p> : null}
                  </div>
                  <span className="text-sm font-black text-neutral-950">{customer.orders.length}</span>
                  <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(totalSpent)}</span>
                  <span className="text-sm font-semibold text-neutral-600">{customer.createdAt.toLocaleDateString("pt-BR")}</span>
                  <span className="text-sm font-black text-neutral-700">{customer.active ? "Ativo" : "Inativo"}</span>
                  <Link href={`/admin/customers/${customer.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                    Abrir
                  </Link>
                </div>
              );
            })
          ) : (
            <p className="px-6 py-12 text-center text-sm text-neutral-500">Nenhum cliente encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
