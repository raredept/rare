import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getAdminSessionSecret: () => "test-admin-session-secret-with-more-than-32-characters",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { customer: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customer session revocation", () => {
  it("only finds the customer when the token carries the current sessionVersion", async () => {
    const { signCustomerSession, getCurrentCustomer } = await import("@/lib/customer-auth");
    mocks.cookieGet.mockReturnValue({ value: await signCustomerSession({ id: "customer-1", email: "c@example.com", sessionVersion: 5 }) });
    mocks.findFirst.mockResolvedValue(null);

    await expect(getCurrentCustomer()).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "customer-1", active: true, sessionVersion: 5 },
    }));
  });

  it("treats a token issued before sessionVersion existed as version 0", async () => {
    const { SignJWT } = await import("jose");
    const { verifyCustomerSession } = await import("@/lib/customer-auth");
    const legacy = await new SignJWT({ email: "c@example.com", role: "CUSTOMER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("customer-1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("test-admin-session-secret-with-more-than-32-characters"));

    await expect(verifyCustomerSession(legacy)).resolves.toMatchObject({ sub: "customer-1", sessionVersion: 0 });
  });

  it("revokes every session of the account on logout and clears the cookie", async () => {
    const { signCustomerSession, endCustomerSession } = await import("@/lib/customer-auth");
    mocks.cookieGet.mockReturnValue({ value: await signCustomerSession({ id: "customer-1", email: "c@example.com", sessionVersion: 1 }) });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await endCustomerSession();

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "customer-1", sessionVersion: 1 },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("rare_customer_session");
  });

  it("ignores a forged token and still clears the cookie", async () => {
    const { endCustomerSession } = await import("@/lib/customer-auth");
    mocks.cookieGet.mockReturnValue({ value: "forged" });

    await endCustomerSession();

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith("rare_customer_session");
  });
});
