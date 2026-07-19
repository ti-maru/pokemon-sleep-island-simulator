import { describe, expect, it } from "vitest";

import { applyExpToLevel } from "../domain/leveling/applyExpToLevel";
import { getExpCurve } from "../domain/leveling/expCurve";

const curve = getExpCurve(600);

describe("applyExpToLevel", () => {
  it("levels up at the exact boundary", () => {
    expect(
      applyExpToLevel({ level: 1, remainingExpToNextLevel: 54 }, 54, curve),
    ).toEqual({
      beforeLevel: 1,
      afterLevel: 2,
      gainedLevels: 1,
      remainingExpToNextLevel: 71,
      appliedExp: 54,
      ignoredExpAfterLevelCap: 0,
    });
  });

  it("uses remaining EXP to locate the current cumulative position", () => {
    const result = applyExpToLevel(
      { level: 2, remainingExpToNextLevel: 20 },
      20,
      curve,
    );

    expect(result.afterLevel).toBe(3);
    expect(result.remainingExpToNextLevel).toBe(108);
  });

  it("can cross multiple levels", () => {
    const result = applyExpToLevel(
      { level: 1, remainingExpToNextLevel: 54 },
      361,
      curve,
    );

    expect(result.afterLevel).toBe(5);
    expect(result.gainedLevels).toBe(4);
    expect(result.remainingExpToNextLevel).toBe(164);
  });

  it("ignores EXP beyond the configured level cap without treating it as a gauge", () => {
    const result = applyExpToLevel(
      { level: 69, remainingExpToNextLevel: 10 },
      100,
      curve,
      70,
    );

    expect(result.afterLevel).toBe(70);
    expect(result.remainingExpToNextLevel).toBeNull();
    expect(result.appliedExp).toBe(10);
    expect(result.ignoredExpAfterLevelCap).toBe(90);
  });

  it("supports a temporary cap below level 70", () => {
    const result = applyExpToLevel(
      { level: 1, remainingExpToNextLevel: 54 },
      1_000,
      curve,
      3,
    );

    expect(result.afterLevel).toBe(3);
    expect(result.appliedExp).toBe(125);
    expect(result.ignoredExpAfterLevelCap).toBe(875);
  });
});
