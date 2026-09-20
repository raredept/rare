import { getTrendPercent } from "@/lib/admin-analytics";

/**
 * A headline number with its change against the previous window of the same
 * length. The arrow is paired with a sign and a number, so the direction never
 * depends on colour alone.
 */
export function KpiTile({
  label,
  value,
  current,
  previous,
  hint,
  higherIsBetter = true,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
  higherIsBetter?: boolean;
}) {
  const trend =
    typeof current === "number" && typeof previous === "number" ? getTrendPercent(current, previous) : null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 whitespace-nowrap text-2xl font-black text-neutral-950">{value}</p>
      {trend === null ? (
        <p className="mt-2 text-[11px] font-semibold text-neutral-500">{hint ?? "Sem base de comparação"}</p>
      ) : (
        <TrendBadge percent={trend} higherIsBetter={higherIsBetter} />
      )}
    </div>
  );
}

function TrendBadge({ percent, higherIsBetter }: { percent: number; higherIsBetter: boolean }) {
  const flat = Math.abs(percent) < 0.05;
  const good = flat ? null : percent > 0 === higherIsBetter;
  const arrow = flat ? "→" : percent > 0 ? "↑" : "↓";
  const tone = good === null ? "text-neutral-500" : good ? "text-emerald-700" : "text-red-700";
  const formatted = `${percent > 0 ? "+" : ""}${percent.toFixed(1).replace(".", ",")}%`;

  return (
    <p className={`mt-2 text-[11px] font-black ${tone}`}>
      <span aria-hidden="true">{arrow}</span> {flat ? "estável" : formatted}
      <span className="ml-1 font-semibold text-neutral-500">vs. período anterior</span>
    </p>
  );
}
