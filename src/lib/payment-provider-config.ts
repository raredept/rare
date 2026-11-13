import type { EnvLike } from "@/lib/deployment-environment";
import { getAsaasConfigurationIssue, getAsaasPaymentMethods } from "@/lib/asaas-config";

// NEW payments require an explicit Asaas selection. Unset, unknown and retired providers fail
// closed, even if their credentials remain configured. Historical orders are reconciled by
// Order.paymentProvider, independently of this selector. Rollback closes checkout; never Stripe.

export type PaymentProviderName = "stripe" | "asaas" | "disabled";
export type CheckoutMethod = "card" | "pix";

export function getPaymentProvider(env: EnvLike = process.env): PaymentProviderName {
  const value = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  return value === "asaas" ? "asaas" : "disabled";
}

/** Methods the storefront may offer right now (configuration complete for each). */
export function getAvailableCheckoutMethods(env: EnvLike = process.env): CheckoutMethod[] {
  const provider = getPaymentProvider(env);
  if (provider !== "asaas") return [];
  return getAsaasConfigurationIssue(env) ? [] : getAsaasPaymentMethods(env);
}
