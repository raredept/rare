import Link from "next/link";
import { ANALYTICS_PERIOD_PRESETS, type AnalyticsPeriod, type AnalyticsPeriodPreset } from "@/lib/analytics-period";

const presetLabels: Record<AnalyticsPeriodPreset, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
};

/** Period presets and a custom range, as plain links and a GET form (works without JavaScript). */
export function AnalyticsPeriodFilter({ period, basePath }: { period: AnalyticsPeriod; basePath: string }) {
  return (
    <form action={basePath} className="mt-6 rounded-lg border border-neutral-200 bg-white p-4" role="search">
      <fieldset>
        <legend className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Período</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {ANALYTICS_PERIOD_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
            <Link
              key={preset}
              href={`${basePath}?period=${preset}`}
              aria-current={period.preset === preset ? "page" : undefined}
              className={`rounded-full border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                period.preset === preset
                  ? "border-neutral-950 bg-black text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
              }`}
            >
              {presetLabels[preset]}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="period" value="custom" />
          <label className="flex-1 text-xs font-black uppercase tracking-wide text-neutral-500">
            De
            <input type="date" name="from" defaultValue={period.fromDay} className="admin-input mt-1" max={period.toDay} />
          </label>
          <label className="flex-1 text-xs font-black uppercase tracking-wide text-neutral-500">
            Até
            <input type="date" name="to" defaultValue={period.toDay} className="admin-input mt-1" />
          </label>
          <button type="submit" className="h-[42px] rounded-lg bg-black px-4 text-sm font-black text-white">
            Aplicar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
