import { calculateNapIslandExp } from "../napIsland/calculateNapIslandExp";
import { getMaximumAccumulationMinutes } from "../napIsland/calculateStayMinutes";
import type { NapIslandRuleSet, RelaxSetting } from "../napIsland/types";
import { napIslandRuleSet } from "../../data/masterData";
import { calculateCurrentCumulativeExp } from "./applyExpToLevel";
import { getCumulativeExpAtLevel } from "./expCurve";
import type { ExpCurve, LevelState, TargetLevelTimeResult } from "./types";

export interface FindTargetLevelTimeInput {
  readonly currentState: LevelState;
  readonly targetLevel: number;
  readonly curve: ExpCurve;
  readonly relaxSetting: RelaxSetting;
  readonly natureMultiplier: number;
  readonly ruleSet?: NapIslandRuleSet;
}

export function findTargetLevelTime(
  input: FindTargetLevelTimeInput,
): TargetLevelTimeResult {
  const ruleSet = input.ruleSet ?? napIslandRuleSet;

  if (
    !Number.isInteger(input.targetLevel) ||
    input.targetLevel < input.currentState.level ||
    input.targetLevel > input.curve.maxDefinedLevel
  ) {
    throw new RangeError(
      `targetLevel must be an integer from ${input.currentState.level} to ${input.curve.maxDefinedLevel}.`,
    );
  }

  const currentCumulativeExp = calculateCurrentCumulativeExp(
    input.currentState,
    input.curve,
  );
  const requiredExp = Math.max(
    0,
    getCumulativeExpAtLevel(input.curve, input.targetLevel) -
      currentCumulativeExp,
  );
  const maximumMinutes = getMaximumAccumulationMinutes(ruleSet.maxAccumulation);
  const calculateExpAt = (stayMinutes: number) =>
    calculateNapIslandExp({
      stayMinutes,
      relaxSetting: input.relaxSetting,
      natureMultiplier: input.natureMultiplier,
      ruleSet,
    }).finalExp;
  const maximumExp = calculateExpAt(maximumMinutes);

  if (maximumExp < requiredExp) {
    return {
      reachable: false,
      targetLevel: input.targetLevel,
      stayMinutes: null,
      requiredExp,
      maximumExp,
      missingExp: requiredExp - maximumExp,
    };
  }

  let low = 0;
  let high = maximumMinutes;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (calculateExpAt(middle) >= requiredExp) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return {
    reachable: true,
    targetLevel: input.targetLevel,
    stayMinutes: low,
    requiredExp,
    maximumExp,
    missingExp: 0,
  };
}
