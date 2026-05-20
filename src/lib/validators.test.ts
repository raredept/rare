import { describe, expect, it } from "vitest";
import { checkoutRequestSchema, customerAddressSchema, productFormSchema } from "@/lib/validators";

const checkoutItems = [{ productId: "product_1", variantId: "variant_1", quantity: 1 }];

describe("validators", () => {
  it("normalizes customer address CEP and state", () => {
    const parsed = customerAddressSchema.parse({
      cep: "01001-000",
      street: "Rua Teste",
      number: "123",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "sp",
      isDefault: true,
    });

    expect(parsed.cep).toBe("01001000");
    expect(parsed.state).toBe("SP");
  });

  it("rejects guest checkout with invalid address", () => {
    const parsed = checkoutRequestSchema.safeParse({
      items: checkoutItems,
      guestCustomerData: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "11999998888",
      },
      guestAddress: {
        cep: "123",
        street: "Rua Teste",
        number: "123",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts positive product shipping dimensions", () => {
    const parsed = productFormSchema.parse({
      title: "Produto Teste",
      shortDescription: "Descricao curta",
      description: "Descricao completa do produto",
      priceInCents: 10000,
      weightGrams: 500,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      active: true,
      featured: false,
      featuredSortOrder: null,
      sortOrder: 0,
    });

    expect(parsed.weightGrams).toBe(500);
  });

  it("accepts nullable or positive manual featured order", () => {
    expect(
      productFormSchema.parse({
        title: "Produto Teste",
        shortDescription: "Descricao curta",
        description: "Descricao completa do produto",
        priceInCents: 10000,
        active: true,
        featured: true,
        featuredSortOrder: 1,
        sortOrder: 0,
      }).featuredSortOrder,
    ).toBe(1);
  });

  it("rejects invalid product shipping dimensions", () => {
    const parsed = productFormSchema.safeParse({
      title: "Produto Teste",
      shortDescription: "Descricao curta",
      description: "Descricao completa do produto",
      priceInCents: 10000,
      weightGrams: -1,
      active: true,
      featured: false,
      featuredSortOrder: null,
      sortOrder: 0,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects zero or negative manual featured order", () => {
    const parsed = productFormSchema.safeParse({
      title: "Produto Teste",
      shortDescription: "Descricao curta",
      description: "Descricao completa do produto",
      priceInCents: 10000,
      active: true,
      featured: true,
      featuredSortOrder: 0,
      sortOrder: 0,
    });

    expect(parsed.success).toBe(false);
  });
});
