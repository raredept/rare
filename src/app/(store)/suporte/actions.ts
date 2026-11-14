"use server";

import { getCurrentCustomer } from "@/lib/customer-auth";
import { getActionClientIp } from "@/lib/login-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { parseSupportSubmission } from "@/lib/support-request-contract";
import { createSupportRequest, deliverSupportRequest } from "@/lib/support-requests";

export type SupportFormState = {
  protocol?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "category" | "message" | "form", string>>;
};

const GENERIC_ERROR = "Não foi possível enviar agora. Tente de novo em alguns minutos ou fale pelo WhatsApp.";

/**
 * Public support form. Order of operations is the contract: anti-spam -> validate -> persist ->
 * deliver. Delivery problems never reach the shopper as a failure: the request is stored with its
 * protocol and the worker retries the e-mail.
 */
export async function submitSupportRequestAction(_state: SupportFormState, formData: FormData): Promise<SupportFormState> {
  // Honeypot: a field people never see. Bots that fill it get a plausible answer and nothing is stored.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.trim()) return { protocol: "SUP-RECEBIDO" };

  const ip = await getActionClientIp();
  const [perAddress, burst] = await Promise.all([
    rateLimit(`support:ip:${ip}`, 5, 15 * 60_000),
    rateLimit(`support:burst:${ip}`, 2, 10_000),
  ]);
  if (!perAddress.ok || !burst.ok) return { fieldErrors: { form: "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo." } };

  const parsed = parseSupportSubmission(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const perEmail = await rateLimit(`support:email:${parsed.value.email}`, 5, 60 * 60_000);
  if (!perEmail.ok) return { fieldErrors: { form: "Muitas mensagens para este e-mail. Aguarde e tente de novo mais tarde." } };

  const customer = await getCurrentCustomer();
  let created;
  try {
    created = await createSupportRequest(prisma, parsed.value, customer ? { id: customer.id } : null);
  } catch (error) {
    console.error(JSON.stringify({ event: "support.persist_failed", code: error instanceof Error ? error.name : "unknown" }));
    return { fieldErrors: { form: GENERIC_ERROR } };
  }
  if ("error" in created) return { fieldErrors: { form: "Esse pedido não foi encontrado na sua conta." } };

  // One immediate attempt (the worker covers anything that fails or is still pending).
  if (created.created) {
    try {
      await deliverSupportRequest(prisma, created.id);
    } catch (error) {
      console.error(JSON.stringify({ event: "support.delivery_deferred", code: error instanceof Error ? error.name : "unknown" }));
    }
  }
  return { protocol: created.protocol };
}
