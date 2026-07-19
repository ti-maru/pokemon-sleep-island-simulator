import { describe, expect, it } from "vitest";

import {
  calculateCompletedStayMinutes,
  clampToAccumulationLimit,
  getMaximumAccumulationMinutes,
} from "../domain/napIsland/calculateStayMinutes";

describe("calculateCompletedStayMinutes", () => {
  it("counts only completed minutes", () => {
    expect(calculateCompletedStayMinutes(0, 119_999)).toBe(1);
  });

  it("returns zero when the end is before the start", () => {
    expect(calculateCompletedStayMinutes(120_000, 60_000)).toBe(0);
  });

  it("uses elapsed epoch time across a daylight-saving transition", () => {
    const start = Date.parse("2026-03-08T01:30:00-05:00");
    const end = Date.parse("2026-03-08T03:30:00-04:00");

    expect(calculateCompletedStayMinutes(start, end)).toBe(60);
  });
});

describe("maximum accumulation", () => {
  it("supports a fixed day count", () => {
    expect(
      getMaximumAccumulationMinutes({ kind: "fixed-days", days: 365 }),
    ).toBe(525_600);
    expect(
      clampToAccumulationLimit(600_000, { kind: "fixed-days", days: 365 }),
    ).toBe(525_600);
  });

  it("can represent a calendar year", () => {
    const leapDay = Date.parse("2024-02-29T00:00:00Z");

    expect(
      getMaximumAccumulationMinutes({ kind: "calendar-year" }, leapDay),
    ).toBe(366 * 24 * 60);
  });
});
