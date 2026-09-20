import { describe, expect, it } from "vitest";
import {
  addDays,
  countDaysInclusive,
  formatDayLabel,
  getCommercialDay,
  isValidDay,
  listDays,
  MAX_ANALYTICS_RANGE_DAYS,
  resolveAnalyticsPeriod,
} from "@/lib/analytics-period";

describe("getCommercialDay", () => {
  it("uses the São Paulo day, not the UTC day", () => {
    // 2026-03-10T02:00Z is still 2026-03-09 at 23:00 in São Paulo (UTC-3).
    expect(getCommercialDay(new Date("2026-03-10T02:00:00.000Z"))).toBe("2026-03-09");
    // A sale at 21:00 local is 2026-03-11T00:00Z: the same commercial day.
    expect(getCommercialDay(new Date("2026-03-11T00:00:00.000Z"))).toBe("2026-03-10");
  });

  it("agrees with UTC during local business hours", () => {
    expect(getCommercialDay(new Date("2026-03-10T15:00:00.000Z"))).toBe("2026-03-10");
  });
});

describe("calendar arithmetic", () => {
  it("adds and subtracts days across month and year ends", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts an inclusive range", () => {
    expect(countDaysInclusive("2026-03-10", "2026-03-10")).toBe(1);
    expect(countDaysInclusive("2026-03-04", "2026-03-10")).toBe(7);
  });

  it("lists every day so gaps render as zero", () => {
    expect(listDays("2026-03-08", "2026-03-11")).toEqual(["2026-03-08", "2026-03-09", "2026-03-10", "2026-03-11"]);
    expect(listDays("2026-03-10", "2026-03-10")).toEqual(["2026-03-10"]);
  });
});

describe("isValidDay", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDay("2026-03-10")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
  });

  it("rejects malformed and impossible dates instead of rolling them over", () => {
    for (const value of ["2026-02-31", "2026-13-01", "2026-3-1", "10/03/2026", "", "   ", null, undefined, 20260310]) {
      expect(isValidDay(value)).toBe(false);
    }
  });
});

describe("resolveAnalyticsPeriod presets", () => {
  const now = new Date("2026-03-10T15:00:00.000Z");

  it("treats today as a single commercial day", () => {
    expect(resolveAnalyticsPeriod({ preset: "today" }, now)).toMatchObject({
      fromDay: "2026-03-10",
      toDay: "2026-03-10",
      days: 1,
      label: "Hoje",
    });
  });

  it("includes today in the rolling windows", () => {
    expect(resolveAnalyticsPeriod({ preset: "7d" }, now)).toMatchObject({ fromDay: "2026-03-04", toDay: "2026-03-10", days: 7 });
    expect(resolveAnalyticsPeriod({ preset: "30d" }, now)).toMatchObject({ fromDay: "2026-02-09", toDay: "2026-03-10", days: 30 });
    expect(resolveAnalyticsPeriod({ preset: "90d" }, now)).toMatchObject({ fromDay: "2025-12-11", toDay: "2026-03-10", days: 90 });
  });

  it("defaults to 30 days for missing or unknown presets", () => {
    expect(resolveAnalyticsPeriod({}, now).preset).toBe("30d");
    expect(resolveAnalyticsPeriod({ preset: "all-time" }, now).preset).toBe("30d");
    expect(resolveAnalyticsPeriod({ preset: 7 }, now).preset).toBe("30d");
  });

  it("uses the São Paulo day when UTC has already rolled over", () => {
    expect(resolveAnalyticsPeriod({ preset: "today" }, new Date("2026-03-11T02:00:00.000Z"))).toMatchObject({
      fromDay: "2026-03-10",
      toDay: "2026-03-10",
    });
  });
});

describe("resolveAnalyticsPeriod custom ranges", () => {
  const now = new Date("2026-03-10T15:00:00.000Z");

  it("accepts a valid explicit range", () => {
    expect(resolveAnalyticsPeriod({ preset: "custom", from: "2026-03-01", to: "2026-03-05" }, now)).toMatchObject({
      preset: "custom",
      fromDay: "2026-03-01",
      toDay: "2026-03-05",
      days: 5,
    });
  });

  it("labels the custom range in Brazilian date order", () => {
    expect(resolveAnalyticsPeriod({ preset: "custom", from: "2026-03-01", to: "2026-03-05" }, now).label).toBe(
      "01/03/2026 – 05/03/2026",
    );
  });

  it("swaps a reversed range rather than returning nothing", () => {
    expect(resolveAnalyticsPeriod({ preset: "custom", from: "2026-03-05", to: "2026-03-01" }, now)).toMatchObject({
      fromDay: "2026-03-01",
      toDay: "2026-03-05",
    });
  });

  it("clamps an end date in the future to today", () => {
    expect(resolveAnalyticsPeriod({ preset: "custom", from: "2026-03-01", to: "2026-12-31" }, now)).toMatchObject({
      fromDay: "2026-03-01",
      toDay: "2026-03-10",
    });
  });

  it("caps a very wide range so one request cannot scan everything", () => {
    const period = resolveAnalyticsPeriod({ preset: "custom", from: "2015-01-01", to: "2026-03-10" }, now);
    expect(period.days).toBe(MAX_ANALYTICS_RANGE_DAYS);
    expect(period.toDay).toBe("2026-03-10");
  });

  it("falls back to the default window for unusable input", () => {
    for (const input of [
      { preset: "custom" },
      { preset: "custom", from: "2026-03-01" },
      { preset: "custom", from: "nope", to: "2026-03-05" },
      { preset: "custom", from: "2026-02-31", to: "2026-03-05" },
    ]) {
      expect(resolveAnalyticsPeriod(input, now)).toMatchObject({ preset: "30d", days: 30 });
    }
  });

  it("rejects a range entirely in the future", () => {
    expect(resolveAnalyticsPeriod({ preset: "custom", from: "2026-04-01", to: "2026-04-10" }, now).preset).toBe("30d");
  });
});

describe("formatDayLabel", () => {
  it("renders the same day it was given, regardless of offset", () => {
    expect(formatDayLabel("2026-03-10")).toBe("10/03");
    expect(formatDayLabel("2026-01-01")).toBe("01/01");
    expect(formatDayLabel("2026-12-31")).toBe("31/12");
  });
});
