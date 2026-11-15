import { describe, expect, it } from "vitest";
import { formatBusinessDateTime, parseBusinessDateTime, toBusinessInputValue } from "@/lib/business-time";

describe("São Paulo commercial time", () => {
  it("converts wall time to UTC with the current fixed -03:00 offset", () => {
    expect(parseBusinessDateTime("2026-11-27T00:00")?.toISOString()).toBe("2026-11-27T03:00:00.000Z");
    expect(parseBusinessDateTime("2026-11-29T23:59")?.toISOString()).toBe("2026-11-30T02:59:00.000Z");
  });

  it("keeps the day boundary right: 23:59 is still the same commercial day, 00:00 is the next", () => {
    const lastMinute = parseBusinessDateTime("2026-11-30T23:59") as Date;
    const midnight = parseBusinessDateTime("2026-12-01T00:00") as Date;
    expect(midnight.getTime() - lastMinute.getTime()).toBe(60_000);
    expect(toBusinessInputValue(lastMinute)).toBe("2026-11-30T23:59");
    expect(toBusinessInputValue(midnight)).toBe("2026-12-01T00:00");
    // UTC already shows the next day at 23:59 São Paulo time.
    expect(lastMinute.toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("round-trips input values", () => {
    for (const value of ["2026-01-01T00:00", "2026-06-15T12:30", "2026-11-27T21:45"]) {
      expect(toBusinessInputValue(parseBusinessDateTime(value))).toBe(value);
    }
  });

  it("applies historical daylight saving (summer 2018/19 was -02:00)", () => {
    expect(parseBusinessDateTime("2019-01-15T12:00")?.toISOString()).toBe("2019-01-15T14:00:00.000Z");
  });

  it("moves a wall time skipped by the DST jump to the first valid minute", () => {
    // 2018-11-04: clocks jumped from 00:00 to 01:00 in São Paulo.
    expect(parseBusinessDateTime("2018-11-04T00:30")?.toISOString()).toBe("2018-11-04T03:00:00.000Z");
  });

  it("takes the first occurrence of a repeated wall time", () => {
    // 2019-02-17: clocks went back from 00:00 to 23:00 on the 16th.
    expect(parseBusinessDateTime("2019-02-16T23:30")?.toISOString()).toBe("2019-02-17T01:30:00.000Z");
  });

  it("rejects malformed or impossible dates", () => {
    for (const value of ["", "2026-02-30T10:00", "2026-13-01T00:00", "2026-11-27 10:00", "27/11/2026", null, 1]) {
      expect(parseBusinessDateTime(value)).toBeNull();
    }
  });

  it("formats for display in Brasília time", () => {
    expect(formatBusinessDateTime(new Date("2026-11-27T03:00:00Z"))).toContain("27/11/2026");
    expect(formatBusinessDateTime(null)).toBe("—");
  });
});
