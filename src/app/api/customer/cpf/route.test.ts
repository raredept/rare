import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/customer/cpf/route";

const routeMocks = vi.hoisted(() => ({
  getCurrentCustomer: vi.fn(),
  prisma: {
    customer: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/customer-auth", () => ({
  getCurrentCustomer: routeMocks.getCurrentCustomer,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: routeMocks.prisma,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RATE_LIMIT_DRIVER", "memory");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("customer CPF route", () => {
  it("requires a customer session before saving CPF", async () => {
    routeMocks.getCurrentCustomer.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/customer/cpf", {
        method: "POST",
        body: JSON.stringify({ cpf: "123.456.789-09" }),
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Para finalizar sua compra, entre ou crie sua conta." });
    expect(routeMocks.prisma.customer.update).not.toHaveBeenCalled();
  });

  it("requires a CPF value", async () => {
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      cpf: null,
    });

    const response = await POST(
      new Request("http://localhost/api/customer/cpf", {
        method: "POST",
        body: JSON.stringify({ cpf: "" }),
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Informe seu CPF." });
    expect(routeMocks.prisma.customer.update).not.toHaveBeenCalled();
  });

  it("rejects invalid CPF values", async () => {
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      cpf: null,
    });

    const response = await POST(
      new Request("http://localhost/api/customer/cpf", {
        method: "POST",
        body: JSON.stringify({ cpf: "111.111.111-11" }),
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "CPF inválido." });
    expect(routeMocks.prisma.customer.update).not.toHaveBeenCalled();
  });

  it("saves a valid CPF normalized and returns only the masked value", async () => {
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      cpf: null,
    });
    routeMocks.prisma.customer.update.mockResolvedValueOnce({ cpf: "12345678909" });

    const response = await POST(
      new Request("http://localhost/api/customer/cpf", {
        method: "POST",
        body: JSON.stringify({ cpf: "123.456.789-09" }),
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ cpfMasked: "***.456.789-**", hasCpf: true });
    expect(JSON.stringify(body)).not.toContain("12345678909");
    expect(routeMocks.prisma.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: { cpf: "12345678909" },
      select: { cpf: true },
    });
  });

  it("does not overwrite an already valid CPF from the checkout completion route", async () => {
    routeMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      cpf: "12345678909",
    });

    const response = await POST(
      new Request("http://localhost/api/customer/cpf", {
        method: "POST",
        body: JSON.stringify({ cpf: "935.411.347-80" }),
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ cpfMasked: "***.456.789-**", hasCpf: true });
    expect(routeMocks.prisma.customer.update).not.toHaveBeenCalled();
  });

  describe("rate limit identity", () => {
    function post(headers: Record<string, string>) {
      return POST(new Request("http://localhost/api/customer/cpf", { method: "POST", headers, body: "{}" }) as never);
    }

    it("cannot be evaded by rotating a client-supplied X-Forwarded-For prefix", async () => {
      routeMocks.getCurrentCustomer.mockResolvedValue(null);
      const statuses: number[] = [];

      for (let i = 0; i < 40; i += 1) {
        statuses.push((await post({ "x-forwarded-for": `10.9.8.${i}, 203.0.113.50` })).status);
      }

      expect(statuses.filter((status) => status === 429).length).toBe(10);
      expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    });

    it("keeps separate buckets for genuinely different edge-reported clients", async () => {
      routeMocks.getCurrentCustomer.mockResolvedValue(null);

      for (let i = 0; i < 31; i += 1) await post({ "cf-connecting-ip": "198.51.100.10" });

      expect((await post({ "cf-connecting-ip": "198.51.100.10" })).status).toBe(429);
      expect((await post({ "cf-connecting-ip": "198.51.100.11" })).status).toBe(401);
    });
  });
});
