import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/cron/release-expired-inventory/route";

const cronMocks = vi.hoisted(() => ({
  releaseExpiredReservations: vi.fn(),
}));

vi.mock("@/lib/checkout", () => ({
  releaseExpiredReservations: cronMocks.releaseExpiredReservations,
}));

const originalEnv = process.env;

function request(secret?: string) {
  return new Request("http://localhost/api/cron/release-expired-inventory", {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
  });
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    CRON_SECRET: "cron-secret-with-more-than-32-characters",
  };
  vi.clearAllMocks();
  cronMocks.releaseExpiredReservations.mockResolvedValue(2);
});

afterEach(() => {
  process.env = originalEnv;
});

describe("release expired inventory cron route", () => {
  it("rejects requests without the configured bearer secret", async () => {
    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(cronMocks.releaseExpiredReservations).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    process.env.CRON_SECRET = "";

    const response = await GET(request("cron-secret-with-more-than-32-characters") as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Cron not configured." });
    expect(cronMocks.releaseExpiredReservations).not.toHaveBeenCalled();
  });

  it("releases expired reservations when Vercel Cron sends the bearer secret", async () => {
    const response = await GET(request("cron-secret-with-more-than-32-characters") as never);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.releasedReservations).toBe(2);
    expect(body.timestamp).toEqual(expect.any(String));
    expect(serialized).not.toContain("cron-secret-with-more-than-32-characters");
    expect(cronMocks.releaseExpiredReservations).toHaveBeenCalledTimes(1);
  });
});
