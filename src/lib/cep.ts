import { onlyDigits } from "@/lib/privacy";

export function normalizeCep(value: string | null | undefined) {
  const digits = onlyDigits(value);
  return digits.length ? digits : null;
}

export function isValidCep(value: string | null | undefined) {
  const cep = normalizeCep(value);
  return Boolean(cep && cep.length === 8);
}

export function parseCep(value: string | null | undefined) {
  const cep = normalizeCep(value);
  return cep && cep.length === 8 ? cep : null;
}

export function formatCep(value: string | null | undefined) {
  const cep = parseCep(value);
  if (!cep) return "";
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}
