import { PROMOTION_STATUS_LABELS } from "@/lib/promotions/admin";
import type { PromotionStatusValue } from "@/lib/promotions/engine";

const tones: Record<PromotionStatusValue, string> = {
  DRAFT: "border-neutral-600 text-neutral-300",
  SCHEDULED: "border-sky-400/60 text-sky-200",
  ACTIVE: "border-emerald-400/60 text-emerald-200",
  PAUSED: "border-amber-400/60 text-amber-200",
  ENDED: "border-neutral-700 text-neutral-500",
};

export function PromotionStatusBadge({ status }: { status: PromotionStatusValue }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-black ${tones[status]}`}>{PROMOTION_STATUS_LABELS[status]}</span>;
}
