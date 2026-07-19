import type {
  ExpEffect,
  ExpType,
  LevelResult,
  LevelState,
} from "../../domain/leveling/types";
import type {
  NapIslandExpResult,
  RelaxSetting,
} from "../../domain/napIsland/types";

export type InputMode = "duration" | "datetime";
export type NatureInputMode = "nature" | "effect";
export type RelaxMode = RelaxSetting["mode"];

export interface CalculatorFormValues {
  inputMode: InputMode;
  durationDays: number;
  durationHours: number;
  durationMinutes: number;
  startAt: string;
  endMode: "now" | "specified";
  endAt: string;
  timezone: string;
  relaxMode: RelaxMode;
  ticketCount: number;
  relaxDays: number;
  relaxHours: number;
  relaxMinutes: number;
  natureInputMode: NatureInputMode;
  natureId: string;
  expEffect: ExpEffect;
  pokemonId: string;
  expTypeOverride: boolean;
  expType: `${ExpType}`;
  levelEnabled: boolean;
  currentLevel: number;
  remainingExpToNextLevel: number;
  levelCap: number;
  targetLevelEnabled: boolean;
  targetLevel: number;
  targetDateEnabled: boolean;
  targetDate: string;
}

export interface CustomScenario {
  readonly id: string;
  readonly name: string;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly relaxMode: RelaxMode;
  readonly ticketCount: number;
  readonly relaxDurationMinutes: number;
}

export interface ScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly kind: "current" | "automatic" | "custom";
  readonly stayMinutes: number;
  readonly waitMinutes: number;
  readonly exp: number;
  readonly expDifference: number;
  readonly levelResult: LevelResult | null;
  readonly levelDifference: number | null;
  readonly relaxSetting: RelaxSetting;
}

export interface CalculationViewModel {
  readonly stayMinutes: number;
  readonly startEpochMs: number | null;
  readonly timezone: string;
  readonly expType: ExpType;
  readonly levelCap: number;
  readonly levelState: LevelState | null;
  readonly natureMultiplier: number;
  readonly relaxSetting: RelaxSetting;
  readonly expResult: NapIslandExpResult;
  readonly levelResult: LevelResult | null;
  readonly scenarios: readonly ScenarioResult[];
  readonly sevenDayWaitMinutes: number;
  readonly sevenDayExpDifference: number;
  readonly nextLevelStayMinutes: number | null;
  readonly targetLevelStayMinutes: number | null;
  readonly targetLevelMissingExp: number | null;
  readonly maximumReachableLevel: number | null;
  readonly targetDateStayMinutes: number | null;
  readonly targetDateRequiresStart: boolean;
}
