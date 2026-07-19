import type { DepositSession } from "../deposits/types";
import type { LevelResult, LevelState } from "../leveling/types";
import type { RelaxSetting } from "../napIsland/types";
import type { EntityId, ISODateTime } from "../shared/types";

export interface HistoryInputSnapshot {
  readonly startedAt: ISODateTime | null;
  readonly endedAt: ISODateTime | null;
  readonly timezone: string;
  readonly stayMinutes: number;
  readonly relaxSetting: RelaxSetting;
  readonly expType: 600 | 900 | 1080 | 1320;
  readonly natureMultiplier: number;
  readonly levelState: LevelState | null;
  readonly levelCap: number;
}

export interface HistoryCalculationResult {
  readonly stayMinutes: number;
  readonly eligibleMinutes: number;
  readonly finalExp: number;
  readonly levelResult: LevelResult | null;
  readonly ruleSetId: string;
  readonly dataVersion: string;
}

export interface ActualWithdrawalResult {
  readonly actualExp: number | null;
  readonly levelState: LevelState | null;
  readonly relaxSetting: RelaxSetting;
  readonly note: string;
  readonly appliedSource: "prediction" | "actual-exp" | "actual-level";
}

export interface CalculationHistoryRecord {
  readonly id: EntityId;
  readonly kind: "calculation" | "withdrawal" | "plan-comparison";
  readonly individualId: EntityId | null;
  readonly planId: EntityId | null;
  readonly inputSnapshot: HistoryInputSnapshot;
  readonly originalResult: HistoryCalculationResult;
  readonly latestRecalculatedResult: HistoryCalculationResult | null;
  readonly actualResult: ActualWithdrawalResult | null;
  readonly depositSession: DepositSession | null;
  readonly createdAt: ISODateTime;
}

export interface NamedSnapshot {
  readonly id: EntityId;
  readonly name: string;
  readonly historyRecord: CalculationHistoryRecord;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}
