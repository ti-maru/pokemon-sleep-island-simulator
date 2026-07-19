import type { MaxAccumulationRule } from "./types";

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

function assertFiniteEpoch(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite epoch timestamp.`);
  }
}

export function calculateCompletedStayMinutes(
  startEpochMs: number,
  endEpochMs: number,
): number {
  assertFiniteEpoch(startEpochMs, "startEpochMs");
  assertFiniteEpoch(endEpochMs, "endEpochMs");

  return Math.max(0, Math.floor((endEpochMs - startEpochMs) / MINUTE_MS));
}

export function getMaximumAccumulationMinutes(
  rule: MaxAccumulationRule,
  startEpochMs?: number,
): number {
  if (rule.kind === "fixed-days") {
    return rule.days * MINUTES_PER_DAY;
  }

  if (startEpochMs === undefined) {
    throw new RangeError(
      "startEpochMs is required for a calendar-year accumulation rule.",
    );
  }

  assertFiniteEpoch(startEpochMs, "startEpochMs");
  const anniversary = new Date(startEpochMs);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);

  return calculateCompletedStayMinutes(startEpochMs, anniversary.getTime());
}

export function clampToAccumulationLimit(
  stayMinutes: number,
  rule: MaxAccumulationRule,
  startEpochMs?: number,
): number {
  if (!Number.isFinite(stayMinutes)) {
    throw new RangeError("stayMinutes must be finite.");
  }

  const completedMinutes = Math.max(0, Math.floor(stayMinutes));
  return Math.min(
    completedMinutes,
    getMaximumAccumulationMinutes(rule, startEpochMs),
  );
}
