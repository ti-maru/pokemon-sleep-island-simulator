export const EXP_TYPES = [600, 900, 1080, 1320] as const;

export type ExpType = (typeof EXP_TYPES)[number];
export type ExpEffect = "up" | "neutral" | "down";

export interface ExpCurve {
  readonly id: string;
  readonly expType: ExpType;
  readonly maxDefinedLevel: number;
  readonly cumulativeExpToReachLevel: Readonly<Record<number, number>>;
  readonly dataVersion: string;
}

export interface LevelState {
  readonly level: number;
  readonly remainingExpToNextLevel: number | null;
}

export interface LevelResult {
  readonly beforeLevel: number;
  readonly afterLevel: number;
  readonly gainedLevels: number;
  readonly remainingExpToNextLevel: number | null;
  readonly appliedExp: number;
  readonly ignoredExpAfterLevelCap: number;
}

export interface TargetLevelTimeResult {
  readonly reachable: boolean;
  readonly targetLevel: number;
  readonly stayMinutes: number | null;
  readonly requiredExp: number;
  readonly maximumExp: number;
  readonly missingExp: number;
}
