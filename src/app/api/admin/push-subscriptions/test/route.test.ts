import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/push-subscriptions/test/route";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  rateLimit: vi.fn(),
  sendAdminTestPushNotification: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/admin-notifications", () => ({ sendAdminTestPushNotification: mocks.sendAdminTestPushNotification }));

function request(origin = "http://localhost") {
  return new Request("http://localhost/api/admin/push-subscriptions/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost", origin },
    body: "{}",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SELLER_ADMIN", mustChangePassword: false });
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.sendAdminTestPushNotification.mockResolvedValue({ status: "sent", attempted: 1, sent: 1, failed: 0, disabled: 0 });
});

describe("admin test push route", () => {
  it("sends the test only to the current Admin's devices", async () => {
    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, attempted: 1, sent: 1, failed: 0, disabled: 0 });
    expect(mocks.sendAdminTestPushNotification).toHaveBeenCalledWith("admin-1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("requires an authenticated Admin", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    expect((await POST(request() as never)).status).toBe(401);
    expect(mocks.sendAdminTestPushNotification).not.toHaveBeenCalled();
  });

  it("requires the temporary password to be replaced first", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SELLER_ADMIN", mustChangePassword: true });
    expect((await POST(request() as never)).status).toBe(403);
    expect(mocks.sendAdminTestPushNotification).not.toHaveBeenCalled();
  });

  it("requires commerce.notifications (SYSTEM_ADMIN has no sale inbox)", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "SYSTEM_ADMIN", mustChangePassword: false });
    const response = await POST(request() as never);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ADMIN_PERMISSION_DENIED" });
    expect(mocks.sendAdminTestPushNotification).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    expect((await POST(request("https://attacker.example") as never)).status).toBe(403);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.sendAdminTestPushNotification).not.toHaveBeenCalled();
  });

  it("rate limits test pushes per Admin", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false });
    const response = await POST(request() as never);
    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("admin-push-test:admin-1", 5, 600_000);
    expect(mocks.sendAdminTestPushNotification).not.toHaveBeenCalled();
  });

  it.each(["not_configured", "config_error"])("reports %s as 503 without details", async (status) => {
    mocks.sendAdminTestPushNotification.mockResolvedValue({ status, attempted: 0, sent: 0, failed: 0, disabled: 0 });
    const response = await POST(request() as never);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "ADMIN_PUSH_NOT_CONFIGURED" });
  });

  it("reports 409 when the Admin has no active device", async () => {
    mocks.sendAdminTestPushNotification.mockResolvedValue({ status: "sent", attempted: 0, sent: 0, failed: 0, disabled: 0 });
    const response = await POST(request() as never);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ADMIN_PUSH_NO_ACTIVE_DEVICE" });
  });

  it("reports 502 when every delivery failed", async () => {
    mocks.sendAdminTestPushNotification.mockResolvedValue({ status: "sent", attempted: 2, sent: 0, failed: 2, disabled: 1 });
    const response = await POST(request() as never);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false, failed: 2, disabled: 1 });
  });
});
