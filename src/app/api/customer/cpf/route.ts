import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { isValidCpf, maskCpf, normalizeCpf } from "@/lib/cpf";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = await rateLimit(`customer-cpf:${ip}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Para finalizar sua compra, entre ou crie sua conta." }, { status: 401 });
  }

  if (isValidCpf(customer.cpf)) {
    return NextResponse.json({ cpfMasked: maskCpf(customer.cpf), hasCpf: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Informe seu CPF." }, { status: 400 });
  }

  const rawCpf = body && typeof body === "object" && "cpf" in body ? (body as { cpf?: unknown }).cpf : null;
  const cpf = typeof rawCpf === "string" ? normalizeCpf(rawCpf) : null;

  if (!cpf) {
    return NextResponse.json({ error: "Informe seu CPF." }, { status: 400 });
  }

  if (!isValidCpf(cpf)) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { cpf },
    select: { cpf: true },
  });

  return NextResponse.json({
    cpfMasked: maskCpf(updated.cpf),
    hasCpf: true,
  });
}
