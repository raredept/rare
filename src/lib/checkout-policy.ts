/** Commercial checkout window. Authentication sessions have their own policy. */
export const CHECKOUT_RESERVATION_MINUTES = 15;
export const CHECKOUT_RESERVATION_MS = CHECKOUT_RESERVATION_MINUTES * 60_000;
// Stripe accepts >= 30 minutes at creation. The durable worker closes open
// sessions at the commercial deadline; this is a provider-side fallback only.
export const STRIPE_SESSION_FALLBACK_SECONDS = 31 * 60;
export const CHECKOUT_WORKER_POLL_MS = 15_000;
