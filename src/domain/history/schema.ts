import { z } from "zod";

import { depositSessionSchema } from "../deposits/schema";
import { relaxSettingSchema } from "../napIsland/schema";

const expTypeSchema = z.union([
  z.literal(600),
  z.literal(900),
  z.literal(1080),
  z.literal(1320),
]);
const levelStateSchema = z
  .object({
    level: z.number().int().min(1).max(70),
    remainingExpToNextLevel: z.number().int().nonnegative().nullable(),
  })
  .strict();
const levelResultSchema = z
  .object({
    beforeLevel: z.number().int().min(1).max(70),
    afterLevel: z.number().int().min(1).max(70),
    gainedLevels: z.number().int().nonnegative(),
    remainingExpToNextLevel: z.number().int().nonnegative().nullable(),
    appliedExp: z.number().int().nonnegative(),
    ignoredExpAfterLevelCap: z.number().int().nonnegative(),
  })
  .strict();

export const historyInputSnapshotSchema = z
  .object({
    startedAt: z.iso.datetime({ offset: true }).nullable(),
    endedAt: z.iso.datetime({ offset: true }).nullable(),
    timezone: z.string().min(1),
    stayMinutes: z.number().int().nonnegative(),
    relaxSetting: relaxSettingSchema,
    expType: expTypeSchema,
    natureMultiplier: z.number().positive(),
    levelState: levelStateSchema.nullable(),
    levelCap: z.number().int().min(1).max(70),
  })
  .strict();

export const historyCalculationResultSchema = z
  .object({
    stayMinutes: z.number().int().nonnegative(),
    eligibleMinutes: z.number().int().nonnegative(),
    finalExp: z.number().int().nonnegative(),
    levelResult: levelResultSchema.nullable(),
    ruleSetId: z.string().min(1),
    dataVersion: z.string().min(1),
  })
  .strict();

export const actualWithdrawalResultSchema = z
  .object({
    actualExp: z.number().int().nonnegative().nullable(),
    levelState: levelStateSchema.nullable(),
    relaxSetting: relaxSettingSchema,
    note: z.string().max(1000),
    appliedSource: z.enum(["prediction", "actual-exp", "actual-level"]),
  })
  .strict();

export const calculationHistoryRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["calculation", "withdrawal", "plan-comparison"]),
    individualId: z.string().min(1).nullable(),
    planId: z.string().min(1).nullable(),
    inputSnapshot: historyInputSnapshotSchema,
    originalResult: historyCalculationResultSchema,
    latestRecalculatedResult: historyCalculationResultSchema.nullable(),
    actualResult: actualWithdrawalResultSchema.nullable(),
    depositSession: depositSessionSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const calculationHistoryRecordListSchema = z.array(
  calculationHistoryRecordSchema,
);

export const namedSnapshotSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    historyRecord: calculationHistoryRecordSchema,
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const namedSnapshotListSchema = z.array(namedSnapshotSchema);
