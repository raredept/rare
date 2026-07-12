import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreCheckoutPage } from "@/components/store/checkout-page";

const checkoutPageMocks = vi.hoisted(() => ({
  getCurrentCustomer: vi.fn(),
  getStoreSettings: vi.fn(),
  prisma: {
    customerAddress: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-page-client", () => ({
  CartPageClient: ({ customer }: { customer: { cpfMasked: string; hasCpf: boolean } }) =>
    createElement("div", null, `CHECKOUT:${customer.hasCpf}:${customer.cpfMasked}`),
}));

vi.mock("@/lib/customer-auth", () => ({
  getCurrentCustomer: checkoutPageMocks.getCurrentCustomer,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: checkoutPageMocks.prisma,
}));

vi.mock("@/lib/settings", () => ({
  getStoreSettings: checkoutPageMocks.getStoreSettings,
}));

vi.mock("@/lib/shipping", () => ({
  getEffectiveFixedShippingInCents: () => 0,
  getEffectiveFreeShippingThresholdInCents: () => null,
  getShippingPublicConfig: () => ({
    enabled: false,
    mode: "fixed",
    provider: "manual",
    originCepConfigured: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CHECKOUT_ENABLED", "true");
  checkoutPageMocks.getStoreSettings.mockResolvedValue({
    shippingMode: "fixed",
    manualShippingInCents: 0,
    fixedShippingInCents: 0,
    freeShippingMinInCents: null,
    freeShippingThresholdInCents: null,
    checkoutRequiresAddress: true,
    shippingInstructions: null,
  });
  checkoutPageMocks.prisma.customerAddress.findMany.mockResolvedValue([]);
});

describe("StoreCheckoutPage", () => {
  it("blocks the checkout UI before loading customer or shipping data when disabled", async () => {
    vi.stubEnv("CHECKOUT_ENABLED", "false");
    const element = await StoreCheckoutPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Compras temporariamente pausadas");
    expect(html).toContain("Nenhum pagamento será solicitado");
    expect(checkoutPageMocks.getCurrentCustomer).not.toHaveBeenCalled();
    expect(checkoutPageMocks.getStoreSettings).not.toHaveBeenCalled();
  });
  it("asks anonymous customers to log in or create an account with checkout next links", async () => {
    checkoutPageMocks.getCurrentCustomer.mockResolvedValueOnce(null);

    const element = await StoreCheckoutPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Para finalizar sua compra, entre ou crie sua conta.");
    expect(html).toContain('href="/entrar?next=%2Ffinalizar-compra"');
    expect(html).toContain('href="/cadastro?next=%2Ffinalizar-compra"');
    expect(checkoutPageMocks.prisma.customerAddress.findMany).not.toHaveBeenCalled();
  });

  it("passes only masked CPF state to the checkout client", async () => {
    checkoutPageMocks.getCurrentCustomer.mockResolvedValueOnce({
      id: "customer_1",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: null,
      cpf: "12345678909",
    });

    const element = await StoreCheckoutPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("CHECKOUT:true:***.456.789-**");
    expect(html).not.toContain("12345678909");
  });
});
