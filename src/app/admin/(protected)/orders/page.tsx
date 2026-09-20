import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  buildOrdersHref,
  ORDERS_PAGE_SIZE,
  ORDER_STATUS_VALUES,
  parseAdminOrderFilters,
} from "@/lib/admin-order-filters";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, formatPaymentMethod } from "@/lib/order-display";
import { maskCpf } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

function buildWhere(filters: ReturnType<typeof parseAdminOrderFilters>): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status;

  if (filters.search) {
    // Order number, or the customer as the order recorded them. Free text never
    // reaches an enum or a raw query.
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { customerEmailSnapshot: { contains: filters.search, mode: "insensitive" } },
      { customerNameSnapshot: { contains: filters.search, mode: "insensitive" } },
      { customerEmail: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const filters = parseAdminOrderFilters(await searchParams);
  const where = buildWhere(filters);

  // Paged in the database: the list used to take the newest 100 with no way to
  // reach anything older.
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalInCents: true,
        paymentMethod: true,
        createdAt: true,
        customerNameSnapshot: true,
        customerEmailSnapshot: true,
        customerEmail: true,
        customerName: true,
        customerCpfSnapshot: true,
        customer: { select: { name: true, email: true, cpf: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.order.count({ where }),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const firstShown = total ? filters.skip + 1 : 0;
  const lastShown = filters.skip + orders.length;

  return (
    <div>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-neutral-950">Pedidos</h1>
        <p className="text-sm font-semibold text-neutral-500">
          {total === 0
            ? "Nenhum pedido encontrado"
            : `${firstShown}–${lastShown} de ${new Intl.NumberFormat("pt-BR").format(total)} pedido(s)`}
        </p>
      </div>

      {filters.invalidStatus ? (
        <p
          role="status"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"
        >
          O status “{filters.invalidStatus}” não existe. Mostrando todos os pedidos.
        </p>
      ) : null}

      <form className="mt-6 grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[1fr_200px_auto]" role="search">
        <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Número do pedido, nome ou e-mail"
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-black uppercase tracking-wide text-neutral-500">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className="admin-input mt-1">
            <option value="">Todos</option>
            {ORDER_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {formatOrderStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-[42px] rounded-lg bg-black px-4 text-sm font-black text-white">
            Filtrar
          </button>
          {filters.status || filters.search ? (
            <Link
              href="/admin/orders"
              className="flex h-[42px] items-center rounded-lg border border-neutral-300 px-4 text-sm font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[160px_1fr_150px_140px_120px_100px] bg-neutral-50 px-5 py-3 text-xs font-black uppercase tracking-wide text-neutral-500 lg:grid">
          <span>Pedido</span>
          <span>Cliente</span>
          <span>Status pedido</span>
          <span>Pagamento</span>
          <span>Total</span>
          <span>Ações</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {orders.length ? (
            orders.map((order) => (
              <div key={order.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[160px_1fr_150px_140px_120px_100px] lg:items-center">
                <span className="font-black text-neutral-950">{order.orderNumber}</span>
                <span className="text-sm font-semibold text-neutral-600">
                  <span className="block break-words">
                    {order.customer?.name ?? order.customerNameSnapshot ?? order.customerEmailSnapshot ?? order.customerEmail ?? order.customerName ?? "Cliente"}
                  </span>
                  {maskCpf(order.customer?.cpf ?? order.customerCpfSnapshot) ? (
                    <span className="mt-1 block text-xs font-semibold text-neutral-500">
                      CPF {maskCpf(order.customer?.cpf ?? order.customerCpfSnapshot)}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-black text-neutral-700">{formatOrderStatus(order.status)}</span>
                <span className="text-sm font-semibold text-neutral-600">{formatPaymentMethod(order.paymentMethod)}</span>
                <span className="whitespace-nowrap text-sm font-black text-neutral-950">{formatMoney(order.totalInCents)}</span>
                <Link href={`/admin/orders/${order.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                  Abrir
                </Link>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-black text-neutral-950">
                {filters.status || filters.search ? "Nenhum pedido com esses filtros." : "Nenhum pedido registrado ainda."}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-500">
                {filters.status || filters.search
                  ? "Ajuste a busca ou limpe os filtros para ver todos os pedidos."
                  : "Os pedidos aparecem aqui assim que um checkout é iniciado."}
              </p>
            </div>
          )}
        </div>
      </section>

      {lastPage > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Paginação de pedidos">
          <PageLink
            href={buildOrdersHref(filters, { page: filters.page - 1 })}
            disabled={filters.page <= 1}
            label="Anterior"
          />
          <span className="text-xs font-black uppercase tracking-wide text-neutral-500">
            Página {filters.page} de {lastPage}
          </span>
          <PageLink
            href={buildOrdersHref(filters, { page: filters.page + 1 })}
            disabled={filters.page >= lastPage}
            label="Próxima"
          />
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-black text-neutral-400">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
    >
      {label}
    </Link>
  );
}
