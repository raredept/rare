import { formatDayLabel } from "@/lib/analytics-period";
import { formatMoney } from "@/lib/money";

/**
 * Charts are plain server-rendered SVG: no client bundle, no chart library, and
 * the numbers are already in the HTML for a screen reader and for "view source".
 * Every chart also ships the same figures as a table, so colour never carries
 * meaning on its own.
 *
 * Palette (validated against the Admin's #101010 card surface): one hue per
 * chart. Revenue and orders are two measures on different scales, so they are
 * two charts rather than one chart with two y-axes.
 */

const REVENUE_HUE = "#3987e5";
const ORDERS_HUE = "#d95926";
const GRID = "#2c2c2a";
const MUTED = "#898781";
const SURFACE = "#101010";

type SeriesPoint = {
  day: string;
  value: number;
};

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Axis labels only: the exact figures live in the KPI tiles and the table view. */
export function formatCompactCurrency(cents: number) {
  const reais = cents / 100;
  if (reais >= 1_000_000) return `R$${(reais / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (reais >= 1_000) return `R$${Math.round(reais / 1_000)}k`;
  return formatMoney(cents);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 px-4 py-8">
      <p className="max-w-sm text-center text-sm font-semibold text-neutral-500">{message}</p>
    </div>
  );
}

/**
 * Trend over time, single series: an area wash under a 2px line, an end marker
 * with a surface ring, and one direct label at the end rather than a number on
 * every point.
 */
export function TrendChart({
  points,
  hue,
  formatValue,
  ariaLabel,
}: {
  points: SeriesPoint[];
  hue: string;
  formatValue: (value: number) => string;
  ariaLabel: string;
}) {
  if (!points.length) return <ChartEmptyState message="Sem dados para este período." />;

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 64, bottom: 28, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const toX = (index: number) => padding.left + (points.length > 1 ? index * stepX : plotWidth / 2);
  const toY = (value: number) => padding.top + plotHeight - (maxValue ? (value / maxValue) * plotHeight : 0);

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)} ${toY(point.value)}`).join(" ");
  const areaPath = `${linePath} L${toX(points.length - 1)} ${padding.top + plotHeight} L${toX(0)} ${padding.top + plotHeight} Z`;
  const last = points[points.length - 1];
  const gridValues = [0, 0.5, 1].map((fraction) => maxValue * fraction);

  // Enough labels to orient the reader without them colliding. The final day is
  // always worth naming, but only when it is far enough from the one before it.
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const labelIndexes = new Set<number>();
  for (let index = 0; index < points.length; index += labelEvery) labelIndexes.add(index);
  const lastIndex = points.length - 1;
  const previousLabelled = Math.max(...labelIndexes);
  if (lastIndex - previousLabelled < labelEvery / 2) labelIndexes.delete(previousLabelled);
  labelIndexes.add(lastIndex);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-56 w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {gridValues.map((value) => (
        <g key={value}>
          <line x1={padding.left} x2={width - padding.right} y1={toY(value)} y2={toY(value)} stroke={GRID} strokeWidth={1} />
          <text x={padding.left - 8} y={toY(value) + 4} textAnchor="end" fontSize={11} fill={MUTED} fontWeight={600}>
            {formatValue(value)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={hue} fillOpacity={0.1} />
      <path d={linePath} fill="none" stroke={hue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      <circle cx={toX(points.length - 1)} cy={toY(last.value)} r={4} fill={hue} stroke={SURFACE} strokeWidth={2} />
      <text
        x={Math.min(toX(points.length - 1) + 10, width - 4)}
        y={toY(last.value) + 4}
        fontSize={11}
        fontWeight={700}
        fill="#ffffff"
      >
        {formatValue(last.value)}
      </text>

      {points.map((point, index) =>
        labelIndexes.has(index) ? (
          <text key={point.day} x={toX(index)} y={height - 8} textAnchor="middle" fontSize={11} fill={MUTED} fontWeight={600}>
            {formatDayLabel(point.day)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function RevenueTrendChart({ points }: { points: SeriesPoint[] }) {
  return (
    <TrendChart
      points={points}
      hue={REVENUE_HUE}
      formatValue={formatCompactCurrency}
      ariaLabel="Receita paga por dia no período selecionado"
    />
  );
}

export function OrdersTrendChart({ points }: { points: SeriesPoint[] }) {
  return (
    <TrendChart
      points={points}
      hue={ORDERS_HUE}
      formatValue={(value) => formatInteger(Math.round(value))}
      ariaLabel="Pedidos pagos por dia no período selecionado"
    />
  );
}

export type MagnitudeRow = {
  id: string;
  label: string;
  detail?: string | null;
  value: number;
  valueLabel: string;
  href?: string;
};

/**
 * Magnitude comparison across many named rows. One hue for every bar - length
 * carries the magnitude, so a second colour dimension would add ink without
 * adding information - and every row is named in text.
 */
export function MagnitudeBars({
  rows,
  emptyMessage,
  hue = REVENUE_HUE,
}: {
  rows: MagnitudeRow[];
  emptyMessage: string;
  hue?: string;
}) {
  if (!rows.length) return <ChartEmptyState message={emptyMessage} />;

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id}>
          {/* min-w-0: a flex item defaults to min-width:auto, so the truncating
              label would refuse to shrink and push the row past the viewport. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-black text-neutral-950">
              {row.label}
              {row.detail ? <span className="ml-2 font-semibold text-neutral-500">{row.detail}</span> : null}
            </span>
            <span className="whitespace-nowrap text-sm font-black text-neutral-950">{row.valueLabel}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                backgroundColor: hue,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black text-neutral-950">{title}</h2>
          {description ? <p className="mt-1 text-xs font-semibold text-neutral-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
