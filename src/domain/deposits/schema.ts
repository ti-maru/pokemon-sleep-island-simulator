import { z } from "zod";

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

export const depositSessionSchema = z
  .object({
    id: z.string().min(1),
    individualId: z.string().min(1).nullable(),
    startedAt: z.iso.datetime({ offset: true }),
    timezone: z.string().min(1),
    plannedEndAt: z.iso.datetime({ offset: true }).nullable(),
    relaxSetting: relaxSettingSchema,
    calculationSnapshot: z
      .object({
        displayName: z.string().min(1),
        expType: expTypeSchema,
        natureMultiplier: z.number().positive(),
        levelState: levelStateSchema.nullable(),
        levelCap: z.number().int().min(1).max(70),
      })
      .strict(),
    sourcePlanId: z.string().min(1).nullable(),
    sourcePlanSegmentId: z.string().min(1).nullable(),
    status: z.enum(["active", "completed", "cancelled"]),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const depositSessionListSchema = z.array(depositSessionSchema);
