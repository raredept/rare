import Link from "next/link";
import { AccountShell } from "@/components/store/account-shell";
import { logoutCustomerAction } from "@/lib/customer-actions";
import { requireCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { FIRST_ORDER_COUPON_CODE, FIRST_ORDER_COUPON_PERCENT, paidOrderStatuses } from "@/lib/coupons";
import { isPaidRevenueStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";

export const dynamic = "force-dynamic";

export default async function MyAccountPage() {
  const customer = await requireCustomer("/minha-conta");
  const commerce = getStorefrontCommerceState();
  const [orders, defaultAddress, paidOrderCount] = await Promise.all([
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
    prisma.order.count({ where: { customerId: customer.id, status: { in: [...paidOrderStatuses] } } }),
  ]);
  const paidTotal = orders
    .filter((order) => isPaidRevenueStatus(order.status))
    .reduce((sum, order) => sum + order.totalInCents, 0);

  return (
    <AccountShell title={`Olá, ${customer.name}`} subtitle="Gerencie dados, endereços e acompanhe pedidos vinculados ao seu cadastro.">
      <div className="grid gap-8 border-b border-neutral-200 pb-8 md:grid-cols-3">
        <SummaryCard title="Pedidos recentes" value={orders.length.toString()} />
        <SummaryCard title="Total pago recente" value={formatMoney(paidTotal)} />
        <SummaryCard title="Endereço padrão" value={defaultAddress ? `${defaultAddress.city}/${defaultAddress.state}` : "Não cadastrado"} />
      </div>

      {paidOrderCount === 0 && commerce.checkoutEnabled ? (
        <section className="mt-8 border-b border-neutral-200 pb-8">
          <p className="store-section-label">Presente para você</p>
          <h2 className="mt-3 text-xl font-medium tracking-tight text-neutral-950">{FIRST_ORDER_COUPON_PERCENT}% off na primeira compra</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Use o cupom <span className="font-medium text-neutral-950">{FIRST_ORDER_COUPON_CODE}</span> no checkout. Ele já será aplicado automaticamente.
          </p>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <AccountShortcut href="/minha-conta/dados" title="Dados pessoais" text="Nome, telefone e CPF do cadastro." />
        <AccountShortcut href="/minha-conta/enderecos" title="Endereços" text="Cadastrar, editar e definir padrão." />
        <AccountShortcut href="/minha-conta/pedidos" title="Meus pedidos" text="Histórico vinculado à sua conta." />
      </div>

      <form action={logoutCustomerAction} className="mt-10">
        <button type="submit" className="store-button-secondary w-full sm:w-auto">
          Sair
        </button>
      </form>
    </AccountShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="store-section-label">{title}</p>
      <p className="mt-4 text-2xl font-medium tracking-tight text-neutral-950">{value}</p>
    </div>
  );
}

function AccountShortcut({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="group min-h-11 border-b border-neutral-300 pb-6 transition-colors hover:border-neutral-950">
      <h2 className="text-lg font-medium tracking-tight text-neutral-950 group-hover:underline group-hover:underline-offset-4">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{text}</p>
    </Link>
  );
}
