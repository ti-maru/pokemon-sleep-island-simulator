import type { RoundingMode } from "./types";

export function roundExp(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("The EXP value must be finite.");
  }

  switch (mode) {
    case "floor":
      return Math.floor(value);
    case "round":
      return Math.round(value);
    case "ceil":
      return Math.ceil(value);
    case "truncate":
      return Math.trunc(value);
  }
}
