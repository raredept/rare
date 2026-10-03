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
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", mustChangePassword: false });
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
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", mustChangePassword: true });

    const postResponse = await POST(request("POST", subscription) as never);
    const deleteResponse = await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never);

    expect(postResponse.status).toBe(403);
    expect(await postResponse.json()).toMatchObject({ code: "ADMIN_PASSWORD_CHANGE_REQUIRED" });
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

  it("deactivates only the endpoint for the current device", async () => {
    const response = await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never);

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint },
      data: { active: false, failedAt: expect.any(Date) },
    });
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
