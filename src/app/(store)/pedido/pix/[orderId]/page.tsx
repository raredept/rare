import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ClearCartOnSuccess } from "@/components/store/clear-cart-on-success";
import { OrderStatusRefresh } from "@/components/store/order-status-refresh";
import { PixPaymentPanel } from "@/components/store/pix-payment-panel";
import { paidOrderStatuses } from "@/lib/coupons";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { formatMoney } from "@/lib/money";
import { formatOrderStatus } from "@/lib/order-display";
import { prisma } from "@/lib/prisma";
import { buildNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildNoIndexMetadata({
  title: "Pagamento por Pix | RARE",
  description: "Pague seu pedido RARE por Pix.",
  path: "/pedido/pix",
});

type PixOrderPageProps = {
  params: Promise<{ orderId: string }>;
};

// The Pix settles in the shopper's bank app, usually on another device. Keep re-reading the
// order for the whole payment window, at a pace a single page can sustain.
const PIX_REFRESH_INTERVAL_MS = 5_000;
const PIX_REFRESH_MAX_ATTEMPTS = 400;

export default async function PixOrderPage({ params }: PixOrderPageProps) {
  const { orderId } = await params;
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(orderId)) notFound();

  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/entrar?next=${encodeURIComponent(`/pedido/pix/${orderId}`)}`);

  // Scoped to the signed-in customer: someone else's order id is simply not found.
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: customer.id, paymentProvider: "mercadopago" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalInCents: true,
      checkoutDeadlineAt: true,
      reservationExpiresAt: true,
      pixCharge: { select: { copyPaste: true, qrCodeBase64: true, ticketUrl: true } },
    },
  });
  if (!order) notFound();

  const now = new Date();
  const paid = (paidOrderStatuses as readonly string[]).includes(order.status);
  const awaiting = order.status === "awaiting_payment" || order.status === "pending";
  const deadline = order.checkoutDeadlineAt ?? order.reservationExpiresAt;
  const processing = awaiting && !order.reservationExpiresAt;
  const payable = awaiting && !processing && Boolean(order.pixCharge) && Boolean(deadline && deadline > now);

  const summary = (
    <div className="mx-auto mt-6 max-w-md rounded-lg border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-600">
      <p>
        Pedido <span className="font-black text-neutral-950">{order.orderNumber}</span>
      </p>
      <p>Status: {formatOrderStatus(order.status)}</p>
      <p>Total: {formatMoney(order.totalInCents)}</p>
    </div>
  );

  if (paid) {
    return (
      <PixShell eyebrow="Pagamento confirmado" title="Recebemos o seu Pix.">
        <ClearCartOnSuccess />
        <p className="mt-4 text-neutral-600">Seu pedido está confirmado e entra em separação. Você pode acompanhar tudo em Meus pedidos.</p>
        {summary}
        <Link href="/minha-conta/pedidos" className="mt-6 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
          Ver meus pedidos
        </Link>
      </PixShell>
    );
  }

  if (!awaiting) {
    return (
      <PixShell eyebrow="Pix encerrado" title="Este Pix não está mais disponível.">
        <p className="mt-4 text-neutral-600">
          O prazo terminou ou o pedido foi encerrado, e a reserva das peças foi liberada. Não pague um código antigo. Para tentar de novo, volte ao carrinho: estoque, preço e entrega serão conferidos novamente.
        </p>
        {summary}
        <Link href="/finalizar-compra" className="mt-6 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
          Voltar para finalizar a compra
        </Link>
      </PixShell>
    );
  }

  return (
    <PixShell eyebrow="Pagamento por Pix" title={payable ? "Pague com Pix para confirmar o pedido" : "Estamos conferindo o seu Pix"}>
      <OrderStatusRefresh active intervalMs={PIX_REFRESH_INTERVAL_MS} maxAttempts={PIX_REFRESH_MAX_ATTEMPTS} />
      {payable && order.pixCharge && deadline ? (
        <>
          <p className="mt-4 text-neutral-600">
            Abra o app do seu banco, escolha pagar com Pix e leia o QR code ou cole o código. Esta página confirma o pagamento sozinha, em alguns segundos.
          </p>
          <PixPaymentPanel
            copyPaste={order.pixCharge.copyPaste}
            qrCodeBase64={order.pixCharge.qrCodeBase64}
            ticketUrl={order.pixCharge.ticketUrl}
            deadlineAt={deadline.toISOString()}
            serverNow={now.toISOString()}
          />
        </>
      ) : (
        <p className="mt-4 text-neutral-600">
          {processing
            ? "O pagamento está em processamento no Mercado Pago. A reserva permanece protegida; não repita o pagamento."
            : "Aguarde alguns instantes. Se você já pagou, a confirmação aparece aqui automaticamente; não repita o pagamento."}
        </p>
      )}
      {summary}
    </PixShell>
  );
}

function PixShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-success">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-black text-neutral-950">{title}</h1>
      {children}
      <div>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
        >
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
}
