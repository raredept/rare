import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

type CheckoutSessionCreateParams = NonNullable<Parameters<Stripe["checkout"]["sessions"]["create"]>[0]>;

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;

  const secretKey = getStripeSecretKey();
  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });

  return stripeClient;
}

export function normalizePaymentMethodTypes(value = process.env.STRIPE_PAYMENT_METHOD_TYPES) {
  const methods = value
    ?.split(",")
    .map((method) => method.trim().toLowerCase())
    .filter(Boolean);

  if (!methods?.length) return undefined;

  const allowed = new Set(["card", "pix"]);
  const invalid = methods.filter((method) => !allowed.has(method));
  if (invalid.length) {
    throw new Error(`Unsupported STRIPE_PAYMENT_METHOD_TYPES: ${invalid.join(", ")}`);
  }

  return methods as NonNullable<CheckoutSessionCreateParams["payment_method_types"]>;
}
