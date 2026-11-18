import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/admin/push-subscriptions/route";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminPushSubscription: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
    },
  },
}));

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/subscription-1",
  keys: { p256dh: "public-encryption-key", auth: "auth-secret" },
};

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/admin/push-subscriptions", {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "test-browser",
      host: "localhost",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SELLER_ADMIN", mustChangePassword: false });
  mocks.upsert.mockResolvedValue({ id: "push-1" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.rateLimit.mockResolvedValue({ ok: true });
});

describe("admin push subscriptions route", () => {
  it.each([POST, DELETE])("limits actual bytes even without a trustworthy content-length", async (handler) => {
    const method = handler === POST ? "POST" : "DELETE";
    const oversized = request(method, { ...subscription, padding: "x".repeat(4096) });
    oversized.headers.set("content-length", "1");
    expect((await handler(oversized as never)).status).toBe(413);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("rejects an unexpected content type before mutation", async (handler) => {
    const value = request(handler === POST ? "POST" : "DELETE", subscription);
    value.headers.set("content-type", "text/plain");
    expect((await handler(value as never)).status).toBe(415);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it.each([POST, DELETE])("rate limits both mutation methods per Admin", async (handler) => {
    mocks.rateLimit.mockResolvedValue({ ok: false });
    expect((await handler(request(handler === POST ? "POST" : "DELETE", subscription) as never)).status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("admin-push:admin-1", 120, 60_000);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("protects registration and removal with Admin authentication", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);

    expect((await POST(request("POST", subscription) as never)).status).toBe(401);
    expect((await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never)).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("blocks every mutation until the temporary password is replaced", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SELLER_ADMIN", mustChangePassword: true });

    const postResponse = await POST(request("POST", subscription) as never);
    const deleteResponse = await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never);

    expect(postResponse.status).toBe(403);
    expect(await postResponse.json()).toMatchObject({ code: "ADMIN_PASSWORD_CHANGE_REQUIRED" });
    expect(deleteResponse.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a SYSTEM_ADMIN, whose role has no commercial notification inbox", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SYSTEM_ADMIN", mustChangePassword: false });

    const postResponse = await POST(request("POST", subscription) as never);
    const deleteResponse = await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never);

    expect(postResponse.status).toBe(403);
    expect(await postResponse.json()).toMatchObject({ code: "ADMIN_PERMISSION_DENIED" });
    expect(deleteResponse.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects cross-origin state changes", async () => {
    const forgedRequest = new Request("http://localhost/api/admin/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "localhost", origin: "https://attacker.example" },
      body: JSON.stringify(subscription),
    });

    expect((await POST(forgedRequest as never)).status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("registers the current device idempotently by endpoint", async () => {
    const response = await POST(request("POST", subscription) as never);

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { endpoint: subscription.endpoint },
      create: expect.objectContaining({ userId: "admin-1", active: true }),
      update: expect.objectContaining({ userId: "admin-1", active: true, failedAt: null }),
    }));
  });

  it("deactivates only the endpoint for the current device, scoped to the current Admin", async () => {
    const response = await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never);

    expect(response.status).toBe(200);
    // Never "all rows of this user": the Admin's other devices keep receiving sale alerts.
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint, userId: "admin-1" },
      data: { active: false, failedAt: expect.any(Date) },
    });
  });

  it("creates a new device and refreshes the keys of a known one through the same endpoint upsert", async () => {
    await POST(request("POST", subscription) as never);
    const rotated = { ...subscription, keys: { p256dh: "rotated-p256dh", auth: "rotated-auth" } };
    await POST(request("POST", rotated) as never);

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({
      where: { endpoint: subscription.endpoint },
      create: { userId: "admin-1", endpoint: subscription.endpoint, p256dh: "public-encryption-key", auth: "auth-secret", userAgent: "test-browser", active: true },
    });
    expect(mocks.upsert.mock.calls[1][0]).toMatchObject({
      where: { endpoint: subscription.endpoint },
      update: { userId: "admin-1", p256dh: "rotated-p256dh", auth: "rotated-auth", active: true, failedAt: null },
    });
  });

  it("supports several devices per Admin: uniqueness is the endpoint, never the user", async () => {
    const iphone = { ...subscription, endpoint: "https://web.push.apple.com/QAbc-iphone" };
    const desktop = { ...subscription, endpoint: "https://fcm.googleapis.com/fcm/send/desktop" };
    expect((await POST(request("POST", iphone) as never)).status).toBe(200);
    expect((await POST(request("POST", desktop) as never)).status).toBe(200);

    expect(mocks.upsert.mock.calls.map(([args]) => args.where)).toEqual([
      { endpoint: iphone.endpoint },
      { endpoint: desktop.endpoint },
    ]);
  });

  it("accepts an Apple Web Push endpoint from an iPhone Home Screen app", async () => {
    const response = await POST(request("POST", { ...subscription, endpoint: "https://web.push.apple.com/QOZbYk-test-token" }) as never);
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  // PushSubscription.toJSON() in Safari/iOS, Chrome and Firefox always carries expirationTime
  // (null on every push service in use today). The client posts toJSON() as is.
  it.each([
    ["iPhone Home Screen app", "https://web.push.apple.com/QOZbYk-real-token", null],
    ["Chrome", "https://fcm.googleapis.com/fcm/send/real-token", null],
    ["a service that sets an expiry", "https://updates.push.services.mozilla.com/wpush/v2/real", 1_795_000_000_000],
  ])("accepts the real browser shape from %s (with expirationTime)", async (_label, endpoint, expirationTime) => {
    const response = await POST(request("POST", { endpoint, expirationTime, keys: subscription.keys }) as never);
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    // The expiry is not stored: the row keeps exactly the fields it had.
    expect(mocks.upsert.mock.calls[0][0].create).not.toHaveProperty("expirationTime");
  });

  it.each([
    ["an unknown top-level field", { ...subscription, expirationTime: null, extra: "x" }],
    ["an unknown key field", { ...subscription, keys: { ...subscription.keys, extra: "x" } }],
    ["a non-numeric expiry", { ...subscription, expirationTime: "tomorrow" }],
  ])("still rejects %s", async (_label, body) => {
    expect((await POST(request("POST", body) as never)).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed or oversized subscriptions", async () => {
    const response = await POST(request("POST", { endpoint: "not-a-url", keys: { p256dh: "", auth: "" } }) as never);

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/x",
    "https://169.254.169.254/latest/meta-data",
    "https://redis.railway.internal/x",
    "https://evil.example/fcm.googleapis.com",
  ])("refuses to store a non-push-service endpoint: %s", async (endpoint) => {
    const response = await POST(request("POST", { ...subscription, endpoint }) as never);

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
