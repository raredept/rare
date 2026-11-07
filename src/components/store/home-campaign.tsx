import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampaignCountdown } from "@/components/store/campaign-countdown";
import { ProductCard } from "@/components/store/product-card";
import { formatBusinessDateTime } from "@/lib/business-time";
import { formatMoney } from "@/lib/money";
import type { HomepageCampaign } from "@/lib/promotions/store";
import type { StorefrontProduct } from "@/lib/storefront";
import type { StorefrontCommerceState } from "@/lib/storefront-commerce";

// Homepage campaign (e.g. SALE BLACK FRIDAY). Everything shown comes from the promotion record
// and from server-side prices: no hardcoded copy, percentage or installment claim. Layout uses
// container queries so the Admin preview renders the real mobile layout inside a narrow frame.

function describeOffer(campaign: Pick<HomepageCampaign, "type" | "value">) {
  if (!campaign.value) return null;
  return campaign.type === "PERCENTAGE" ? `${campaign.value}% OFF nos produtos participantes` : `${formatMoney(campaign.value)} OFF nos produtos participantes`;
}

export function HomeCampaign({
  campaign,
  products,
  commerce,
  preview = false,
  headingId = "home-campaign-title",
}: {
  campaign: HomepageCampaign;
  products: StorefrontProduct[];
  commerce: StorefrontCommerceState;
  preview?: boolean;
  headingId?: string;
}) {
  const headline = campaign.headline ?? campaign.name;
  const offer = describeOffer(campaign);
  const href = campaign.ctaHref ?? "/categoria/tudo";
  const showCountdown = Boolean(campaign.endsAt) && !preview;

  return (
    <section aria-labelledby={headingId} className="store-home-section @container relative overflow-hidden bg-black text-white" data-campaign={campaign.slug}>
      {campaign.bannerImageUrl ? (
        <picture className="pointer-events-none absolute inset-0 opacity-40">
          {campaign.bannerMobileImageUrl ? <source media="(max-width: 767px)" srcSet={campaign.bannerMobileImageUrl} /> : null}
          {/* Decorative backdrop under the text; dimensions fixed by the section, so no layout shift. */}
          <img src={campaign.bannerImageUrl} alt={campaign.bannerAlt ?? ""} className="h-full w-full object-cover" loading="eager" decoding="async" fetchPriority="high" />
        </picture>
      ) : null}
      <div className="store-shell relative grid gap-8 py-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] @4xl:items-center @4xl:py-14">
        <div className="relative">
          {campaign.badgeText ? (
            <p className="inline-flex bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-black">{campaign.badgeText}</p>
          ) : null}
          <h2 id={headingId} className="mt-4 text-4xl font-black uppercase leading-[0.95] tracking-tight @xl:text-5xl @4xl:text-6xl">
            {headline}
          </h2>
          {campaign.subheadline ? <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/75 @xl:text-base">{campaign.subheadline}</p> : null}
          {offer ? <p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-white">{offer}</p> : null}
          {showCountdown && campaign.endsAt ? (
            <CampaignCountdown endsAt={campaign.endsAt.toISOString()} endsAtLabel={formatBusinessDateTime(campaign.endsAt)} />
          ) : campaign.endsAt ? (
            <p className="mt-6 text-xs font-semibold text-white/60">Até {formatBusinessDateTime(campaign.endsAt)} (horário de Brasília)</p>
          ) : null}
          <Link
            href={href}
            className="mt-8 inline-flex min-h-12 w-fit items-center justify-center gap-2 border border-white bg-white px-6 text-xs font-semibold uppercase tracking-[0.12em] text-black transition-colors duration-150 hover:bg-transparent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
          >
            {campaign.ctaLabel ?? "Ver ofertas"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        {products.length ? (
          <div className="relative bg-white p-4 text-neutral-950 @xl:p-5">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-600">Participantes</h3>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6">
              {products.slice(0, 4).map((product, index) => (
                <ProductCard key={product.id} product={product} commerce={commerce} priority={index === 0} headingLevel={3} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
