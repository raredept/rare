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

const activeIphone = {
  id: "sub_iphone",
  endpoint: "https://web.push.apple.com/QOZbYk-device-token",
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
};

const paidOrder = { id: "order_1", orderNumber: "RARE-PAID", status: "paid", totalInCents: 19990 };

function arrangePaidOrder() {
  mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
  mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
  mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
  mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([activeIphone]);
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "public-vapid-key",
    WEB_PUSH_VAPID_PRIVATE_KEY: "private-vapid-key",
    WEB_PUSH_CONTACT: "mailto:contato@raredept.com.br",
  };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("notifyAdminsOfPaidOrder", () => {
  it("creates one admin notification and sends push to active subscriptions", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([
      {
        id: "sub_1",
        endpoint: "https://fcm.googleapis.com/fcm/send/sub_1",
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
    expect(mocks.prisma.adminPushSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
    }));
    expect(mocks.webPush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:contato@raredept.com.br",
      "public-vapid-key",
      "private-vapid-key",
    );
    expect(mocks.webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.webPush.sendNotification.mock.calls[0][2]).toEqual({ TTL: 3600, urgency: "high" });
    expect(mocks.prisma.adminPushSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: { lastNotifiedAt: expect.any(Date), failedAt: null },
    });
  });

  it("does not create or send a duplicate notification for the same paid order", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce({ id: "notification_1" });

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toEqual({ status: "already_notified", notificationId: "notification_1" });
    expect(mocks.prisma.adminNotification.create).not.toHaveBeenCalled();
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("ignores an order that is not paid", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    for (const status of ["pending", "awaiting_payment", "canceled", "refunded", "expired"]) {
      mocks.prisma.order.findUnique.mockResolvedValueOnce({ ...paidOrder, status });
      expect(await notifyAdminsOfPaidOrder("order_1")).toEqual({ status: "order_not_paid" });
    }
    mocks.prisma.order.findUnique.mockResolvedValueOnce(null);
    expect(await notifyAdminsOfPaidOrder("missing")).toEqual({ status: "order_not_found" });

    expect(mocks.prisma.adminNotification.create).not.toHaveBeenCalled();
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("a replayed webhook produces exactly one notification and one push per device", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValue(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: "notification_1" });
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValue([activeIphone]);
    mocks.webPush.sendNotification.mockResolvedValue({});
    mocks.prisma.adminPushSubscription.update.mockResolvedValue({});

    const first = await notifyAdminsOfPaidOrder("order_1");
    const replay = await notifyAdminsOfPaidOrder("order_1");
    const replayAgain = await notifyAdminsOfPaidOrder("order_1");

    expect(first.status).toBe("notified");
    expect(replay).toEqual({ status: "already_notified", notificationId: "notification_1" });
    expect(replayAgain.status).toBe("already_notified");
    expect(mocks.prisma.adminNotification.create).toHaveBeenCalledTimes(1);
    expect(mocks.webPush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("concurrent webhooks racing on the dedupe key send no second push", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    expect(await notifyAdminsOfPaidOrder("order_1")).toEqual({ status: "already_notified" });
    expect(mocks.prisma.adminPushSubscription.findMany).not.toHaveBeenCalled();
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("sends only order number, total and Admin link: no customer PII", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    // Even if the row carried customer data, only the selected fields may reach the payload.
    mocks.prisma.order.findUnique.mockResolvedValueOnce({
      ...paidOrder,
      customerName: "Maria Cliente da Silva",
      customerEmail: "maria@example.com",
      customerCpf: "12345678909",
      customerPhone: "+5511999999999",
      shippingAddress: "Rua Secreta 123",
    });
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([activeIphone]);
    mocks.webPush.sendNotification.mockResolvedValueOnce({});
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    await notifyAdminsOfPaidOrder("order_1");

    expect(mocks.prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order_1" },
      select: { id: true, orderNumber: true, status: true, totalInCents: true },
    });
    const rawPayload = mocks.webPush.sendNotification.mock.calls[0][1] as string;
    const payload = JSON.parse(rawPayload);
    expect(Object.keys(payload).sort()).toEqual(["badge", "body", "icon", "tag", "title", "url"]);
    expect(payload).toMatchObject({ title: "Venda aprovada", url: "/admin/orders/order_1", tag: "order_paid:order_1" });
    expect(payload.body).toContain("RARE-PAID");
    expect(payload.body).toMatch(/R\$\s?199,90/);
    for (const secret of ["Maria", "maria@example.com", "12345678909", "999999999", "Rua Secreta"]) {
      expect(rawPayload).not.toContain(secret);
    }
  });

  it.each([404, 410])("disables a subscription the push service reports as gone (%i)", async (statusCode) => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    vi.spyOn(console, "error").mockImplementation(() => {});
    arrangePaidOrder();
    mocks.webPush.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode }));
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toMatchObject({ push: { attempted: 1, sent: 0, failed: 1, disabled: 1 } });
    expect(mocks.prisma.adminPushSubscription.update).toHaveBeenCalledWith({
      where: { id: "sub_iphone" },
      data: { failedAt: expect.any(Date), active: false },
    });
  });

  it.each([400, 401, 403, 413, 429, 500, 502, 503, undefined])(
    "keeps the subscription active on a non-permanent failure (%s)",
    async (statusCode) => {
      const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
      vi.spyOn(console, "error").mockImplementation(() => {});
      arrangePaidOrder();
      mocks.webPush.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Temporary"), statusCode ? { statusCode } : {}));
      mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

      const result = await notifyAdminsOfPaidOrder("order_1");

      expect(result).toMatchObject({ push: { attempted: 1, sent: 0, failed: 1, disabled: 0 } });
      const data = mocks.prisma.adminPushSubscription.update.mock.calls[0][0].data;
      expect(data).toEqual({ failedAt: expect.any(Date) });
      expect(data).not.toHaveProperty("active");
    },
  );

  it("never logs the endpoint, the subscription keys or the VAPID private key", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    arrangePaidOrder();
    mocks.webPush.sendNotification.mockRejectedValueOnce(Object.assign(
      new Error(`Received unexpected response code ${activeIphone.endpoint} ${activeIphone.p256dh} ${"x".repeat(40)}`),
      { statusCode: 500, endpoint: activeIphone.endpoint, body: "detail" },
    ));
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    await notifyAdminsOfPaidOrder("order_1");

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(consoleError).toHaveBeenCalled();
    expect(logged).not.toContain("web.push.apple.com");
    expect(logged).not.toContain(activeIphone.p256dh);
    expect(logged).not.toContain(activeIphone.auth);
    expect(logged).not.toContain("x".repeat(40));
    expect(logged).not.toContain("private-vapid-key");
  });

  it("keeps the notification but skips delivery when VAPID is not configured", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toMatchObject({ status: "notified", push: { status: "not_configured", attempted: 0 } });
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
  });

  it("reports an invalid VAPID configuration without throwing or sending", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.webPush.setVapidDetails.mockImplementationOnce(() => {
      throw new Error("Vapid private key should be 32 bytes long when decoded.");
    });
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toMatchObject({ status: "notified", push: { status: "config_error", attempted: 0 } });
    expect(mocks.prisma.adminPushSubscription.findMany).not.toHaveBeenCalled();
    expect(mocks.webPush.sendNotification).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("private-vapid-key");
  });

  it("never POSTs to a stored endpoint outside the push-service allowlist", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    mocks.prisma.order.findUnique.mockResolvedValueOnce(paidOrder);
    mocks.prisma.adminNotification.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.adminNotification.create.mockResolvedValueOnce({ id: "notification_1" });
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([
      { ...activeIphone, id: "sub_ssrf", endpoint: "https://169.254.169.254/latest/meta-data" },
      activeIphone,
    ]);
    mocks.webPush.sendNotification.mockResolvedValueOnce({});
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    const result = await notifyAdminsOfPaidOrder("order_1");

    expect(result).toMatchObject({ push: { attempted: 1, sent: 1 } });
    expect(mocks.webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.webPush.sendNotification.mock.calls[0][0].endpoint).toBe(activeIphone.endpoint);
  });

  it("a bookkeeping failure after delivery does not throw into the payment flow", async () => {
    const { notifyAdminsOfPaidOrder } = await import("@/lib/admin-notifications");
    vi.spyOn(console, "error").mockImplementation(() => {});
    arrangePaidOrder();
    mocks.webPush.sendNotification.mockResolvedValueOnce({});
    mocks.prisma.adminPushSubscription.update.mockRejectedValueOnce(new Error("Record to update not found."));

    await expect(notifyAdminsOfPaidOrder("order_1")).resolves.toMatchObject({ status: "notified", push: { sent: 1 } });
  });
});

describe("sendAdminTestPushNotification", () => {
  it("targets only the requesting Admin's active devices and writes no sale data", async () => {
    const { sendAdminTestPushNotification } = await import("@/lib/admin-notifications");
    mocks.prisma.adminPushSubscription.findMany.mockResolvedValueOnce([activeIphone]);
    mocks.webPush.sendNotification.mockResolvedValueOnce({});
    mocks.prisma.adminPushSubscription.update.mockResolvedValueOnce({});

    const result = await sendAdminTestPushNotification("admin-1");

    expect(result).toEqual({ status: "sent", attempted: 1, sent: 1, failed: 0, disabled: 0 });
    expect(mocks.prisma.adminPushSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true, userId: "admin-1" },
    }));
    expect(mocks.prisma.order.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.adminNotification.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.adminNotification.create).not.toHaveBeenCalled();
    const payload = JSON.parse(mocks.webPush.sendNotification.mock.calls[0][1] as string);
    expect(payload.title).toMatch(/Teste/);
    expect(payload.body).toMatch(/Nenhuma venda foi criada/);
    expect(payload.url).toBe("/admin/notifications");
    expect(payload.tag).toBe("rare-admin-test");
    expect(mocks.webPush.sendNotification.mock.calls[0][2]).toEqual({ TTL: 300, urgency: "high" });
  });

  it("reports not_configured without touching subscriptions", async () => {
    const { sendAdminTestPushNotification } = await import("@/lib/admin-notifications");
    delete process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

    expect(await sendAdminTestPushNotification("admin-1")).toMatchObject({ status: "not_configured", attempted: 0 });
    expect(mocks.prisma.adminPushSubscription.findMany).not.toHaveBeenCalled();
  });
});
