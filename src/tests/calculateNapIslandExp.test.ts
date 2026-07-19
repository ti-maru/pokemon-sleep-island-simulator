import { describe, expect, it } from "vitest";

import { napIslandRuleSet } from "../data/masterData";
import { calculateNapIslandExp } from "../domain/napIsland/calculateNapIslandExp";
import { roundExp } from "../domain/napIsland/rounding";

const DAY = 24 * 60;

describe("calculateNapIslandExp", () => {
  it.each([
    {
      name: "six days with early withdrawal",
      days: 6,
      relaxDays: 0,
      expected: 450,
    },
    { name: "seven days", days: 7, relaxDays: 0, expected: 1_050 },
    { name: "fourteen days", days: 14, relaxDays: 0, expected: 2_100 },
    { name: "seven relaxed days", days: 7, relaxDays: 7, expected: 4_200 },
    {
      name: "fourteen days with seven relaxed",
      days: 14,
      relaxDays: 7,
      expected: 5_250,
    },
  ])(
    "matches the fixed regression case: $name",
    ({ days, relaxDays, expected }) => {
      const result = calculateNapIslandExp({
        stayMinutes: days * DAY,
        relaxSetting:
          relaxDays === 0
            ? { mode: "none" }
            : { mode: "duration", durationMinutes: relaxDays * DAY },
        natureMultiplier: 1,
      });

      expect(result.finalExp).toBe(expected);
    },
  );

  it("changes from half reward to full reward at exactly seven days", () => {
    expect(
      calculateNapIslandExp({
        stayMinutes: 7 * DAY - 1,
        relaxSetting: { mode: "none" },
        natureMultiplier: 1,
      }).finalExp,
    ).toBe(524);
    expect(
      calculateNapIslandExp({
        stayMinutes: 7 * DAY,
        relaxSetting: { mode: "none" },
        natureMultiplier: 1,
      }).finalExp,
    ).toBe(1_050);
  });

  it("applies nature after early withdrawal and then floors", () => {
    const result = calculateNapIslandExp({
      stayMinutes: DAY,
      relaxSetting: { mode: "none" },
      natureMultiplier: 1.18,
    });

    expect(result.withdrawalAdjustedExp).toBe(75);
    expect(result.finalExp).toBe(88);
  });

  it("caps accumulation and relax application at 365 days", () => {
    const result = calculateNapIslandExp({
      stayMinutes: 400 * DAY,
      relaxSetting: { mode: "tickets", ticketCount: 100 },
      natureMultiplier: 1,
    });

    expect(result.eligibleMinutes).toBe(365 * DAY);
    expect(result.relaxMinutes).toBe(365 * DAY);
    expect(result.finalExp).toBe(219_000);
  });

  it("supports a rule-set rounding override", () => {
    const result = calculateNapIslandExp({
      stayMinutes: 1,
      relaxSetting: { mode: "none" },
      natureMultiplier: 1,
      ruleSet: {
        ...napIslandRuleSet,
        rounding: { stage: "after-nature", mode: "ceil" },
      },
    });

    expect(result.finalExp).toBe(1);
  });
});

describe("roundExp", () => {
  it("implements all configured rounding modes", () => {
    expect(roundExp(1.8, "floor")).toBe(1);
    expect(roundExp(1.5, "round")).toBe(2);
    expect(roundExp(1.2, "ceil")).toBe(2);
    expect(roundExp(-1.8, "truncate")).toBe(-1);
  });
});
