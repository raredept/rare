import { buildGoogleMerchantFeedItems, renderGoogleMerchantFeedXml } from "@/lib/google-merchant-feed";
import { buildProductOfferSnapshot } from "@/lib/product-offer";
import { isPublicIndexingEnabled, RARE_DEFAULT_SITE_URL } from "@/lib/seo";
import { getProducts } from "@/lib/storefront";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RARE-SEO-GOOGLE-01: Merchant Center scheduled-fetch feed (public catalog data only). Served only by
// the indexable production build, so staging/preview data can never reach Merchant Center. Kept out
// of the SEO sitemap and out of the index (X-Robots-Tag) — it is a data file, not a page.
const FEED_HEADERS = {
  "content-type": "application/xml; charset=utf-8",
  "x-robots-tag": "noindex",
  "cache-control": "public, max-age=0, s-maxage=900",
};

export async function GET() {
  if (!isPublicIndexingEnabled()) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }

  try {
    const { checkoutEnabled } = getStorefrontCommerceState();
    const products = await getProducts();
    const snapshots = products.map((product) => buildProductOfferSnapshot(product, { siteUrl: RARE_DEFAULT_SITE_URL, checkoutEnabled }));
    const feed = buildGoogleMerchantFeedItems(snapshots);
    return new Response(renderGoogleMerchantFeedXml(feed.items, { siteUrl: RARE_DEFAULT_SITE_URL }), { status: 200, headers: FEED_HEADERS });
  } catch (error) {
    // Never an empty 200: Merchant Center would read it as "every product removed".
    console.error("[merchant-feed] could not build the Google product feed", error instanceof Error ? error.name : "unknown");
    return new Response("Feed temporarily unavailable", { status: 503, headers: { "cache-control": "no-store", "retry-after": "600", "x-robots-tag": "noindex" } });
  }
}
