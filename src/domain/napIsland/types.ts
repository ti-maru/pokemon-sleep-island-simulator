export type MaxAccumulationRule =
  | { readonly kind: "fixed-days"; readonly days: number }
  | { readonly kind: "calendar-year" };

export type RoundingStage =
  | "per-minute"
  | "per-source"
  | "after-combine"
  | "after-early-withdrawal"
  | "after-nature";

export type RoundingMode = "floor" | "round" | "ceil" | "truncate";

export interface RoundingRule {
  readonly stage: RoundingStage;
  readonly mode: RoundingMode;
}

export interface NatureApplicationRule {
  readonly stage: "after-early-withdrawal";
}

export interface NapIslandRuleSet {
  readonly id: string;
  readonly effectiveFrom: string;
  readonly baseExpPerDay: number;
  readonly relaxExpPerDay: number;
  readonly fullRewardThresholdMinutes: number;
  readonly earlyWithdrawalMultiplier: number;
  readonly maxAccumulation: MaxAccumulationRule;
  readonly rounding: RoundingRule;
  readonly natureApplication: NatureApplicationRule;
  readonly sourceRefs: readonly string[];
}

export type RelaxSetting =
  | { readonly mode: "none" }
  | { readonly mode: "tickets"; readonly ticketCount: number }
  | { readonly mode: "duration"; readonly durationMinutes: number };

export interface NapIslandExpInput {
  readonly stayMinutes: number;
  readonly relaxSetting: RelaxSetting;
  readonly natureMultiplier: number;
  readonly ruleSet?: NapIslandRuleSet;
}

export interface NapIslandExpResult {
  readonly stayMinutes: number;
  readonly eligibleMinutes: number;
  readonly relaxMinutes: number;
  readonly baseRawExp: number;
  readonly relaxRawExp: number;
  readonly grossRawExp: number;
  readonly earlyWithdrawalApplied: boolean;
  readonly withdrawalAdjustedExp: number;
  readonly natureMultiplier: number;
  readonly finalExp: number;
  readonly ruleSetId: string;
}
