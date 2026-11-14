import { NextResponse, type NextRequest } from "next/server";
import { processMercadoPagoPayment } from "@/lib/checkout";
import { getMercadoPagoConfig, getMercadoPagoPayment, MercadoPagoError, verifyMercadoPagoSignature, type MercadoPagoConfig, type MercadoPagoPayment } from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBodyBytes = 16 * 1024;

function getSafeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook processing error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:APP_USR|TEST)-[A-Za-z0-9_-]{8,}/g, "mercadopago_[redacted]");
}

export async function POST(request: NextRequest) {
  let config: MercadoPagoConfig;
  try {
    config = getMercadoPagoConfig();
  } catch {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (rawBody.length > maxBodyBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: { type?: unknown; data?: { id?: unknown } } | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }

  const bodyId = body?.data?.id;
  const dataId = request.nextUrl.searchParams.get("data.id") ?? (typeof bodyId === "string" || typeof bodyId === "number" ? String(bodyId) : null);
  const signed = verifyMercadoPagoSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret: config.webhookSecret,
  });
  if (!signed) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? (typeof body?.type === "string" ? body.type : null);
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  // PIX_ENABLED only pauses new Pix orders. Notifications for existing orders stay processable.
  // The notification says only WHICH payment changed; its state always comes from the API.
  let payment: MercadoPagoPayment;
  try {
    payment = await getMercadoPagoPayment(config, dataId);
  } catch (error) {
    // Not a payment of this account (for example the dashboard's test notification).
    if (error instanceof MercadoPagoError && (error.code === "MercadoPagoNotFound" || error.code === "InvalidMercadoPagoPaymentId")) {
      return NextResponse.json({ received: true, ignored: true });
    }
    console.error("[mercadopago-webhook] payment lookup failed", { code: error instanceof MercadoPagoError ? error.code : "unknown" });
    return NextResponse.json({ error: "Payment lookup failed" }, { status: 500 });
  }

  try {
    const result = await processMercadoPagoPayment(payment);
    return NextResponse.json({ received: true, result: { status: result.status } });
  } catch (error) {
    console.error("[mercadopago-webhook] payment processing failed", {
      paymentId: payment.id,
      paymentStatus: payment.status,
      message: getSafeLogMessage(error),
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
