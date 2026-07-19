import { dataManifest, napIslandRuleSet } from "../../data/masterData";
import {
  calculationHistoryRecordSchema,
  namedSnapshotSchema,
} from "../../domain/history/schema";
import type {
  ActualWithdrawalResult,
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { LevelState } from "../../domain/leveling/types";
import type { CalculationViewModel } from "../../features/calculator/calculatorTypes";
import type { DepositSession } from "../../domain/deposits/types";
import type { DepositProjection } from "../deposits/depositService";
import type { AppRepository } from "../persistence/AppRepository";
import { calculateNapIslandExp } from "../../domain/napIsland/calculateNapIslandExp";
import { applyExpToLevel } from "../../domain/leveling/applyExpToLevel";
import { getExpCurve } from "../../domain/leveling/expCurve";

function id(prefix: string): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random()}`
  );
}

function result(projection: DepositProjection) {
  return {
    stayMinutes: projection.stayMinutes,
    eligibleMinutes: projection.expResult.eligibleMinutes,
    finalExp: projection.expResult.finalExp,
    levelResult: projection.levelResult,
    ruleSetId: napIslandRuleSet.id,
    dataVersion: dataManifest.dataVersion,
  };
}

export function createCalculationHistory(
  model: CalculationViewModel,
  createdAt = new Date().toISOString(),
): CalculationHistoryRecord {
  return calculationHistoryRecordSchema.parse({
    id: id("history"),
    kind: "calculation",
    individualId: null,
    planId: null,
    inputSnapshot: {
      startedAt:
        model.startEpochMs === null
          ? null
          : new Date(model.startEpochMs).toISOString(),
      endedAt:
        model.startEpochMs === null
          ? null
          : new Date(
              model.startEpochMs + model.stayMinutes * 60_000,
            ).toISOString(),
      timezone: model.timezone,
      stayMinutes: model.stayMinutes,
      relaxSetting: model.relaxSetting,
      expType: model.expType,
      natureMultiplier: model.natureMultiplier,
      levelState: model.levelState,
      levelCap: model.levelCap,
    },
    originalResult: {
      stayMinutes: model.stayMinutes,
      eligibleMinutes: model.expResult.eligibleMinutes,
      finalExp: model.expResult.finalExp,
      levelResult: model.levelResult,
      ruleSetId: napIslandRuleSet.id,
      dataVersion: dataManifest.dataVersion,
    },
    latestRecalculatedResult: null,
    actualResult: null,
    depositSession: null,
    createdAt,
  });
}

export function createWithdrawalHistory(
  session: DepositSession,
  projection: DepositProjection,
  actualResult: ActualWithdrawalResult | null,
  completedAt: string,
): CalculationHistoryRecord {
  return calculationHistoryRecordSchema.parse({
    id: id("history"),
    kind: "withdrawal",
    individualId: session.individualId,
    planId: session.sourcePlanId,
    inputSnapshot: {
      startedAt: session.startedAt,
      endedAt: completedAt,
      timezone: session.timezone,
      stayMinutes: projection.stayMinutes,
      relaxSetting: session.relaxSetting,
      expType: session.calculationSnapshot.expType,
      natureMultiplier: session.calculationSnapshot.natureMultiplier,
      levelState: session.calculationSnapshot.levelState,
      levelCap: session.calculationSnapshot.levelCap,
    },
    originalResult: result(projection),
    latestRecalculatedResult: null,
    actualResult,
    depositSession: {
      ...session,
      status: "completed",
      completedAt,
      updatedAt: completedAt,
    },
    createdAt: completedAt,
  });
}

export async function saveNamedSnapshot(
  repository: AppRepository,
  name: string,
  historyRecord: CalculationHistoryRecord,
  now = new Date().toISOString(),
): Promise<NamedSnapshot> {
  const snapshot = namedSnapshotSchema.parse({
    id: id("snapshot"),
    name,
    historyRecord,
    createdAt: now,
    updatedAt: now,
  });
  await repository.putSnapshot(snapshot);
  return snapshot;
}

export function sameLevelState(left: LevelState, right: LevelState): boolean {
  return (
    left.level === right.level &&
    left.remainingExpToNextLevel === right.remainingExpToNextLevel
  );
}

export function recalculateHistoryWithLatestRules(
  history: CalculationHistoryRecord,
): CalculationHistoryRecord {
  const input = history.inputSnapshot;
  const expResult = calculateNapIslandExp({
    stayMinutes: input.stayMinutes,
    relaxSetting: input.relaxSetting,
    natureMultiplier: input.natureMultiplier,
  });
  const levelResult =
    input.levelState === null
      ? null
      : applyExpToLevel(
          input.levelState,
          expResult.finalExp,
          getExpCurve(input.expType),
          input.levelCap,
        );
  return calculationHistoryRecordSchema.parse({
    ...history,
    latestRecalculatedResult: {
      stayMinutes: input.stayMinutes,
      eligibleMinutes: expResult.eligibleMinutes,
      finalExp: expResult.finalExp,
      levelResult,
      ruleSetId: napIslandRuleSet.id,
      dataVersion: dataManifest.dataVersion,
    },
  });
}
