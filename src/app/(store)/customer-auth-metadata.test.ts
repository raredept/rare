import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/store/customer-auth-forms", () => ({
  CustomerLoginForm: () => null,
  CustomerRegisterForm: () => null,
}));

vi.mock("@/lib/customer-auth", () => ({
  getCurrentCustomer: vi.fn(),
}));

describe("customer auth page metadata", () => {
  it("sets noindex metadata for the login page", async () => {
    const { metadata: loginMetadata } = await import("@/app/(store)/entrar/page");

    expect(loginMetadata.title).toEqual({ absolute: "Entrar | RARE" });
    expect(loginMetadata.description).toBe("Acesse sua conta RARE com segurança para acompanhar pedidos.");
    expect(loginMetadata.robots).toEqual({ index: false, follow: false });
    expect(loginMetadata.alternates).toEqual({ canonical: "/entrar" });
  });

  it("sets noindex metadata for the registration page", async () => {
    const { metadata: registerMetadata } = await import("@/app/(store)/cadastro/page");

    expect(registerMetadata.title).toEqual({ absolute: "Criar cadastro | RARE" });
    expect(registerMetadata.description).toBe("Crie sua conta RARE para comprar e acompanhar pedidos com segurança.");
    expect(registerMetadata.robots).toEqual({ index: false, follow: false });
    expect(registerMetadata.alternates).toEqual({ canonical: "/cadastro" });
  });
});
