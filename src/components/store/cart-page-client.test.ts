import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartPageClient, resolveShippingOptionSelection } from "@/components/store/cart-page-client";

const cartMocks = vi.hoisted(() => ({
  state: {
    items: [] as Array<{
      productId: string;
      variantId: string;
      title: string;
      slug: string;
      size: string;
      image?: string;
      priceInCents: number;
      quantity: number;
      maxQuantity: number;
    }>,
    subtotalInCents: 0,
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/store/cart-context", () => ({
  useCart: () => ({
    items: cartMocks.state.items,
    subtotalInCents: cartMocks.state.subtotalInCents,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
  }),
}));

const checkoutCustomer = {
  name: "Cliente Teste",
  email: "cliente@example.com",
  phone: "11999998888",
  hasCpf: true,
  cpfMasked: "***.456.789-**",
};

const checkoutAddress = {
  id: "addr_1",
  label: "Casa",
  recipientName: null,
  phone: null,
  cep: "01001000",
  street: "Rua Teste",
  number: "123",
  complement: null,
  neighborhood: "Centro",
  city: "Sao Paulo",
  state: "SP",
  isDefault: true,
};

describe("CartPageClient", () => {
  it("renders an intentional empty cart state with useful storefront CTAs", () => {
    cartMocks.state.items = [];
    cartMocks.state.subtotalInCents = 0;
    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: checkoutCustomer,
        addresses: [checkoutAddress],
        initialSelectedAddressId: "addr_1",
        shippingSettings: {
          shippingMode: "fixed",
          fixedShippingInCents: 0,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: false,
          mode: "fixed",
          provider: "manual",
          originCepConfigured: false,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Sua seleção ainda está vazia.");
    expect(html).toContain("Ver destaques");
    expect(html).toContain('href="/categoria/destaques"');
    expect(html).toContain("Explorar catálogo");
    expect(html).toContain('href="/categoria/tudo"');
  });

  it("renders the shipping quote controls when automatic shipping is enabled", () => {
    cartMocks.state.items = [
      {
        productId: "prod_1",
        variantId: "var_1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        priceInCents: 10000,
        quantity: 1,
        maxQuantity: 2,
      },
    ];
    cartMocks.state.subtotalInCents = 10000;

    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: checkoutCustomer,
        addresses: [checkoutAddress],
        initialSelectedAddressId: "addr_1",
        shippingSettings: {
          shippingMode: "manual",
          fixedShippingInCents: 0,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: true,
          mode: "manual",
          provider: "manual",
          originCepConfigured: true,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Escolha uma forma de entrega");
    expect(html).toContain("Calcule o frete");
    expect(html).toContain("CEP usado: 01001-000");
    expect(html).toContain("Escolha uma entrega para continuar.");
    expect(html).toContain("Total");
    expect(html).toContain("100,00");
    expect(html).not.toContain("50,00");
  });

  it("does not show a definitive freight value from fixed settings while automatic shipping has no selected option", () => {
    cartMocks.state.items = [
      {
        productId: "prod_1",
        variantId: "var_1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        priceInCents: 31999,
        quantity: 1,
        maxQuantity: 2,
      },
    ];
    cartMocks.state.subtotalInCents = 31999;

    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: checkoutCustomer,
        addresses: [checkoutAddress],
        initialSelectedAddressId: "addr_1",
        shippingSettings: {
          shippingMode: "fixed",
          fixedShippingInCents: 5000,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: true,
          mode: "fixed",
          provider: "manual",
          originCepConfigured: false,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Subtotal");
    expect(html).toContain("319,99");
    expect(html).toContain("Entrega combinada com valor fixo para este pedido.");
    expect(html).toContain("Aguardando frete fixo");
    expect(html).toContain("Aguarde a validação do frete fixo.");
    expect(html).not.toContain("Calcule o frete");
    expect(html).not.toContain("Calcule o frete com seu CEP.");
    expect(html).not.toContain("50,00");
    expect(html).not.toContain("369,99");
  });

  it("asks a logged customer without CPF to complete the document before checkout", () => {
    cartMocks.state.items = [
      {
        productId: "prod_1",
        variantId: "var_1",
        title: "Camiseta RARE",
        slug: "camiseta-rare",
        size: "M",
        priceInCents: 10000,
        quantity: 1,
        maxQuantity: 2,
      },
    ];
    cartMocks.state.subtotalInCents = 10000;

    const html = renderToStaticMarkup(
      createElement(CartPageClient, {
        customer: { ...checkoutCustomer, hasCpf: false, cpfMasked: "" },
        addresses: [checkoutAddress],
        initialSelectedAddressId: "addr_1",
        shippingSettings: {
          shippingMode: "fixed",
          fixedShippingInCents: 0,
          checkoutRequiresAddress: true,
        },
        shippingConfig: {
          enabled: false,
          mode: "fixed",
          provider: "manual",
          originCepConfigured: false,
        },
      }) as ReactElement,
    );

    expect(html).toContain("Complete seus dados");
    expect(html).toContain("Precisamos do CPF para emissão e envio do pedido.");
    expect(html).toContain("Salve um CPF válido em Complete seus dados para liberar o checkout.");
    expect(html).toContain("disabled=\"\"");
  });

  it("resolves a selected shipping option only when it still matches CEP, preference, and expiration", () => {
    const now = Date.parse("2030-01-01T12:00:00.000Z");
    const pac = {
      id: "manual:PAC",
      provider: "manual",
      service: "PAC" as const,
      label: "PAC",
      amountCents: 1990,
      deliveryEstimateText: "Chega em 5 a 9 dias úteis",
      originCep: "01001000",
      destinationCep: "01001000",
      expiresAt: "2030-01-01T12:30:00.000Z",
    };
    const sedex = {
      ...pac,
      id: "manual:SEDEX",
      service: "SEDEX" as const,
      label: "SEDEX",
      amountCents: 2990,
    };
    const fixed = {
      ...pac,
      id: "fixed",
      provider: "fixed",
      service: "fixed" as const,
      label: "Frete fixo",
      amountCents: 2500,
      originCep: null,
    };

    expect(
      resolveShippingOptionSelection([pac, sedex], {
        normalizedCep: "01001000",
        preferredOptionId: "manual:SEDEX",
        now,
      })?.id,
    ).toBe("manual:SEDEX");
    expect(resolveShippingOptionSelection([pac], { normalizedCep: "01001000", autoSelectSingle: true, now })?.id).toBe(
      "manual:PAC",
    );
    expect(resolveShippingOptionSelection([fixed], { normalizedCep: "01001000", autoSelectSingle: true, now })?.id).toBe(
      "fixed",
    );
    expect(
      resolveShippingOptionSelection([{ ...pac, destinationCep: "22041001" }], {
        normalizedCep: "01001000",
        autoSelectSingle: true,
        now,
      }),
    ).toBeNull();
    expect(
      resolveShippingOptionSelection([{ ...pac, expiresAt: "2030-01-01T11:59:00.000Z" }], {
        normalizedCep: "01001000",
        autoSelectSingle: true,
        now,
      }),
    ).toBeNull();
  });
});
