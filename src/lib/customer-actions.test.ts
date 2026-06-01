import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  hash: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  signCustomerSession: vi.fn(),
  setCustomerSessionCookie: vi.fn(),
  clearCustomerSessionCookie: vi.fn(),
  requireCustomer: vi.fn(),
  prisma: {
    customer: {
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: actionMocks.hash,
  },
}));

vi.mock("next/navigation", () => ({
  redirect: actionMocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: actionMocks.revalidatePath,
}));

vi.mock("@/lib/customer-auth", () => ({
  clearCustomerSessionCookie: actionMocks.clearCustomerSessionCookie,
  requireCustomer: actionMocks.requireCustomer,
  signCustomerSession: actionMocks.signCustomerSession,
  setCustomerSessionCookie: actionMocks.setCustomerSessionCookie,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: actionMocks.prisma,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: actionMocks.rateLimit,
}));

function buildRegisterFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("name", "Cliente Teste");
  formData.set("email", "cliente@example.com");
  formData.set("phone", "(11) 99999-8888");
  formData.set("cpf", "123.456.789-09");
  formData.set("password", "password123");
  formData.set("passwordConfirmation", "password123");
  formData.set("next", "/finalizar-compra");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.hash.mockResolvedValue("hashed-password");
  actionMocks.rateLimit.mockReturnValue({ ok: true });
  actionMocks.prisma.customer.create.mockResolvedValue({ id: "customer_1", email: "cliente@example.com" });
  actionMocks.signCustomerSession.mockResolvedValue("customer-token");
});

describe("customer actions", () => {
  it("blocks registration without CPF", async () => {
    const { registerCustomerAction } = await import("@/lib/customer-actions");

    const result = await registerCustomerAction({}, buildRegisterFormData({ cpf: "" }));

    expect(result.error).toBe("Revise os campos do cadastro.");
    expect(result.fieldErrors?.cpf).toContain("Informe seu CPF.");
    expect(actionMocks.prisma.customer.create).not.toHaveBeenCalled();
  });

  it("blocks registration with invalid CPF", async () => {
    const { registerCustomerAction } = await import("@/lib/customer-actions");

    const result = await registerCustomerAction({}, buildRegisterFormData({ cpf: "111.111.111-11" }));

    expect(result.error).toBe("Revise os campos do cadastro.");
    expect(result.fieldErrors?.cpf).toContain("CPF inválido.");
    expect(actionMocks.prisma.customer.create).not.toHaveBeenCalled();
  });

  it("saves a valid registration CPF normalized and returns to checkout", async () => {
    const { registerCustomerAction } = await import("@/lib/customer-actions");

    await expect(registerCustomerAction({}, buildRegisterFormData())).rejects.toThrow("NEXT_REDIRECT:/finalizar-compra");

    expect(actionMocks.prisma.customer.create).toHaveBeenCalledWith({
      data: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "11999998888",
        cpf: "12345678909",
        passwordHash: "hashed-password",
      },
      select: {
        id: true,
        email: true,
      },
    });
    expect(actionMocks.setCustomerSessionCookie).toHaveBeenCalledWith("customer-token");
  });
});
