/** Commercial checkout window. Authentication sessions have their own policy. */
export const CHECKOUT_RESERVATION_MINUTES = 15;
export const CHECKOUT_RESERVATION_MS = CHECKOUT_RESERVATION_MINUTES * 60_000;
// Stripe accepts >= 30 minutes at creation. The durable worker closes open
// sessions at the commercial deadline; this is a provider-side fallback only.
export const STRIPE_SESSION_FALLBACK_SECONDS = 31 * 60;
export const CHECKOUT_WORKER_POLL_MS = 15_000;
// Mercado Pago refuses a Pix that expires in less than 30 minutes, so a Pix order holds its
// stock for that long. The provider-side expiry sits a little later: the durable worker closes
// the Pix at the commercial deadline, and the request must still clear the 30-minute floor
// when it reaches Mercado Pago.
export const PIX_RESERVATION_MINUTES = 30;
export const PIX_PROVIDER_EXPIRY_GRACE_SECONDS = 120;
// A just-created payment may take a moment to show up in Mercado Pago's search.
export const PIX_SEARCH_SETTLE_MS = 180_000;
