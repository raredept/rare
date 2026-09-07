import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
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
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customerAddress: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  tx: {
    customerAddress: {
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bcryptjs")>();
  return {
    default: {
      ...actual.default,
      hash: actionMocks.hash,
      compare: actionMocks.compare,
    },
  };
});

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

function buildLoginFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", "cliente@example.com");
  formData.set("password", "password123");
  formData.set("next", "/minha-conta");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

function buildAddressFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("label", "Casa");
  formData.set("recipientName", "Cliente Teste");
  formData.set("phone", "(11) 99999-8888");
  formData.set("cep", "01001-000");
  formData.set("street", "Praça da Sé");
  formData.set("number", "100");
  formData.set("complement", "Apto 1");
  formData.set("neighborhood", "Sé");
  formData.set("city", "São Paulo");
  formData.set("state", "SP");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.hash.mockResolvedValue("hashed-password");
  actionMocks.compare.mockResolvedValue(true);
  actionMocks.rateLimit.mockReturnValue({ ok: true });
  actionMocks.prisma.customer.create.mockResolvedValue({ id: "customer_1", email: "cliente@example.com" });
  actionMocks.prisma.customer.findFirst.mockResolvedValue({
    id: "customer_1",
    email: "cliente@example.com",
    passwordHash: "hashed-password",
  });
  actionMocks.prisma.customerAddress.findFirst.mockResolvedValue({ id: "address_1" });
  actionMocks.requireCustomer.mockResolvedValue({ id: "customer_1", cpf: "12345678909" });
  actionMocks.tx.customerAddress.count.mockResolvedValue(0);
  actionMocks.tx.customerAddress.findFirst.mockResolvedValue({ id: "address_1", isDefault: true });
  actionMocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof actionMocks.tx) => unknown) => callback(actionMocks.tx));
  actionMocks.signCustomerSession.mockResolvedValue("customer-token");
});

describe("customer actions", () => {
  it.each([
    "Aa1" + "x".repeat(70),
    "Aa1" + "á".repeat(35),
  ])("rejects registration passwords that bcrypt would truncate", async (password) => {
    const { registerCustomerAction } = await import("@/lib/customer-actions");
    const result = await registerCustomerAction({}, buildRegisterFormData({ password, passwordConfirmation: password }));

    expect(result.fieldErrors?.password).toEqual([
      "A senha e longa demais. Use ate 72 caracteres simples ou reduza os caracteres especiais.",
    ]);
    expect(actionMocks.hash).not.toHaveBeenCalled();
    expect(actionMocks.prisma.customer.create).not.toHaveBeenCalled();
    expect(actionMocks.setCustomerSessionCookie).not.toHaveBeenCalled();
  });

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

  it("logs in a valid active customer and redirects to the allowlisted page", async () => {
    const { loginCustomerAction } = await import("@/lib/customer-actions");

    await expect(loginCustomerAction({}, buildLoginFormData())).rejects.toThrow("NEXT_REDIRECT:/minha-conta");

    expect(actionMocks.prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "cliente@example.com", active: true },
    }));
    expect(actionMocks.compare).toHaveBeenCalledWith("password123", "hashed-password");
    expect(actionMocks.setCustomerSessionCookie).toHaveBeenCalledWith("customer-token");
  });

  it("rejects an invalid customer password without creating a session", async () => {
    actionMocks.compare.mockResolvedValueOnce(false);
    const { loginCustomerAction } = await import("@/lib/customer-actions");

    await expect(loginCustomerAction({}, buildLoginFormData())).resolves.toEqual({ error: "Credenciais invalidas." });
    expect(actionMocks.setCustomerSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the customer session on logout", async () => {
    const { logoutCustomerAction } = await import("@/lib/customer-actions");

    await expect(logoutCustomerAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(actionMocks.clearCustomerSessionCookie).toHaveBeenCalledOnce();
  });

  it("creates the first address as default after server-side validation", async () => {
    const { createCustomerAddressAction } = await import("@/lib/customer-actions");

    await expect(createCustomerAddressAction({}, buildAddressFormData())).resolves.toEqual({
      success: "Endereco cadastrado com sucesso.",
    });
    expect(actionMocks.requireCustomer).toHaveBeenCalledWith("/minha-conta/enderecos");
    expect(actionMocks.tx.customerAddress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer_1",
        cep: "01001000",
        phone: "11999998888",
        isDefault: true,
      }),
    });
  });

  it("rejects an invalid address payload before opening a transaction", async () => {
    const { createCustomerAddressAction } = await import("@/lib/customer-actions");

    const result = await createCustomerAddressAction({}, buildAddressFormData({ cep: "123" }));
    expect(result.error).toBe("Revise o endereco informado.");
    expect(actionMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not mutate an address when customer authentication fails", async () => {
    actionMocks.requireCustomer.mockRejectedValueOnce(new Error("unauthorized"));
    const { createCustomerAddressAction } = await import("@/lib/customer-actions");

    await expect(createCustomerAddressAction({}, buildAddressFormData())).rejects.toThrow("unauthorized");
    expect(actionMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates only an address owned by the authenticated customer", async () => {
    const { updateCustomerAddressAction } = await import("@/lib/customer-actions");

    await expect(updateCustomerAddressAction("address_1", buildAddressFormData({ number: "101" })))
      .rejects.toThrow("NEXT_REDIRECT:/minha-conta/enderecos");
    expect(actionMocks.prisma.customerAddress.findFirst).toHaveBeenCalledWith({
      where: { id: "address_1", customerId: "customer_1" },
      select: { id: true },
    });
    expect(actionMocks.tx.customerAddress.update).toHaveBeenCalledWith({
      where: { id: "address_1" },
      data: expect.objectContaining({ number: "101" }),
    });
  });

  it("deletes an owned address and promotes the next address when needed", async () => {
    actionMocks.tx.customerAddress.findFirst
      .mockResolvedValueOnce({ id: "address_1", isDefault: true })
      .mockResolvedValueOnce({ id: "address_2" });
    const formData = new FormData();
    formData.set("id", "address_1");
    const { deleteCustomerAddressAction } = await import("@/lib/customer-actions");

    await expect(deleteCustomerAddressAction(formData)).rejects.toThrow("NEXT_REDIRECT:/minha-conta/enderecos");
    expect(actionMocks.tx.customerAddress.delete).toHaveBeenCalledWith({ where: { id: "address_1" } });
    expect(actionMocks.tx.customerAddress.update).toHaveBeenCalledWith({
      where: { id: "address_2" },
      data: { isDefault: true },
    });
  });

  it("propagates an unexpected address persistence failure without returning false success", async () => {
    actionMocks.prisma.$transaction.mockRejectedValueOnce(new Error("private database detail"));
    const { createCustomerAddressAction } = await import("@/lib/customer-actions");

    await expect(createCustomerAddressAction({}, buildAddressFormData())).rejects.toThrow("private database detail");
  });
});
