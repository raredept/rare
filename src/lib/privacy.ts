import { isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";

export { formatCpf, isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeOptionalCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value);
  if (!cpf) return null;
  if (!isValidCpf(cpf)) {
    throw new Error("CPF invalido.");
  }
  return cpf;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = onlyDigits(value);
  return digits.length ? digits.slice(0, 20) : null;
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

export function toCustomerProfileView(customer: {
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
}) {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    cpfMasked: maskCpf(customer.cpf),
  };
}
