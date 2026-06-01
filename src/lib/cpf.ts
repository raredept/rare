const cpfInvalidRepeatedDigits = /^(\d)\1{10}$/;

function onlyCpfDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeCpf(value: string | null | undefined) {
  const digits = onlyCpfDigits(value);
  return digits.length ? digits : null;
}

export function formatCpf(value: string | null | undefined) {
  const cpf = onlyCpfDigits(value).slice(0, 11);
  if (cpf.length <= 3) return cpf;
  if (cpf.length <= 6) return `${cpf.slice(0, 3)}.${cpf.slice(3)}`;
  if (cpf.length <= 9) return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6)}`;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
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
