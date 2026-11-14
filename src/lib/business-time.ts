// Commercial calendar of the store: every campaign date is entered, shown and reasoned about in
// America/Sao_Paulo. Persistence stays UTC. The conversion uses the IANA rules shipped with the
// runtime (Intl), so historical daylight-saving periods are handled correctly.

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset of São Paulo from UTC at a given instant, in minutes (e.g. -180). */
export function businessOffsetMinutes(date: Date) {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * "YYYY-MM-DDTHH:mm" as typed in São Paulo (e.g. a datetime-local input) -> UTC instant.
 * A wall time skipped by a historical DST jump resolves to the first valid minute after it; a
 * repeated wall time resolves to its first occurrence. Returns null for malformed or impossible dates.
 */
export function parseBusinessDateTime(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = LOCAL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [y, mo, d, h, mi, s] = match.slice(1).map((part) => Number(part ?? "0"));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(wallAsUtc);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;

  // Try the offsets in force around that wall time; keep the earliest instant whose São Paulo
  // rendering is exactly the requested wall time.
  const candidates = [-180, -120, -240].map((offset) => new Date(wallAsUtc - offset * 60_000));
  const exact = candidates
    .filter((instant) => {
      const p = zonedParts(instant);
      return p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (exact.length) return exact[0];

  // Nonexistent local time (DST gap): the first instant whose São Paulo wall time is at or after
  // the requested one, found by bisection between "clearly before" and "clearly after".
  const wallKey = wallAsUtc;
  const localKey = (instant: number) => {
    const p = zonedParts(new Date(instant));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  };
  let lo = wallAsUtc + 60 * 60_000;
  let hi = wallAsUtc + 5 * 60 * 60_000;
  if (localKey(lo) >= wallKey || localKey(hi) < wallKey) return null;
  while (hi - lo > 1_000) {
    const mid = Math.floor((lo + hi) / 2 / 1_000) * 1_000;
    if (localKey(mid) >= wallKey) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}

/** UTC instant -> "YYYY-MM-DDTHH:mm" in São Paulo (value for a datetime-local input). */
export function toBusinessInputValue(date: Date | null | undefined) {
  if (!date) return "";
  const p = zonedParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Human display in São Paulo, e.g. "28/11/2026 00:00". */
export function formatBusinessDateTime(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("pt-BR", { timeZone: BUSINESS_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
