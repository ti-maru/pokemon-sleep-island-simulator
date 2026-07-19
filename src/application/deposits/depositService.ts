import { natureMaster, pokemonExpTypeMaster } from "../../data/masterData";
import { depositSessionSchema } from "../../domain/deposits/schema";
import type {
  DepositCalculationSnapshot,
  DepositSession,
} from "../../domain/deposits/types";
import type { PokemonIndividual } from "../../domain/individuals/types";
import { applyExpToLevel } from "../../domain/leveling/applyExpToLevel";
import { getExpCurve } from "../../domain/leveling/expCurve";
import type { ExpEffect, LevelResult } from "../../domain/leveling/types";
import { calculateNapIslandExp } from "../../domain/napIsland/calculateNapIslandExp";
import { calculateCompletedStayMinutes } from "../../domain/napIsland/calculateStayMinutes";
import type {
  NapIslandExpResult,
  RelaxSetting,
} from "../../domain/napIsland/types";
import type { AppRepository } from "../persistence/AppRepository";
import type { LevelState } from "../../domain/leveling/types";
import type { ActualWithdrawalResult } from "../../domain/history/types";
import { createWithdrawalHistory } from "../history/historyService";

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `deposit-${Date.now()}-${Math.random()}`
  );
}

function multiplierForEffect(effect: ExpEffect): number {
  return (
    natureMaster.natures.find(({ expEffect }) => expEffect === effect)
      ?.multiplier ?? 1
  );
}

export function snapshotIndividual(
  individual: PokemonIndividual,
): DepositCalculationSnapshot {
  const pokemon = pokemonExpTypeMaster.pokemon.find(
    ({ id }) => id === individual.pokemonId,
  );
  const nature = natureMaster.natures.find(
    ({ id }) => id === individual.natureId,
  );

  return {
    displayName: individual.displayName,
    expType: individual.expTypeOverride ?? pokemon?.expType ?? 600,
    natureMultiplier:
      individual.expEffectOverride === null
        ? (nature?.multiplier ?? 1)
        : multiplierForEffect(individual.expEffectOverride),
    levelState: {
      level: individual.currentLevel,
      remainingExpToNextLevel: individual.remainingExpToNextLevel,
    },
    levelCap: 70,
  };
}

export interface StartDepositInput {
  readonly individualId: string | null;
  readonly startedAt: string;
  readonly timezone: string;
  readonly plannedEndAt: string | null;
  readonly relaxSetting: RelaxSetting;
  readonly calculationSnapshot: DepositCalculationSnapshot;
  readonly sourcePlanId?: string | null;
  readonly sourcePlanSegmentId?: string | null;
}

export function createDepositSession(
  input: StartDepositInput,
  now = new Date().toISOString(),
): DepositSession {
  return depositSessionSchema.parse({
    id: createId(),
    individualId: input.individualId,
    startedAt: input.startedAt,
    timezone: input.timezone,
    plannedEndAt: input.plannedEndAt,
    relaxSetting: input.relaxSetting,
    calculationSnapshot: input.calculationSnapshot,
    sourcePlanId: input.sourcePlanId ?? null,
    sourcePlanSegmentId: input.sourcePlanSegmentId ?? null,
    status: "active",
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export interface DepositProjection {
  readonly stayMinutes: number;
  readonly expResult: NapIslandExpResult;
  readonly levelResult: LevelResult | null;
}

export function calculateDepositProjection(
  session: DepositSession,
  endEpochMs = Date.now(),
): DepositProjection {
  const stayMinutes = calculateCompletedStayMinutes(
    Date.parse(session.startedAt),
    endEpochMs,
  );
  const expResult = calculateNapIslandExp({
    stayMinutes,
    relaxSetting: session.relaxSetting,
    natureMultiplier: session.calculationSnapshot.natureMultiplier,
  });
  const levelState = session.calculationSnapshot.levelState;
  const levelResult =
    levelState === null
      ? null
      : applyExpToLevel(
          levelState,
          expResult.finalExp,
          getExpCurve(session.calculationSnapshot.expType),
          session.calculationSnapshot.levelCap,
        );

  return { stayMinutes, expResult, levelResult };
}

export interface WithdrawalUndoRecord {
  readonly activeSession: DepositSession;
  readonly previousIndividual: PokemonIndividual | null;
  readonly historyId: string;
}

export interface WithdrawalActualInput {
  readonly actualExp: number | null;
  readonly levelState: LevelState | null;
  readonly relaxSetting: RelaxSetting;
  readonly note: string;
  readonly appliedSource: "prediction" | "actual-exp" | "actual-level";
}

export async function completeDeposit(
  repository: AppRepository,
  session: DepositSession,
  individual: PokemonIndividual | null,
  completedAt = new Date().toISOString(),
  actualInput?: WithdrawalActualInput,
): Promise<WithdrawalUndoRecord> {
  const projection = calculateDepositProjection(
    session,
    Date.parse(completedAt),
  );
  const predictionForApplication =
    actualInput?.appliedSource === "prediction"
      ? calculateDepositProjection(
          { ...session, relaxSetting: actualInput.relaxSetting },
          Date.parse(completedAt),
        )
      : projection;
  const completedSession = depositSessionSchema.parse({
    ...session,
    status: "completed",
    completedAt,
    updatedAt: completedAt,
  });
  const calculatedActualLevel =
    actualInput?.actualExp === null ||
    actualInput?.actualExp === undefined ||
    session.calculationSnapshot.levelState === null
      ? null
      : applyExpToLevel(
          session.calculationSnapshot.levelState,
          actualInput.actualExp,
          getExpCurve(session.calculationSnapshot.expType),
          session.calculationSnapshot.levelCap,
        );
  const appliedLevelState: LevelState | null =
    actualInput?.appliedSource === "actual-level" &&
    actualInput.levelState !== null
      ? actualInput.levelState
      : actualInput?.appliedSource === "actual-exp" &&
          calculatedActualLevel !== null
        ? {
            level: calculatedActualLevel.afterLevel,
            remainingExpToNextLevel:
              calculatedActualLevel.remainingExpToNextLevel,
          }
        : predictionForApplication.levelResult === null
          ? null
          : {
              level: predictionForApplication.levelResult.afterLevel,
              remainingExpToNextLevel:
                predictionForApplication.levelResult.remainingExpToNextLevel,
            };
  const actualResult: ActualWithdrawalResult | null =
    actualInput === undefined
      ? null
      : {
          actualExp: actualInput.actualExp,
          levelState: actualInput.levelState,
          relaxSetting: actualInput.relaxSetting,
          note: actualInput.note,
          appliedSource: actualInput.appliedSource,
        };
  const updatedIndividual =
    individual === null || appliedLevelState === null
      ? null
      : {
          ...individual,
          currentLevel: appliedLevelState.level,
          remainingExpToNextLevel: appliedLevelState.remainingExpToNextLevel,
          updatedAt: completedAt,
        };
  const history = createWithdrawalHistory(
    session,
    projection,
    actualResult,
    completedAt,
  );

  await repository.completeDeposit(
    completedSession,
    updatedIndividual,
    history,
  );
  return {
    activeSession: session,
    previousIndividual: individual,
    historyId: history.id,
  };
}

export async function cancelDeposit(
  repository: AppRepository,
  session: DepositSession,
  cancelledAt = new Date().toISOString(),
): Promise<void> {
  await repository.completeDeposit(
    depositSessionSchema.parse({
      ...session,
      status: "cancelled",
      completedAt: cancelledAt,
      updatedAt: cancelledAt,
    }),
    null,
  );
}

export async function undoWithdrawal(
  repository: AppRepository,
  record: WithdrawalUndoRecord,
): Promise<void> {
  await repository.restoreDeposit(
    record.activeSession,
    record.previousIndividual,
    record.historyId,
  );
}
