import type { Metadata } from "next";
import Link from "next/link";
import { retrySupportDeliveryAction } from "@/app/admin/(protected)/support/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireAdmin } from "@/lib/auth";
import { getTransactionalEmailDriver } from "@/lib/transactional-email";
import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support-request-contract";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suporte", robots: { index: false, follow: false } };

const statusLabels = { PENDING: "Pendente", SENT: "Enviado", FAILED: "Falhou" } as const;
const statusTone = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  SENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
} as const;

function formatDateTime(value: Date) {
  return value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export default async function AdminSupportPage() {
  await requireAdmin("commerce.support");
  const [requests, counts] = await Promise.all([
    prisma.supportRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, protocol: true, createdAt: true, category: true, name: true, email: true, message: true,
        productTitleSnapshot: true, productSlugSnapshot: true, orderId: true, orderNumberSnapshot: true,
        status: true, lastErrorCode: true, confirmationStatus: true, confirmationErrorCode: true,
      },
    }),
    prisma.supportRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countFor = (status: keyof typeof statusLabels) => counts.find((row) => row.status === status)?._count._all ?? 0;
  const emailDisabled = getTransactionalEmailDriver() === "disabled";

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-black text-neutral-950">Suporte</h1>
      <p className="mt-1 text-sm font-semibold text-neutral-500">
        Solicitações enviadas pelo formulário /suporte. Responda pelo e-mail recebido (o Reply-To é o cliente). Últimas 50.
      </p>
      {emailDisabled ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          O envio de e-mail está desativado neste ambiente: as solicitações ficam guardadas como pendentes até ele ser configurado.
        </p>
      ) : null}

      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["PENDING", "SENT", "FAILED"] as const).map((status) => (
          <div key={status} className="rounded-lg border border-neutral-200 bg-white p-4">
            <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">{statusLabels[status]}</dt>
            <dd className="mt-2 text-2xl font-black text-neutral-950">{countFor(status)}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Solicitações de suporte" className="mt-6 grid gap-4">
        {requests.length ? requests.map((request) => (
          <article key={request.id} className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5" aria-label={`Solicitação ${request.protocol}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-mono text-base font-black text-neutral-950">{request.protocol}</h2>
                <p className="mt-1 text-xs font-semibold text-neutral-500">{formatDateTime(request.createdAt)} · {SUPPORT_CATEGORY_LABELS[request.category]}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase">
                <span className={`rounded-full border px-2 py-0.5 ${statusTone[request.status]}`}>Equipe: {statusLabels[request.status]}</span>
                <span className={`rounded-full border px-2 py-0.5 ${statusTone[request.confirmationStatus]}`}>Cliente: {statusLabels[request.confirmationStatus]}</span>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="min-w-0"><dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Cliente</dt><dd className="font-semibold text-neutral-950">{request.name}<br /><span className="text-neutral-600">{request.email}</span></dd></div>
              <div className="min-w-0"><dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Produto</dt><dd className="font-semibold text-neutral-950">{request.productSlugSnapshot ? <Link className="underline underline-offset-4" href={`/produto/${request.productSlugSnapshot}`}>{request.productTitleSnapshot}</Link> : request.productTitleSnapshot ?? "—"}</dd></div>
              <div className="min-w-0"><dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Pedido</dt><dd className="font-semibold text-neutral-950">{request.orderId ? <Link className="underline underline-offset-4" href={`/admin/orders/${request.orderId}`}>{request.orderNumberSnapshot}</Link> : request.orderNumberSnapshot ?? "—"}</dd></div>
            </dl>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-neutral-600">Ver mensagem</summary>
              {/* Plain text rendered by React: the customer's text is never trusted as HTML. */}
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800">{request.message}</p>
            </details>
            {request.status === "FAILED" || request.confirmationStatus === "FAILED" ? (
              <form action={retrySupportDeliveryAction} className="mt-3 flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={request.id} />
                <p className="text-xs font-semibold text-red-700">Falha: {request.lastErrorCode ?? request.confirmationErrorCode ?? "desconhecida"}</p>
                <AdminSubmitButton idleLabel="Reenviar" pendingLabel="Reenviando..." className="h-10 rounded-lg border border-neutral-300 px-3 text-xs font-black hover:bg-neutral-950 hover:text-white" />
              </form>
            ) : null}
          </article>
        )) : <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm font-semibold text-neutral-500">Nenhuma solicitação ainda.</p>}
      </section>
    </div>
  );
}
