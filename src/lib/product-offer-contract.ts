// Validator of the product Offer, kept apart from the JSON-LD producer (structured-data.tsx): the
// release guard checks that the producer only claims InStock behind the checkout flag, and this file
// is what the unit tests and the release smoke use to fail any page that claims it anyway.
const IN_STOCK = /(^|\/)InStock$/i;
const KNOWN_AVAILABILITY = ["https://schema.org/InStock", "https://schema.org/OutOfStock"];

/**
 * Release contract for a product's Offer, shared by the unit tests and the release smoke. An Offer
 * with its price may always be published; what must never happen is an InStock claim while online
 * checkout cannot take the order. Returns the violation, or null.
 */
export function productOfferContractIssue(offers: unknown, checkoutEnabled: boolean): string | null {
  if (offers === undefined) return null;
  if (!offers || typeof offers !== "object" || Array.isArray(offers)) return "offers must be a single Offer object";
  const offer = offers as Record<string, unknown>;
  if (offer["@type"] !== "Offer") return "offers must be an Offer";
  const availability = offer.availability;
  if (availability === undefined) return null;
  if (typeof availability === "string" && IN_STOCK.test(availability) && !checkoutEnabled) return "InStock declared while checkout is paused";
  if (typeof availability !== "string" || !KNOWN_AVAILABILITY.includes(availability)) return `unexpected availability ${String(availability)}`;
  return null;
}
