import { describe, expect, it } from "vitest";
import {
  buildCheckoutCustomerData,
  buildGuestCheckoutCustomerData,
  canCustomerAccessOrder,
  canCustomerUseAddress,
  formatAddressSnapshotLines,
} from "@/lib/customer-order";

describe("customer order helpers", () => {
  it("keeps guest checkout without customer linkage", () => {
    expect(buildCheckoutCustomerData(null)).toEqual({});
  });

  it("builds customer linkage and immutable snapshots for logged checkout", () => {
    const data = buildCheckoutCustomerData({
      id: "customer_1",
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: "11999998888",
      cpf: "12345678909",
      addresses: [
        {
          label: "Casa",
          recipientName: "Cliente Teste",
          phone: "11999998888",
          cep: "01001000",
          street: "Rua Teste",
          number: "123",
          complement: "Apto 4",
          neighborhood: "Centro",
          city: "Sao Paulo",
          state: "SP",
        },
      ],
    });

    expect(data.customerId).toBe("customer_1");
    expect(data.customerEmailSnapshot).toBe("cliente@example.com");
    expect(data.shippingAddressSnapshot).toMatchObject({ city: "Sao Paulo", state: "SP" });
  });

  it("checks that customers only access their own linked orders", () => {
    expect(canCustomerAccessOrder({ customerId: "customer_1" }, "customer_1")).toBe(true);
    expect(canCustomerAccessOrder({ customerId: "customer_2" }, "customer_1")).toBe(false);
    expect(canCustomerAccessOrder({ customerId: null }, "customer_1")).toBe(false);
  });

  it("checks that customers only use their own checkout addresses", () => {
    expect(canCustomerUseAddress({ customerId: "customer_1" }, "customer_1")).toBe(true);
    expect(canCustomerUseAddress({ customerId: "customer_2" }, "customer_1")).toBe(false);
    expect(canCustomerUseAddress(null, "customer_1")).toBe(false);
  });

  it("builds guest checkout snapshots without creating a customer link", () => {
    const data = buildGuestCheckoutCustomerData(
      {
        name: "Cliente Guest",
        email: "guest@example.com",
        phone: "11999998888",
        cpf: "12345678909",
      },
      {
        cep: "01001000",
        street: "Rua Guest",
        number: "45",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
      },
    );

    expect("customerId" in data).toBe(false);
    expect(data.customerEmailSnapshot).toBe("guest@example.com");
    expect(data.shippingAddressSnapshot).toMatchObject({ street: "Rua Guest", number: "45" });
  });

  it("formats address snapshots without exposing unrelated internals", () => {
    expect(
      formatAddressSnapshotLines({
        cep: "01001000",
        street: "Rua Teste",
        number: "123",
        neighborhood: "Centro",
        city: "Sao Paulo",
        state: "SP",
      }),
    ).toEqual(["Rua Teste, 123", "Centro", "Sao Paulo - SP", "CEP 01001-000"]);
  });
});
