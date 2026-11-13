import Link from "next/link";
import { notFound } from "next/navigation";
import { changePromotionStatusAction, duplicatePromotionAction } from "@/app/admin/(protected)/promotions/actions";
import { PromotionStatusBadge } from "@/app/admin/(protected)/promotions/status-badge";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { requireAdmin } from "@/lib/auth";
import { formatBusinessDateTime } from "@/lib/business-time";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { countTargetedProducts, getActivationIssues, getPromotionSalesSummary, PROMOTION_SCOPE_LABELS } from "@/lib/promotions/admin";
import { getEffectivePromotionStatus } from "@/lib/promotions/engine";

export const dynamic = "force-dynamic";

const button = "inline-flex h-10 items-center justify-center rounded-lg border border-neutral-300 px-4 text-sm font-black";

function StatusForm({ id, intent, label, confirm }: { id: string; intent: "activate" | "pause" | "end"; label: string; confirm?: string }) {
  return (
    <form action={changePromotionStatusAction}>
      <input type="hidden" name="promotionId" value={id} />
      <input type="hidden" name="intent" value={intent} />
      {confirm ? <ConfirmButton message={confirm} type="submit" className={button}>{label}</ConfirmButton> : <AdminSubmitButton idleLabel={label} pendingLabel="..." className={button} />}
    </form>
  );
}

export default async function PromotionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const promotion = await prisma.promotion.findUnique({ where: { id }, include: { _count: { select: { products: true, categories: true } } } });
  if (!promotion) notFound();
  const now = new Date();
  const effective = getEffectivePromotionStatus(promotion, now);
  const [affected, sales, history] = await Promise.all([
    countTargetedProducts(promotion),
    getPromotionSalesSummary(promotion.id),
    prisma.adminAuditLog.findMany({ where: { entityType: "Promotion", entityId: promotion.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const issues = getActivationIssues({ ...promotion, productCount: promotion._count.products, categoryCount: promotion._count.categories }, now);
  const canActivate = ["DRAFT", "PAUSED"].includes(promotion.status) || (promotion.status === "SCHEDULED" && effective !== "SCHEDULED" && effective !== "ENDED");

  return (
    <div className="max-w-5xl">
      <Link href="/admin/promotions" className="text-xs font-black uppercase tracking-wide text-neutral-500 hover:text-white">← Promoções</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-neutral-950">{promotion.name}</h1>
        <PromotionStatusBadge status={effective} />
      </div>
      <p className="mt-1 text-sm text-neutral-500">Código {promotion.slug}</p>
      {promotion.status !== effective && effective === "ENDED" ? (
        <p className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-700">O período terminou: a promoção já não se aplica a nenhum preço. Encerre-a para registrar.</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {promotion.status !== "ENDED" ? <Link href={`/admin/promotions/${promotion.id}/edit`} className={button}>Editar</Link> : null}
        <Link href={`/admin/promotions/${promotion.id}/preview`} className={button}>Pré-visualizar</Link>
        <form action={duplicatePromotionAction}><input type="hidden" name="promotionId" value={promotion.id} /><AdminSubmitButton idleLabel="Duplicar" pendingLabel="Duplicando..." className={button} /></form>
        {canActivate && !issues.length ? (
          <StatusForm id={promotion.id} intent="activate" label="Ativar" confirm={`Ativar "${promotion.name}"? Os preços mudam no início definido (${formatBusinessDateTime(promotion.startsAt)}), ou agora se não houver início.`} />
        ) : null}
        {promotion.status === "ACTIVE" || promotion.status === "SCHEDULED" ? <StatusForm id={promotion.id} intent="pause" label="Pausar" /> : null}
        {promotion.status !== "ENDED" ? <StatusForm id={promotion.id} intent="end" label="Encerrar" confirm="Encerrar definitivamente? Uma promoção encerrada não volta; use Duplicar para reutilizar." /> : null}
      </div>
      {canActivate && issues.length ? (
        <div className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-700" role="status">
          <p className="font-black">Para ativar, resolva:</p>
          <ul className="mt-1 list-disc pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      ) : null}

      <dl className="mt-6 grid gap-4 rounded-lg border border-neutral-200 bg-white p-5 text-sm sm:grid-cols-3">
        {[
          ["Desconto", promotion.value === null ? "—" : promotion.type === "PERCENTAGE" ? `${promotion.value}%` : formatMoney(promotion.value)],
          ["Escopo", `${PROMOTION_SCOPE_LABELS[promotion.scope]} · ${affected} produto(s) ativo(s)`],
          ["Prioridade", String(promotion.priority)],
          ["Início (Brasília)", formatBusinessDateTime(promotion.startsAt)],
          ["Fim (Brasília)", formatBusinessDateTime(promotion.endsAt)],
          ["Destaque na home", promotion.homepageFeatured ? "Sim" : "Não"],
        ].map(([term, value]) => (
          <div key={term}><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">{term}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
        ))}
      </dl>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="promotion-sales-title">
        <h2 id="promotion-sales-title" className="text-lg font-black text-neutral-950">Vendas com esta promoção</h2>
        <p className="mt-1 text-xs text-neutral-500">Somente pedidos pagos (pago, em preparação, enviado, entregue). Receita = valor dos itens promocionais, antes de cupom e frete.</p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          {[["Pedidos", String(sales.orders)], ["Receita", formatMoney(sales.revenueInCents)], ["Desconto concedido", formatMoney(sales.discountInCents)], ["Itens vendidos", String(sales.itemsSold)]].map(([term, value]) => (
            <div key={term}><dt className="text-xs font-black uppercase tracking-wide text-neutral-500">{term}</dt><dd className="mt-1 text-xl font-black">{value}</dd></div>
          ))}
        </dl>
        {sales.topProducts.length ? (
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
            {sales.topProducts.map((product) => <li key={product.title}>{product.title} — {product.quantity} un. · {formatMoney(product.revenueInCents)}</li>)}
          </ol>
        ) : <p className="mt-4 text-sm text-neutral-500">Nenhuma venda paga ainda.</p>}
      </section>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="promotion-history-title">
        <h2 id="promotion-history-title" className="text-lg font-black text-neutral-950">Histórico de alterações</h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="py-2 [overflow-wrap:anywhere]">
              <span className="font-black">{entry.action.replace("promotion.", "")}</span> · {entry.actorLabel} · {formatBusinessDateTime(entry.createdAt)}
            </li>
          ))}
          {!history.length ? <li className="py-2 text-neutral-500">Sem registros.</li> : null}
        </ul>
      </section>
    </div>
  );
}
