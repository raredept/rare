import { DISABLED_CARD_INSTALLMENT_RULES, resolveCardInstallmentRules, type CardInstallmentRules } from "@/lib/card-installments";
import { isCardInstallmentsEnabled, isCheckoutEnabled } from "@/lib/env";
import { getAvailableCheckoutMethods, getPaymentProvider } from "@/lib/payment-provider-config";

/**
 * Installment rules the storefront may ADVERTISE: only when the checkout is open, Asaas takes card,
 * and both the deploy flag and the Admin toggle are on. Otherwise the previous copy (no installments).
 */
export function getStorefrontCardInstallmentRules(
  settings: Parameters<typeof resolveCardInstallmentRules>[1],
  env: Record<string, string | undefined> = process.env,
): CardInstallmentRules {
  if (!isCheckoutEnabled(env) || getPaymentProvider(env) !== "asaas" || !getAvailableCheckoutMethods(env).includes("card")) {
    return DISABLED_CARD_INSTALLMENT_RULES;
  }
  return resolveCardInstallmentRules(isCardInstallmentsEnabled(env), settings);
}
