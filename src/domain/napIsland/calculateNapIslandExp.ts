import { napIslandRuleSet } from "../../data/masterData";
import { clampToAccumulationLimit } from "./calculateStayMinutes";
import { resolveRelaxMinutes } from "./resolveRelaxMinutes";
import { roundExp } from "./rounding";
import type {
  NapIslandExpInput,
  NapIslandExpResult,
  NapIslandRuleSet,
} from "./types";

const MINUTES_PER_DAY = 24 * 60;

function assertInput(input: NapIslandExpInput): void {
  if (!Number.isFinite(input.stayMinutes)) {
    throw new RangeError("stayMinutes must be finite.");
  }

  if (!Number.isFinite(input.natureMultiplier) || input.natureMultiplier <= 0) {
    throw new RangeError("natureMultiplier must be a positive finite value.");
  }
}

function calculateRawSources(
  eligibleMinutes: number,
  relaxMinutes: number,
  ruleSet: NapIslandRuleSet,
): readonly [baseExp: number, relaxExp: number] {
  const basePerMinute = ruleSet.baseExpPerDay / MINUTES_PER_DAY;
  const relaxPerMinute = ruleSet.relaxExpPerDay / MINUTES_PER_DAY;

  if (ruleSet.rounding.stage === "per-minute") {
    return [
      roundExp(basePerMinute, ruleSet.rounding.mode) * eligibleMinutes,
      roundExp(relaxPerMinute, ruleSet.rounding.mode) * relaxMinutes,
    ];
  }

  const baseRawExp = eligibleMinutes * basePerMinute;
  const relaxRawExp = relaxMinutes * relaxPerMinute;

  if (ruleSet.rounding.stage === "per-source") {
    return [
      roundExp(baseRawExp, ruleSet.rounding.mode),
      roundExp(relaxRawExp, ruleSet.rounding.mode),
    ];
  }

  return [baseRawExp, relaxRawExp];
}

export function calculateNapIslandExp(
  input: NapIslandExpInput,
): NapIslandExpResult {
  assertInput(input);

  const ruleSet = input.ruleSet ?? napIslandRuleSet;
  const stayMinutes = Math.max(0, Math.floor(input.stayMinutes));
  const eligibleMinutes = clampToAccumulationLimit(
    stayMinutes,
    ruleSet.maxAccumulation,
  );
  const relaxMinutes = resolveRelaxMinutes(eligibleMinutes, input.relaxSetting);
  const [baseRawExp, relaxRawExp] = calculateRawSources(
    eligibleMinutes,
    relaxMinutes,
    ruleSet,
  );

  const combinedExp = baseRawExp + relaxRawExp;
  const grossRawExp =
    ruleSet.rounding.stage === "after-combine"
      ? roundExp(combinedExp, ruleSet.rounding.mode)
      : combinedExp;
  const earlyWithdrawalApplied =
    eligibleMinutes < ruleSet.fullRewardThresholdMinutes;
  const adjustedExp = earlyWithdrawalApplied
    ? grossRawExp * ruleSet.earlyWithdrawalMultiplier
    : grossRawExp;
  const withdrawalAdjustedExp =
    ruleSet.rounding.stage === "after-early-withdrawal"
      ? roundExp(adjustedExp, ruleSet.rounding.mode)
      : adjustedExp;
  const natureAdjustedExp = withdrawalAdjustedExp * input.natureMultiplier;
  const finalExp =
    ruleSet.rounding.stage === "after-nature"
      ? roundExp(natureAdjustedExp, ruleSet.rounding.mode)
      : natureAdjustedExp;

  return {
    stayMinutes,
    eligibleMinutes,
    relaxMinutes,
    baseRawExp,
    relaxRawExp,
    grossRawExp,
    earlyWithdrawalApplied,
    withdrawalAdjustedExp,
    natureMultiplier: input.natureMultiplier,
    finalExp,
    ruleSetId: ruleSet.id,
  };
}
