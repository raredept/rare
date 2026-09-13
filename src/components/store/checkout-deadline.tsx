"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { paidOrderStatuses } from "@/lib/coupons";

type CheckoutState = { id: string; orderNumber: string; status: string; deadlineAt: string | null;
  expiredAt: string | null; processing: boolean; resumeUrl: string | null };

export function CheckoutDeadline() {
  const [order, setOrder] = useState<CheckoutState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    let deadline: number | null = null;
    let clockOffset = 0;
    const tick = () => { if (alive) setRemaining(deadline === null ? null : Math.max(0, Math.ceil((deadline - (Date.now() + clockOffset)) / 1000))); };
    const refresh = async () => {
      try {
        const query = new URLSearchParams(window.location.search).get("pedido");
        const response = await fetch(`/api/checkout/status${query ? `?pedido=${encodeURIComponent(query)}` : ""}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!alive) return;
        clockOffset = Date.parse(data.serverNow) - Date.now();
        deadline = data.order?.deadlineAt ? Date.parse(data.order.deadlineAt) : null;
        setOrder(data.order); tick();
      } catch { /* Keep the last SERVER deadline during an offline interval. */ }
    };
    void refresh();
    const clock = setInterval(tick, 1000);
    const poll = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible); document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; clearInterval(clock); clearInterval(poll); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (!order || !order.deadlineAt) return null;
  const terminal = order.status === "canceled" || order.status === "failed";
  const refunded = order.status === "refunded";
  const paid = refunded || (paidOrderStatuses as readonly string[]).includes(order.status);
  const elapsed = remaining === 0;
  return (
    <section aria-label="Prazo da compra" className="store-shell pt-6">
      <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-5 text-sm leading-6 text-neutral-800">
        <p className="font-black">{refunded ? "Pagamento reembolsado" : paid ? "Pagamento confirmado" : order.processing ? "Pagamento em processamento" : terminal || elapsed ? "Tempo esgotado" : "Sua reserva está em andamento"}</p>
        <p>Pedido {order.orderNumber}.</p>
        {!paid && !terminal && !order.processing && remaining !== null && remaining > 0 ? (
          <p>Finalize em <span role="timer" aria-live="off" className="font-black tabular-nums">{Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}</span>. Voltar ou recarregar a página não renova este prazo.</p>
        ) : null}
        {order.processing ? <p>Aguardamos a confirmação do provedor. A reserva permanece protegida; não repita o pagamento.</p> : null}
        {elapsed && !terminal && !paid && !order.processing ? <p>Estamos confirmando o encerramento no provedor. Em caso de indisponibilidade, esse processo pode levar mais tempo. Não repita o pagamento enquanto confirmamos.</p> : null}
        {terminal ? <p>Para tentar novamente, revise o carrinho e use Finalizar compra. Estoque, preço e entrega serão conferidos novamente.</p> : null}
        {order.resumeUrl && !elapsed && !terminal && !paid && !order.processing ? <a href={order.resumeUrl} className="mt-3 inline-flex min-h-11 items-center font-bold underline underline-offset-4">Continuar pagamento</a> : null}
        {paid ? <Link href="/minha-conta/pedidos" className="inline-flex min-h-11 items-center font-bold underline">Ver meus pedidos</Link> : null}
      </div>
    </section>
  );
}
