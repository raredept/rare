import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { processStripeCheckoutEvent, processStripePaymentIntentEvent } from "@/lib/checkout";
import { getStripeSecretKey, getStripeWebhookSecret } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);

const checkoutSessionEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

function getSafeLogMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook processing error.";
  return message
    .replace(/[a-z]+:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(?:sk|rk)_(live|test)_[A-Za-z0-9_]+/g, "stripe_$1_[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9_]+/g, "whsec_[redacted]");
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let webhookSecret: string;
  let expectedLivemode: boolean;
  try {
    webhookSecret = getStripeWebhookSecret();
    const keyMode = getStripeSecretKey().match(/^(?:sk|rk)_(test|live)_/);
    if (!keyMode) throw new Error("Invalid Stripe key mode");
    expectedLivemode = keyMode[1] === "live";
  } catch {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // CHECKOUT_ENABLED only pauses new sales. Valid events for existing orders
  // remain processable, while a misconfigured test/live endpoint cannot write.
  if (event.livemode !== expectedLivemode) {
    return NextResponse.json({ error: "Stripe event mode mismatch" }, { status: 400 });
  }

  if (!handledEvents.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  let result;
  try {
    if (checkoutSessionEvents.has(event.type)) {
      result = await processStripeCheckoutEvent(event.id, event.type, event.data.object as Stripe.Checkout.Session);
    } else {
      result = await processStripePaymentIntentEvent(event.id, event.type, event.data.object as Stripe.PaymentIntent);
    }
  } catch (error) {
    console.error("[stripe-webhook] event processing failed", {
      eventId: event.id,
      type: event.type,
      message: getSafeLogMessage(error),
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true, result });
}
