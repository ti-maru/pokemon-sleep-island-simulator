import { expCurves } from "../../data/masterData";
import type { ExpCurve, ExpType } from "./types";

export function getExpCurve(expType: ExpType): ExpCurve {
  return expCurves[expType];
}

export function getCumulativeExpAtLevel(
  curve: ExpCurve,
  level: number,
): number {
  if (!Number.isInteger(level) || level < 1 || level > curve.maxDefinedLevel) {
    throw new RangeError(
      `level must be an integer from 1 to ${curve.maxDefinedLevel}.`,
    );
  }

  const cumulativeExp = curve.cumulativeExpToReachLevel[level];

  if (cumulativeExp === undefined) {
    throw new RangeError(`The EXP curve does not define level ${level}.`);
  }

  return cumulativeExp;
}

export function getExpToNextLevel(
  curve: ExpCurve,
  level: number,
): number | null {
  if (level === curve.maxDefinedLevel) {
    return null;
  }

  return (
    getCumulativeExpAtLevel(curve, level + 1) -
    getCumulativeExpAtLevel(curve, level)
  );
}
