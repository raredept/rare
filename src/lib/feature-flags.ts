import type { EnvLike } from "@/lib/deployment-environment";

// Rollback switches. Each defaults to ON because the features have no visible effect until an
// administrator activates a promotion; setting the flag to "false" turns the behaviour off at once
// for storefront AND checkout (they read the same switch), without a deploy of new code.

/** PROMOTIONS_ENABLED=false: no automatic promotion prices anywhere (catalog, cart, checkout). */
export function isPromotionsEnabled(env: EnvLike = process.env) {
  return env.PROMOTIONS_ENABLED?.trim().toLowerCase() !== "false";
}

/** BLACK_FRIDAY_HOME_ENABLED=false: the homepage stops rendering featured campaigns (prices unaffected). */
export function isHomepageCampaignEnabled(env: EnvLike = process.env) {
  return isPromotionsEnabled(env) && env.BLACK_FRIDAY_HOME_ENABLED?.trim().toLowerCase() !== "false";
}
