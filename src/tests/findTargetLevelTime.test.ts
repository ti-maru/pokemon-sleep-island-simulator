import { describe, expect, it } from "vitest";

import { getExpCurve } from "../domain/leveling/expCurve";
import { findTargetLevelTime } from "../domain/leveling/findTargetLevelTime";

const curve = getExpCurve(600);

describe("findTargetLevelTime", () => {
  it("finds the first completed minute that reaches a target", () => {
    const result = findTargetLevelTime({
      currentState: { level: 1, remainingExpToNextLevel: 54 },
      targetLevel: 2,
      curve,
      relaxSetting: { mode: "none" },
      natureMultiplier: 1,
    });

    expect(result.reachable).toBe(true);
    expect(result.stayMinutes).toBe(1_037);
  });

  it("handles the seven-day reward discontinuity", () => {
    const result = findTargetLevelTime({
      currentState: { level: 1, remainingExpToNextLevel: 54 },
      targetLevel: 6,
      curve,
      relaxSetting: { mode: "none" },
      natureMultiplier: 1,
    });

    expect(result.requiredExp).toBe(525);
    expect(result.stayMinutes).toBe(7 * 24 * 60);
  });

  it("reports the deficit when the target is beyond maximum accumulation", () => {
    const result = findTargetLevelTime({
      currentState: { level: 1, remainingExpToNextLevel: 54 },
      targetLevel: 70,
      curve,
      relaxSetting: { mode: "none" },
      natureMultiplier: 1,
    });

    expect(result.reachable).toBe(false);
    expect(result.maximumExp).toBe(54_750);
    expect(result.missingExp).toBe(27_412);
  });
});
