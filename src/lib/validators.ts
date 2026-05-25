import { z } from "zod";
import { isValidCep, parseCep } from "@/lib/cep";
import { isValidCpf, normalizeCpf } from "@/lib/privacy";
import { shippingModes } from "@/lib/shipping";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const optionalCpf = z
  .string()
  .trim()
  .max(18)
  .optional()
  .refine((value) => {
    const cpf = normalizeCpf(value);
    return !cpf || isValidCpf(cpf);
  }, "CPF inválido.")
  .transform((value) => normalizeCpf(value) ?? undefined);

const cepSchema = z
  .string()
  .trim()
  .refine((value) => isValidCep(value), "CEP inválido.")
  .transform((value) => parseCep(value) ?? value);

const stateSchema = z
  .string()
  .trim()
  .length(2, "Use a sigla do estado com 2 letras.")
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{2}$/.test(value), "Estado inválido.");

const optionalPositiveInt = (max: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .optional();

export const checkoutAddressSchema = z.object({
  label: optionalTrimmed(40),
  recipientName: optionalTrimmed(120),
  phone: optionalTrimmed(32),
  cep: cepSchema,
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: optionalTrimmed(120),
  neighborhood: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  state: stateSchema,
});

export const guestCustomerDataSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(8).max(32),
  cpf: optionalCpf,
});

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  customerAddressId: z.string().trim().min(1).max(120).optional(),
  guestCustomerData: guestCustomerDataSchema.optional(),
  guestAddress: checkoutAddressSchema.optional(),
  shippingOptionId: z.string().trim().max(120).optional(),
  shippingDestinationCep: cepSchema.optional(),
  selectedShippingMethod: z.string().trim().max(80).optional(),
});

export const customerRegisterSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: optionalTrimmed(32),
    cpf: optionalCpf,
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "As senhas não conferem.",
    path: ["passwordConfirmation"],
  });

export const customerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalTrimmed(32),
  cpf: optionalCpf,
});

export const customerAddressSchema = checkoutAddressSchema.extend({
  isDefault: z.boolean(),
});

export const productFormSchema = z.object({
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(120).optional(),
  shortDescription: z.string().trim().min(5).max(220),
  description: z.string().trim().min(5).max(3000),
  brand: z.string().trim().max(80).optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  priceInCents: z.number().int().min(50),
  compareAtPriceInCents: z.number().int().min(0).optional(),
  weightGrams: optionalPositiveInt(100000),
  lengthCm: optionalPositiveInt(1000),
  widthCm: optionalPositiveInt(1000),
  heightCm: optionalPositiveInt(1000),
  active: z.boolean(),
  featured: z.boolean(),
  featuredSortOrder: z.number().int().min(1).max(999999).nullable(),
  sortOrder: z.number().int().min(0).max(999999),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(100).optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).max(999999),
  active: z.boolean(),
});

export const settingsFormSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  whatsappNumber: z.string().trim().max(32).optional(),
  whatsappDefaultMessage: z.string().trim().min(5).max(240),
  manualShippingInCents: z.number().int().min(0),
  freeShippingMinInCents: z.number().int().min(0).optional(),
  originCep: cepSchema.optional(),
  shippingMode: z.enum(shippingModes),
  fixedShippingInCents: z.number().int().min(0),
  freeShippingThresholdInCents: z.number().int().min(0).optional(),
  shippingInstructions: z.string().trim().max(500).optional(),
  checkoutRequiresAddress: z.boolean(),
  checkoutReservationMinutes: z.number().int().min(30).max(1440),
});
