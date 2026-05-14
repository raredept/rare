import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus, isPaidRevenueStatus } from "@/lib/order-display";
import { maskCpf } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      active: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          cep: true,
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          isDefault: true,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalInCents: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) notFound();

  const paidOrders = customer.orders.filter((order) => isPaidRevenueStatus(order.status));
  const totalSpent = paidOrders.reduce((sum, order) => sum + order.totalInCents, 0);
  const lastPurchase = paidOrders[0]?.createdAt;

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">{customer.name}</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-600">{customer.email}</p>
        </div>
        <Link href="/admin/customers" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-black">
          Voltar
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric title="Total gasto" value={formatMoney(totalSpent)} />
        <Metric title="Pedidos" value={customer.orders.length.toString()} />
        <Metric title="Ultima compra" value={lastPurchase ? lastPurchase.toLocaleDateString("pt-BR") : "-"} />
        <Metric title="Status" value={customer.active ? "Ativo" : "Inativo"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Dados</h2>
            <div className="mt-4 space-y-2 text-sm font-semibold text-neutral-600">
              <p>Telefone: {customer.phone ?? "-"}</p>
              <p>CPF: {customer.cpf ? maskCpf(customer.cpf) : "-"}</p>
              <p>Cadastro: {customer.createdAt.toLocaleDateString("pt-BR")}</p>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">Enderecos</h2>
            <div className="mt-4 space-y-3">
              {customer.addresses.length ? (
                customer.addresses.map((address) => (
                  <div key={address.id} className="rounded-lg border border-neutral-200 p-4 text-sm font-semibold text-neutral-600">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-neutral-950">{address.label || "Endereco"}</p>
                      {address.isDefault ? (
                        <span className="rounded-full bg-neutral-950 px-2 py-1 text-[10px] font-black uppercase text-white">Padrao</span>
                      ) : null}
                    </div>
                    <p className="mt-2">
                      {address.street}, {address.number}
                      {address.complement ? ` - ${address.complement}` : ""}
                    </p>
                    <p>
                      {address.neighborhood} · {address.city}/{address.state}
                    </p>
                    <p>CEP {address.cep}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">Nenhum endereco cadastrado.</p>
              )}
            </div>
          </section>
        </aside>

        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-black text-neutral-950">Pedidos do cliente</h2>
          <div className="mt-4 divide-y divide-neutral-200">
            {customer.orders.length ? (
              customer.orders.map((order) => (
                <div key={order.id} className="grid gap-2 py-3 text-sm md:grid-cols-[130px_130px_1fr_120px_80px] md:items-center">
                  <span className="font-black text-neutral-950">{order.orderNumber}</span>
                  <span className="font-semibold text-neutral-600">{order.createdAt.toLocaleDateString("pt-BR")}</span>
                  <span className="font-black text-neutral-700">{formatOrderStatus(order.status)}</span>
                  <span className="whitespace-nowrap font-black text-neutral-950">{formatMoney(order.totalInCents)}</span>
                  <Link href={`/admin/orders/${order.id}`} className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-xs font-black">
                    Abrir
                  </Link>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-neutral-500">Nenhum pedido vinculado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-3 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}
