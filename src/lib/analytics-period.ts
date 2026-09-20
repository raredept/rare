/**
 * Commercial days for the Admin analytics.
 *
 * The store sells in Brazil, so "today" and "last 7 days" mean days in
 * America/Sao_Paulo. Grouping the same rows by UTC day would move every sale
 * made after 21:00 local time into the next day and make daily totals
 * disagree with what the operator saw happen.
 *
 * Boundaries travel as plain calendar dates (YYYY-MM-DD). Postgres turns them
 * into instants with `AT TIME ZONE`, so the offset is resolved by the database
 * from its own timezone table rather than being assumed here.
 */

export const ANALYTICS_TIME_ZONE = "America/Sao_Paulo";

export const ANALYTICS_PERIOD_PRESETS = ["today", "7d", "30d", "90d", "custom"] as const;

export type AnalyticsPeriodPreset = (typeof ANALYTICS_PERIOD_PRESETS)[number];

export type AnalyticsPeriod = {
  preset: AnalyticsPeriodPreset;
  /** Inclusive first commercial day, YYYY-MM-DD in ANALYTICS_TIME_ZONE. */
  fromDay: string;
  /** Inclusive last commercial day, YYYY-MM-DD in ANALYTICS_TIME_ZONE. */
  toDay: string;
  /** Number of commercial days covered, inclusive of both ends. */
  days: number;
  label: string;
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

const presetLabels: Record<Exclude<AnalyticsPeriodPreset, "custom">, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

export function isAnalyticsPeriodPreset(value: unknown): value is AnalyticsPeriodPreset {
  return typeof value === "string" && (ANALYTICS_PERIOD_PRESETS as readonly string[]).includes(value);
}

/** The calendar date in ANALYTICS_TIME_ZONE at a given instant, as YYYY-MM-DD. */
export function getCommercialDay(instant: Date = new Date(), timeZone = ANALYTICS_TIME_ZONE) {
  // en-CA renders ISO-ordered dates, so the parts need no reassembly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  // Rejects impossible dates such as 2026-02-31, which would silently roll over.
  return toDayIndex(value) !== null && indexToDay(toDayIndex(value)!) === value;
}

/** Days since the epoch for a calendar date, so date maths never touches a timezone. */
function toDayIndex(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, date);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / MS_PER_DAY) : null;
}

function indexToDay(index: number) {
  return new Date(index * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number) {
  const index = toDayIndex(day);
  if (index === null) throw new Error(`Invalid commercial day: ${day}`);
  return indexToDay(index + amount);
}

export function countDaysInclusive(fromDay: string, toDay: string) {
  const from = toDayIndex(fromDay);
  const to = toDayIndex(toDay);
  if (from === null || to === null) throw new Error("Invalid commercial day range.");
  return to - from + 1;
}

/** Every day in the range, so a chart shows days without sales as zero instead of skipping them. */
export function listDays(fromDay: string, toDay: string) {
  const total = countDaysInclusive(fromDay, toDay);
  if (total <= 0) return [];
  return Array.from({ length: total }, (_, offset) => addDays(fromDay, offset));
}

export function formatDayLabel(day: string, timeZone = ANALYTICS_TIME_ZONE) {
  // Noon UTC keeps the rendered day stable for any timezone offset in use.
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

export function formatDayRangeLabel(fromDay: string, toDay: string) {
  if (fromDay === toDay) return formatLongDay(fromDay);
  return `${formatLongDay(fromDay)} – ${formatLongDay(toDay)}`;
}

function formatLongDay(day: string, timeZone = ANALYTICS_TIME_ZONE) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/** Caps how far back a custom range may reach, so one request cannot scan the whole table. */
export const MAX_ANALYTICS_RANGE_DAYS = 400;

export function resolveAnalyticsPeriod(
  input: { preset?: unknown; from?: unknown; to?: unknown } = {},
  now: Date = new Date(),
): AnalyticsPeriod {
  const today = getCommercialDay(now);
  const preset = isAnalyticsPeriodPreset(input.preset) ? input.preset : "30d";

  if (preset === "custom") {
    const custom = resolveCustomRange(input.from, input.to, today);
    if (custom) return custom;
    // An unusable custom range falls back to the default window rather than
    // showing an error: the operator still sees numbers, with the label to match.
    return resolveAnalyticsPeriod({ preset: "30d" }, now);
  }

  const days = preset === "today" ? 1 : Number(preset.replace("d", ""));
  return {
    preset,
    fromDay: addDays(today, -(days - 1)),
    toDay: today,
    days,
    label: presetLabels[preset],
  };
}

function resolveCustomRange(from: unknown, to: unknown, today: string): AnalyticsPeriod | null {
  if (!isValidDay(from) || !isValidDay(to)) return null;

  // Tolerate a reversed range instead of returning nothing.
  const [fromDay, toDay] = countDaysInclusive(from, to) >= 1 ? [from, to] : [to, from];
  // A future end date would pad the chart with empty days.
  const boundedToDay = countDaysInclusive(toDay, today) >= 1 ? toDay : today;
  if (countDaysInclusive(fromDay, boundedToDay) < 1) return null;

  const days = countDaysInclusive(fromDay, boundedToDay);
  const boundedFromDay = days > MAX_ANALYTICS_RANGE_DAYS ? addDays(boundedToDay, -(MAX_ANALYTICS_RANGE_DAYS - 1)) : fromDay;

  return {
    preset: "custom",
    fromDay: boundedFromDay,
    toDay: boundedToDay,
    days: countDaysInclusive(boundedFromDay, boundedToDay),
    label: formatDayRangeLabel(boundedFromDay, boundedToDay),
  };
}
