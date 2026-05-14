import type { Prisma } from "@prisma/client";
import { formatCep } from "@/lib/cep";

export type CheckoutAddressSource = {
  label?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

export type CheckoutCustomerSource = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  addresses: CheckoutAddressSource[];
};

export type CheckoutGuestCustomerSource = {
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
};

export function buildAddressSnapshot(address?: CheckoutAddressSource | null): Prisma.InputJsonObject | undefined {
  if (!address) return undefined;

  return {
    label: address.label ?? null,
    recipientName: address.recipientName ?? null,
    phone: address.phone ?? null,
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement ?? null,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    country: "BR",
  };
}

export function buildCheckoutCustomerData(customer?: CheckoutCustomerSource | null, selectedAddress?: CheckoutAddressSource | null) {
  if (!customer) return {};

  const defaultAddress = selectedAddress ?? customer.addresses[0] ?? null;
  const addressSnapshot = buildAddressSnapshot(defaultAddress);

  return {
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerDocument: customer.cpf,
    customerNameSnapshot: customer.name,
    customerEmailSnapshot: customer.email,
    customerPhoneSnapshot: customer.phone,
    customerCpfSnapshot: customer.cpf,
    shippingAddressSnapshot: addressSnapshot,
    billingAddressSnapshot: addressSnapshot,
    cep: defaultAddress?.cep,
    addressLine1: defaultAddress ? `${defaultAddress.street}, ${defaultAddress.number}` : undefined,
    addressLine2: defaultAddress?.complement ?? undefined,
    neighborhood: defaultAddress?.neighborhood,
    city: defaultAddress?.city,
    state: defaultAddress?.state,
  };
}

export function buildGuestCheckoutCustomerData(customer: CheckoutGuestCustomerSource, address?: CheckoutAddressSource | null) {
  const addressSnapshot = buildAddressSnapshot(address);

  return {
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone ?? null,
    customerDocument: customer.cpf ?? null,
    customerNameSnapshot: customer.name,
    customerEmailSnapshot: customer.email,
    customerPhoneSnapshot: customer.phone ?? null,
    customerCpfSnapshot: customer.cpf ?? null,
    shippingAddressSnapshot: addressSnapshot,
    billingAddressSnapshot: addressSnapshot,
    cep: address?.cep,
    addressLine1: address ? `${address.street}, ${address.number}` : undefined,
    addressLine2: address?.complement ?? undefined,
    neighborhood: address?.neighborhood,
    city: address?.city,
    state: address?.state,
  };
}

export function canCustomerAccessOrder(order: { customerId: string | null }, customerId: string) {
  return Boolean(order.customerId && order.customerId === customerId);
}

export function canCustomerUseAddress(address: { customerId: string } | null | undefined, customerId: string) {
  return Boolean(address && address.customerId === customerId);
}

export function formatAddressSnapshotLines(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const data = snapshot as Record<string, unknown>;
  const street = typeof data.street === "string" ? data.street : "";
  const number = typeof data.number === "string" ? data.number : "";
  const complement = typeof data.complement === "string" && data.complement ? ` - ${data.complement}` : "";
  const neighborhood = typeof data.neighborhood === "string" ? data.neighborhood : "";
  const city = typeof data.city === "string" ? data.city : "";
  const state = typeof data.state === "string" ? data.state : "";
  const cep = typeof data.cep === "string" ? data.cep : "";

  return [
    street && number ? `${street}, ${number}${complement}` : "",
    neighborhood,
    city && state ? `${city} - ${state}` : city || state,
    cep ? `CEP ${formatCep(cep) || cep}` : "",
  ].filter(Boolean);
}
