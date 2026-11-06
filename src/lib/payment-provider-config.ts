import type { EnvLike } from "@/lib/deployment-environment";
import { getAsaasConfigurationIssue, getAsaasPaymentMethods } from "@/lib/asaas-config";
import { isPixCheckoutAvailable } from "@/lib/mercadopago-config";

// Which gateway takes NEW payments. Existing orders keep being reconciled with the provider that
// created them (Order.paymentProvider), whatever this says, so switching is a safe rollback:
//   PAYMENT_PROVIDER=asaas    card (hosted invoice) and Pix through Asaas
//   PAYMENT_PROVIDER=stripe   previous behaviour: card via Stripe Checkout, Pix via Mercado Pago (PIX_ENABLED)
//   PAYMENT_PROVIDER=disabled no new payment is started
// Unset keeps "stripe" so deploying this code changes nothing until the variable is set.

export type PaymentProviderName = "stripe" | "asaas" | "disabled";
export type CheckoutMethod = "card" | "pix";

export function getPaymentProvider(env: EnvLike = process.env): PaymentProviderName {
  const value = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (value === "asaas" || value === "disabled") return value;
  if (!value || value === "stripe") return "stripe";
  // Unknown value: fail closed instead of guessing a gateway.
  return "disabled";
}

/** Methods the storefront may offer right now (configuration complete for each). */
export function getAvailableCheckoutMethods(env: EnvLike = process.env): CheckoutMethod[] {
  const provider = getPaymentProvider(env);
  if (provider === "disabled") return [];
  if (provider === "asaas") return getAsaasConfigurationIssue(env) ? [] : getAsaasPaymentMethods(env);
  return isPixCheckoutAvailable(env) ? ["card", "pix"] : ["card"];
}
