import Link from "next/link";
import { AccountShell } from "@/components/store/account-shell";
import { logoutCustomerAction } from "@/lib/customer-actions";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { isPaidRevenueStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyAccountPage() {
  const customer = await requireCustomer("/minha-conta");
  const [orders, defaultAddress] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalInCents: true,
        createdAt: true,
      },
    }),
    prisma.customerAddress.findFirst({
      where: { customerId: customer.id, isDefault: true },
      select: {
        street: true,
        number: true,
        city: true,
        state: true,
      },
    }),
  ]);
  const paidTotal = orders
    .filter((order) => isPaidRevenueStatus(order.status))
    .reduce((sum, order) => sum + order.totalInCents, 0);

  return (
    <AccountShell title={`Olá, ${customer.name}`} subtitle="Gerencie dados, endereços e acompanhe pedidos vinculados ao seu cadastro.">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Pedidos recentes" value={orders.length.toString()} />
        <SummaryCard title="Total pago recente" value={formatMoney(paidTotal)} />
        <SummaryCard title="Endereço padrão" value={defaultAddress ? `${defaultAddress.city}/${defaultAddress.state}` : "Não cadastrado"} />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <AccountShortcut href="/minha-conta/dados" title="Dados pessoais" text="Nome, telefone e CPF para checkout." />
        <AccountShortcut href="/minha-conta/enderecos" title="Endereços" text="Cadastrar, editar e definir padrão." />
        <AccountShortcut href="/minha-conta/pedidos" title="Meus pedidos" text="Histórico vinculado à sua conta." />
      </div>

      <form action={logoutCustomerAction} className="mt-8">
        <button type="submit" className="h-11 rounded-lg border border-neutral-300 px-5 text-sm font-black uppercase tracking-wide text-neutral-950">
          Sair
        </button>
      </form>
    </AccountShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-3 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

function AccountShortcut({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-black">
      <h2 className="text-lg font-black text-neutral-950">{title}</h2>
      <p className="mt-2 text-sm font-medium text-neutral-500">{text}</p>
    </Link>
  );
}
