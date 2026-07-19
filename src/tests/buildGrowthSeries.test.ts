import { describe, expect, it } from "vitest";

import { buildCalculationViewModel } from "../application/calculate/buildCalculationViewModel";
import { buildGrowthSeries } from "../application/graph/buildGrowthSeries";
import type { CalculatorFormValues } from "../features/calculator/calculatorTypes";

const values: CalculatorFormValues = {
  inputMode: "duration",
  durationDays: 14,
  durationHours: 0,
  durationMinutes: 0,
  startAt: "2026-07-20T00:00",
  endMode: "specified",
  endAt: "2026-08-03T00:00",
  timezone: "Asia/Tokyo",
  relaxMode: "tickets",
  ticketCount: 1,
  relaxDays: 7,
  relaxHours: 0,
  relaxMinutes: 0,
  natureInputMode: "effect",
  natureId: "serious",
  expEffect: "neutral",
  pokemonId: "",
  expTypeOverride: true,
  expType: "600",
  levelEnabled: true,
  currentLevel: 1,
  remainingExpToNextLevel: 54,
  levelCap: 70,
  targetLevelEnabled: false,
  targetLevel: 20,
  targetDateEnabled: false,
  targetDate: "2026-12-01T00:00",
};

describe("buildGrowthSeries", () => {
  it("adaptively samples the range and keeps exact important boundaries", () => {
    const model = buildCalculationViewModel(values, []);
    const points = buildGrowthSeries(model, 30 * 24 * 60, 24);

    expect(points.length).toBeLessThan(40);
    expect(
      points.find(({ minute }) => minute === 7 * 24 * 60)?.label,
    ).toContain("セット終了");
    expect(
      points.find(({ minute }) => minute === 14 * 24 * 60)?.important,
    ).toBe(true);
    expect(points.at(-1)?.minute).toBe(30 * 24 * 60);
    expect(points.at(-1)?.exp).toBeGreaterThan(points[0]?.exp ?? 0);
  });
});
