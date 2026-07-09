import webPush from "web-push";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getWebPushConfig } from "@/lib/env";

export const paidOrderNotificationType = "order_paid";

type AdminNotificationPayload = {
  title: string;
  body: string;
  href: string;
  tag: string;
};

type PushDeliveryResult = {
  status: "not_configured" | "sent";
  attempted: number;
  sent: number;
  failed: number;
  disabled: number;
};

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function getPushStatusCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  const statusCode = error.statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

function getSafePushErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Web Push delivery error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted-token]");
}

function buildPaidOrderNotification(order: { id: string; orderNumber: string; totalInCents: number }) {
  return {
    type: paidOrderNotificationType,
    title: "Venda aprovada",
    body: `Pedido ${order.orderNumber} confirmado: ${formatMoney(order.totalInCents)}.`,
    href: `/admin/orders/${order.id}`,
    orderId: order.id,
    dedupeKey: `${paidOrderNotificationType}:${order.id}`,
  };
}

async function sendAdminPushNotification(payload: AdminNotificationPayload): Promise<PushDeliveryResult> {
  const config = getWebPushConfig();
  if (!config) {
    return {
      status: "not_configured",
      attempted: 0,
      sent: 0,
      failed: 0,
      disabled: 0,
    };
  }

  const subscriptions = await prisma.adminPushSubscription.findMany({
    where: { active: true },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/brand/rare-logo.png",
    badge: "/brand/favicon.ico",
    url: payload.href,
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  let disabled = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload,
          {
            TTL: 60 * 60,
            urgency: "high",
          },
        );
        sent += 1;
        await prisma.adminPushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastNotifiedAt: new Date(),
            failedAt: null,
          },
        });
      } catch (error) {
        failed += 1;
        const statusCode = getPushStatusCode(error);
        const shouldDisable = statusCode === 404 || statusCode === 410;
        if (shouldDisable) disabled += 1;

        await prisma.adminPushSubscription.update({
          where: { id: subscription.id },
          data: {
            failedAt: new Date(),
            ...(shouldDisable ? { active: false } : {}),
          },
        });

        console.error("[admin-push] notification delivery failed", {
          statusCode,
          message: getSafePushErrorMessage(error),
          disabled: shouldDisable,
        });
      }
    }),
  );

  return {
    status: "sent",
    attempted: subscriptions.length,
    sent,
    failed,
    disabled,
  };
}

export async function notifyAdminsOfPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalInCents: true,
    },
  });

  if (!order) {
    return { status: "order_not_found" as const };
  }

  if (order.status !== "paid") {
    return { status: "order_not_paid" as const };
  }

  const notification = buildPaidOrderNotification(order);
  const existing = await prisma.adminNotification.findUnique({
    where: { dedupeKey: notification.dedupeKey },
    select: { id: true },
  });

  if (existing) {
    return { status: "already_notified" as const, notificationId: existing.id };
  }

  let created;
  try {
    created = await prisma.adminNotification.create({
      data: notification,
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: "already_notified" as const };
    }
    throw error;
  }

  const push = await sendAdminPushNotification({
    title: notification.title,
    body: notification.body,
    href: notification.href,
    tag: notification.dedupeKey,
  });

  return {
    status: "notified" as const,
    notificationId: created.id,
    push,
  };
}
