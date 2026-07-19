import { getCumulativeExpAtLevel, getExpToNextLevel } from "./expCurve";
import type { ExpCurve, LevelResult, LevelState } from "./types";

export function calculateCurrentCumulativeExp(
  state: LevelState,
  curve: ExpCurve,
): number {
  if (
    !Number.isInteger(state.level) ||
    state.level < 1 ||
    state.level > curve.maxDefinedLevel
  ) {
    throw new RangeError(
      `Current level must be an integer from 1 to ${curve.maxDefinedLevel}.`,
    );
  }

  const expToNextLevel = getExpToNextLevel(curve, state.level);

  if (expToNextLevel === null) {
    if (state.remainingExpToNextLevel !== null) {
      throw new RangeError(
        "remainingExpToNextLevel must be null at the curve cap.",
      );
    }

    return getCumulativeExpAtLevel(curve, state.level);
  }

  if (
    state.remainingExpToNextLevel === null ||
    !Number.isInteger(state.remainingExpToNextLevel) ||
    state.remainingExpToNextLevel < 0 ||
    state.remainingExpToNextLevel > expToNextLevel
  ) {
    throw new RangeError(
      `remainingExpToNextLevel must be an integer from 0 to ${expToNextLevel}.`,
    );
  }

  return (
    getCumulativeExpAtLevel(curve, state.level + 1) -
    state.remainingExpToNextLevel
  );
}

function findLevelAtCumulativeExp(
  curve: ExpCurve,
  cumulativeExp: number,
  levelCap: number,
): number {
  let low = 1;
  let high = levelCap;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if (getCumulativeExpAtLevel(curve, middle) <= cumulativeExp) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

export function applyExpToLevel(
  state: LevelState,
  gainedExp: number,
  curve: ExpCurve,
  requestedLevelCap = 70,
): LevelResult {
  if (!Number.isInteger(gainedExp) || gainedExp < 0) {
    throw new RangeError("gainedExp must be a non-negative integer.");
  }

  if (
    !Number.isInteger(requestedLevelCap) ||
    requestedLevelCap < state.level ||
    requestedLevelCap > curve.maxDefinedLevel
  ) {
    throw new RangeError(
      `levelCap must be an integer from ${state.level} to ${curve.maxDefinedLevel}.`,
    );
  }

  const currentCumulativeExp = calculateCurrentCumulativeExp(state, curve);
  const capCumulativeExp = getCumulativeExpAtLevel(curve, requestedLevelCap);
  const applicableExpCapacity = Math.max(
    0,
    capCumulativeExp - currentCumulativeExp,
  );
  const appliedExp = Math.min(gainedExp, applicableExpCapacity);
  const ignoredExpAfterLevelCap = gainedExp - appliedExp;
  const finalCumulativeExp = currentCumulativeExp + appliedExp;
  const afterLevel = findLevelAtCumulativeExp(
    curve,
    finalCumulativeExp,
    requestedLevelCap,
  );
  const remainingExpToNextLevel =
    afterLevel === requestedLevelCap
      ? null
      : getCumulativeExpAtLevel(curve, afterLevel + 1) - finalCumulativeExp;

  return {
    beforeLevel: state.level,
    afterLevel,
    gainedLevels: afterLevel - state.level,
    remainingExpToNextLevel,
    appliedExp,
    ignoredExpAfterLevelCap,
  };
}
