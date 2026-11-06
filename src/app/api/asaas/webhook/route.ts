import { after, NextResponse, type NextRequest } from "next/server";
import { getAsaasConfig, verifyAsaasWebhookToken, type AsaasConfig } from "@/lib/asaas";
import { parseAsaasWebhookBody, processAsaasWebhookEvents, storeAsaasWebhookEvent } from "@/lib/asaas-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBodyBytes = 64 * 1024;

// Asaas webhook: authenticate (asaas-access-token), persist the event with a unique id, answer 200,
// then process. Asaas retries anything that is not 2xx and pauses the queue after repeated
// failures, so the answer depends only on authentication and storage, never on processing.

export async function POST(request: NextRequest) {
  let config: AsaasConfig;
  try {
    config = getAsaasConfig();
  } catch {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!verifyAsaasWebhookToken(request.headers.get("asaas-access-token"), config.webhookToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (rawBody.length > maxBodyBytes) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  const event = parseAsaasWebhookBody(body);
  if (!event) {
    // Authenticated but not an event we understand: acknowledge so the queue is not penalised.
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    const stored = await storeAsaasWebhookEvent(event);
    if (stored === "stored" && event.paymentId) {
      after(async () => {
        try {
          await processAsaasWebhookEvents({ limit: 5 });
        } catch {
          // The worker drains the inbox anyway; nothing here may affect the 200 already sent.
        }
      });
    }
    return NextResponse.json({ received: true, duplicate: stored === "duplicate" });
  } catch {
    console.error("[asaas-webhook] could not store event", { event: event.event });
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }
}
