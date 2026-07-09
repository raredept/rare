import Link from "next/link";
import { markAdminNotificationReadAction, markAllAdminNotificationsReadAction } from "@/app/admin/(protected)/notifications/actions";
import { AdminPushSubscriptionControl } from "@/components/admin/admin-push-subscription-control";
import { getWebPushVapidPublicKey } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const [notifications, unreadCount, activeSubscriptionCount] = await Promise.all([
    prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalInCents: true,
            status: true,
          },
        },
      },
    }),
    prisma.adminNotification.count({ where: { readAt: null } }),
    prisma.adminPushSubscription.count({ where: { active: true } }),
  ]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-950">Notificacoes</h1>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            Alertas administrativos gerados por eventos automaticos do checkout.
          </p>
        </div>
        <form action={markAllAdminNotificationsReadAction}>
          <button
            type="submit"
            disabled={unreadCount === 0}
            className="h-11 rounded-lg border border-neutral-300 px-4 text-sm font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300"
          >
            Marcar todas como lidas
          </button>
        </form>
      </div>

      <div className="mt-6">
        <AdminPushSubscriptionControl
          publicKey={getWebPushVapidPublicKey()}
          activeSubscriptionCount={activeSubscriptionCount}
        />
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-neutral-600">Historico</h2>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-black text-neutral-600">
            {unreadCount} nao lida(s)
          </span>
        </div>
        <div className="divide-y divide-neutral-200">
          {notifications.length ? (
            notifications.map((notification) => (
              <article
                key={notification.id}
                className={`grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center ${
                  notification.readAt ? "bg-white" : "bg-amber-50/50"
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                        notification.readAt
                          ? "border-neutral-200 bg-neutral-50 text-neutral-500"
                          : "border-amber-200 bg-amber-100 text-amber-800"
                      }`}
                    >
                      {notification.readAt ? "Lida" : "Nova"}
                    </span>
                    <time className="text-xs font-semibold text-neutral-500" dateTime={notification.createdAt.toISOString()}>
                      {notification.createdAt.toLocaleString("pt-BR")}
                    </time>
                  </div>
                  <h3 className="mt-2 text-base font-black text-neutral-950">{notification.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-neutral-600">{notification.body}</p>
                  {notification.order ? (
                    <p className="mt-1 text-xs font-semibold text-neutral-500">
                      {notification.order.orderNumber} · {formatMoney(notification.order.totalInCents)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      className="inline-flex h-10 items-center rounded-lg border border-neutral-300 px-3 text-xs font-black text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                    >
                      Abrir
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <form action={markAdminNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <button
                        type="submit"
                        className="h-10 rounded-lg bg-black px-3 text-xs font-black text-white transition hover:bg-neutral-800"
                      >
                        Marcar lida
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="px-5 py-10 text-sm font-semibold text-neutral-500">Nenhuma notificacao registrada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
