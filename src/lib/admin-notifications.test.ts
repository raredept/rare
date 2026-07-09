import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    adminNotification: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    adminPushSubscription: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  webPush: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("web-push", () => ({
  default: mocks.webPush,
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "public-vapid-key",
    WEB_PUSH_VAPID_PRIVATE_KEY: "private-vapid-key",
    WEB_PUSH_CONTACT: "mailto:contato@raredept.com.br",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("notifyAdminsOfPaidOrder", () => {
  it("creates one admin notification and sends push to active subscriptions", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNumber: "RARE-PAID",
      status: "paid",
      totalInCents: 19990,
    });
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub_1",
        endpoint: "https://push.example/sub_1",
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
    ]);
    mocks.webPush.sendNotification.mockResolvedValueOnce({});
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toMatchObject({
      status: "notified",
      notificationId: "notification_1",
      push: {
        status: "sent",
        attempted: 1,
        sent: 1,
        failed: 0,
      },
    });
    expect(mocks.prisma.adminNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "order_paid",
        title: "Venda aprovada",
        href: "/admin/orders/order_1",
        orderId: "order_1",
        dedupeKey: "order_paid:order_1",
      }),
      select: { id: true },
    });
    expect(mocks.webPush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:contato@raredept.com.br",
      "public-vapid-key",
      "private-vapid-key",
    );
    expect(mocks.webPush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("does not create or send a duplicate notification for the same paid order", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNumber: "RARE-PAID",
      status: "paid",
      totalInCents: 19990,
    });
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce({ id: "notification_1" });

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toEqual({ status: "already_notified", notificationId: "notification_1" });
    expect(mocks.prisma.adminNotification.create).not.toHaveBeenCalled();
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });
});
