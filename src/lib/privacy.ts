const cpfInvalidRepeatedDigits = /^(\d)\1{10}$/;

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeCpf(value: string | null | undefined) {
  const digits = onlyDigits(value);
  return digits.length ? digits : null;
}

export function isValidCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value);
  if (!cpf || cpf.length !== 11 || cpfInvalidRepeatedDigits.test(cpf)) {
    return false;
  }

  const calculateDigit = (factor: number) => {
    let total = 0;
    for (let index = 0; index < factor - 1; index += 1) {
      total += Number(cpf[index]) * (factor - index);
    }
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calculateDigit(10) === Number(cpf[9]) && calculateDigit(11) === Number(cpf[10]);
}

export function maskCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value);
  if (!cpf || cpf.length !== 11) return "";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
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
