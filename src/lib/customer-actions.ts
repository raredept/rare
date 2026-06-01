"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearCustomerSessionCookie, requireCustomer, setCustomerSessionCookie, signCustomerSession } from "@/lib/customer-auth";
import { normalizePhone, onlyDigits } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { customerAddressSchema, customerProfileSchema, customerRegisterSchema, loginSchema } from "@/lib/validators";

export type CustomerActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getSafeCustomerNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/minha-conta";
  if (
    value.startsWith("/minha-conta") ||
    value === "/cart" ||
    value.startsWith("/cart?") ||
    value === "/finalizar-compra" ||
    value.startsWith("/finalizar-compra?")
  ) {
    return value;
  }
  return "/minha-conta";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function addressFormPath(message?: string) {
  return `/minha-conta/enderecos${message ? `?error=${encodeURIComponent(message)}` : ""}`;
}

function parseAddressForm(formData: FormData) {
  return customerAddressSchema.safeParse({
    label: getString(formData, "label"),
    recipientName: getString(formData, "recipientName"),
    phone: getString(formData, "phone"),
    cep: onlyDigits(getString(formData, "cep")),
    street: getString(formData, "street"),
    number: getString(formData, "number"),
    complement: getString(formData, "complement"),
    neighborhood: getString(formData, "neighborhood"),
    city: getString(formData, "city"),
    state: getString(formData, "state"),
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function registerCustomerAction(_state: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const parsed = customerRegisterSchema.safeParse({
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    cpf: getString(formData, "cpf"),
    password: getString(formData, "password"),
    passwordConfirmation: getString(formData, "passwordConfirmation"),
  });

  if (!parsed.success) {
    return {
      error: "Revise os campos do cadastro.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const limit = rateLimit(`customer-register:${parsed.data.email}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let customer;

  try {
    customer = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: normalizePhone(parsed.data.phone),
        cpf: parsed.data.cpf ?? null,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Ja existe um cadastro com este e-mail." };
    }
    return { error: "Nao foi possivel criar o cadastro agora." };
  }

  const token = await signCustomerSession(customer);
  await setCustomerSessionCookie(token);
  redirect(getSafeCustomerNext(formData.get("next")));
}

export async function loginCustomerAction(_state: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  const parsed = loginSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: "Informe e-mail e senha validos." };
  }

  const email = parsed.data.email.toLowerCase();
  const limit = rateLimit(`customer-login:${email}`, 8, 5 * 60_000);
  if (!limit.ok) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      email,
      active: true,
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!customer) {
    return { error: "Credenciais invalidas." };
  }

  const validPassword = await bcrypt.compare(parsed.data.password, customer.passwordHash);
  if (!validPassword) {
    return { error: "Credenciais invalidas." };
  }

  const token = await signCustomerSession(customer);
  await setCustomerSessionCookie(token);
  redirect(getSafeCustomerNext(formData.get("next")));
}

export async function logoutCustomerAction() {
  await clearCustomerSessionCookie();
  redirect("/");
}

export async function updateCustomerProfileAction(
  _state: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const customer = await requireCustomer("/minha-conta/dados");
  const rawCpf = getString(formData, "cpf");

  if (!customer.cpf && !rawCpf.trim()) {
    return {
      error: "Informe seu CPF.",
      fieldErrors: { cpf: ["Informe seu CPF."] },
    };
  }

  const parsed = customerProfileSchema.safeParse({
    name: getString(formData, "name"),
    phone: getString(formData, "phone"),
    cpf: rawCpf,
  });

  if (!parsed.success) {
    return {
      error: "Revise os dados informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name: parsed.data.name,
      phone: normalizePhone(parsed.data.phone),
      cpf: rawCpf.trim() ? parsed.data.cpf ?? null : customer.cpf,
    },
  });

  revalidatePath("/minha-conta");
  revalidatePath("/minha-conta/dados");
  return { success: "Dados atualizados com sucesso." };
}

export async function createCustomerAddressAction(
  _state: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const customer = await requireCustomer("/minha-conta/enderecos");
  const parsed = parseAddressForm(formData);

  if (!parsed.success) {
    return {
      error: "Revise o endereco informado.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.$transaction(async (tx) => {
    const existingCount = await tx.customerAddress.count({ where: { customerId: customer.id } });
    const shouldBeDefault = parsed.data.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }

    await tx.customerAddress.create({
      data: {
        customerId: customer.id,
        ...parsed.data,
        phone: normalizePhone(parsed.data.phone),
        isDefault: shouldBeDefault,
      },
    });
  });

  revalidatePath("/minha-conta/enderecos");
  return { success: "Endereco cadastrado com sucesso." };
}

export async function updateCustomerAddressAction(addressId: string, formData: FormData) {
  const customer = await requireCustomer("/minha-conta/enderecos");
  const parsed = parseAddressForm(formData);

  if (!parsed.success) {
    redirect(addressFormPath("Revise os campos do endereco."));
  }

  const address = await prisma.customerAddress.findFirst({
    where: {
      id: addressId,
      customerId: customer.id,
    },
    select: { id: true },
  });

  if (!address) {
    redirect(addressFormPath("Endereco nao encontrado."));
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    }

    await tx.customerAddress.update({
      where: { id: addressId },
      data: {
        ...parsed.data,
        phone: normalizePhone(parsed.data.phone),
      },
    });
  });

  revalidatePath("/minha-conta/enderecos");
  redirect("/minha-conta/enderecos");
}

export async function deleteCustomerAddressAction(formData: FormData) {
  const customer = await requireCustomer("/minha-conta/enderecos");
  const id = getString(formData, "id");
  if (!id) redirect(addressFormPath("Endereco nao encontrado."));

  await prisma.$transaction(async (tx) => {
    const address = await tx.customerAddress.findFirst({
      where: { id, customerId: customer.id },
      select: { id: true, isDefault: true },
    });

    if (!address) return;

    await tx.customerAddress.delete({ where: { id } });

    if (address.isDefault) {
      const nextDefault = await tx.customerAddress.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (nextDefault) {
        await tx.customerAddress.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
      }
    }
  });

  revalidatePath("/minha-conta/enderecos");
  redirect("/minha-conta/enderecos");
}

export async function setDefaultCustomerAddressAction(formData: FormData) {
  const customer = await requireCustomer("/minha-conta/enderecos");
  const id = getString(formData, "id");
  if (!id) redirect(addressFormPath("Endereco nao encontrado."));

  const address = await prisma.customerAddress.findFirst({
    where: { id, customerId: customer.id },
    select: { id: true },
  });

  if (!address) {
    redirect(addressFormPath("Endereco nao encontrado."));
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    await tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
  });

  revalidatePath("/minha-conta/enderecos");
  redirect("/minha-conta/enderecos");
}
