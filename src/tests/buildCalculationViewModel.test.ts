import { describe, expect, it } from "vitest";

import { buildCalculationViewModel } from "../application/calculate/buildCalculationViewModel";
import type { CalculatorFormValues } from "../features/calculator/calculatorTypes";

const baseValues: CalculatorFormValues = {
  inputMode: "duration",
  durationDays: 6,
  durationHours: 0,
  durationMinutes: 0,
  startAt: "2026-07-13T00:00",
  endMode: "specified",
  endAt: "2026-07-19T00:00",
  timezone: "Asia/Tokyo",
  relaxMode: "none",
  ticketCount: 1,
  relaxDays: 7,
  relaxHours: 0,
  relaxMinutes: 0,
  natureInputMode: "nature",
  natureId: "serious",
  expEffect: "neutral",
  pokemonId: "",
  expTypeOverride: false,
  expType: "600",
  levelEnabled: false,
  currentLevel: 1,
  remainingExpToNextLevel: 54,
  levelCap: 70,
  targetLevelEnabled: false,
  targetLevel: 10,
  targetDateEnabled: false,
  targetDate: "2026-08-01T00:00",
};

describe("buildCalculationViewModel", () => {
  it("builds the current result and automatic seven-day comparison", () => {
    const model = buildCalculationViewModel(baseValues, []);

    expect(model.expResult.finalExp).toBe(450);
    expect(model.scenarios.find(({ id }) => id === "seven-day")?.exp).toBe(
      1_050,
    );
    expect(model.sevenDayWaitMinutes).toBe(24 * 60);
  });

  it("extends the result with level and target calculations", () => {
    const model = buildCalculationViewModel(
      {
        ...baseValues,
        durationDays: 7,
        levelEnabled: true,
        targetLevelEnabled: true,
        targetLevel: 10,
      },
      [],
    );

    expect(model.levelResult?.afterLevel).toBe(8);
    expect(model.nextLevelStayMinutes).not.toBeNull();
    expect(model.targetLevelStayMinutes).not.toBeNull();
    expect(model.scenarios.some(({ id }) => id === "target-level")).toBe(true);
  });

  it("normalizes custom scenario settings and compares them", () => {
    const model = buildCalculationViewModel(baseValues, [
      {
        id: "custom-1",
        name: "比較用",
        days: 7,
        hours: 0,
        minutes: 0,
        relaxMode: "tickets",
        ticketCount: 1,
        relaxDurationMinutes: 0,
      },
    ]);
    const custom = model.scenarios.find(({ id }) => id === "custom-1");

    expect(custom?.exp).toBe(4_200);
    expect(custom?.expDifference).toBe(3_750);
  });

  it("calculates an actual elapsed datetime in its IANA timezone", () => {
    const model = buildCalculationViewModel(
      {
        ...baseValues,
        inputMode: "datetime",
        startAt: "2026-07-13T02:00",
        endAt: "2026-07-20T02:00",
      },
      [],
      Date.parse("2026-07-20T00:00:00Z"),
    );

    expect(model.stayMinutes).toBe(7 * 24 * 60);
    expect(model.expResult.finalExp).toBe(1_050);
  });

  it("adds a target-date scenario when a start datetime is available", () => {
    const model = buildCalculationViewModel(
      {
        ...baseValues,
        inputMode: "datetime",
        startAt: "2026-07-13T02:00",
        endAt: "2026-07-20T02:00",
        levelEnabled: true,
        targetDateEnabled: true,
        targetDate: "2026-07-27T02:00",
      },
      [],
    );

    expect(model.targetDateStayMinutes).toBe(14 * 24 * 60);
    expect(model.scenarios.some(({ id }) => id === "target-date")).toBe(true);
  });
});
