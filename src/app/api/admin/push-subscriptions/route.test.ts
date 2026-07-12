import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/admin/push-subscriptions/route";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminPushSubscription: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
    },
  },
}));

const subscription = {
  endpoint: "https://push.example/subscription-1",
  keys: { p256dh: "public-encryption-key", auth: "auth-secret" },
};

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/admin/push-subscriptions", {
    method,
    headers: { "Content-Type": "application/json", "User-Agent": "test-browser" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.upsert.mockResolvedValue({ id: "push-1" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("admin push subscriptions route", () => {
  it("protects registration and removal with Admin authentication", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);

    expect((await POST(request("POST", subscription) as never)).status).toBe(401);
    expect((await DELETE(request("DELETE", { endpoint: subscription.endpoint }) as never)).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
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
});
