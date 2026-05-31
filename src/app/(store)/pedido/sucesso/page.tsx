import Link from "next/link";
import type { ReactNode } from "react";
import { ClearCartOnSuccess } from "@/components/store/clear-cart-on-success";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";

type OrderSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

function isValidCheckoutSessionId(value: string | undefined) {
  return Boolean(value && /^cs_(test|live)_[A-Za-z0-9_]+$/.test(value));
}

export default async function OrderSuccessPage({ searchParams }: OrderSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!isValidCheckoutSessionId(sessionId)) {
    return (
      <OrderSuccessShell eyebrow="Pagamento" title="Não encontramos uma sessão de pagamento nesta página.">
        <p className="mt-4 text-neutral-600">
          Volte para finalizar a compra pela Stripe. Se o pagamento já foi feito, fale com a RARE com o e-mail usado no pedido.
        </p>
      </OrderSuccessShell>
    );
  }

  const order = await prisma.order.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: {
      orderNumber: true,
      status: true,
      totalInCents: true,
    },
  });

  if (!order) {
    return (
      <OrderSuccessShell eyebrow="Pagamento" title="Ainda não conseguimos localizar este checkout.">
        <p className="mt-4 text-neutral-600">
          A Stripe pode levar alguns instantes para avisar a loja. Se a cobrança aparecer no seu banco, fale com a RARE para conferirmos o pedido.
        </p>
      </OrderSuccessShell>
    );
  }

  return (
    <OrderSuccessShell eyebrow="Checkout iniciado" title="Pedido recebido pela RARE">
      <ClearCartOnSuccess />
      <p className="mt-4 text-neutral-600">
        Se o pagamento foi confirmado, a Stripe avisará a loja pelo webhook e o pedido aparecerá como pago no admin.
      </p>
      <div className="mx-auto mt-6 max-w-md rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-600">
        <p>
          Pedido <span className="font-black text-neutral-950">{order.orderNumber}</span>
        </p>
        <p>Status: {formatOrderStatus(order.status)}</p>
        <p>Total: {formatMoney(order.totalInCents)}</p>
      </div>
    </OrderSuccessShell>
  );
}

function OrderSuccessShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-success">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-black text-neutral-950">{title}</h1>
      {children}
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}
