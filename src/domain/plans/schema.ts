import { z } from "zod";

import { relaxSettingSchema } from "../napIsland/schema";

const levelStateSchema = z
  .object({
    level: z.number().int().min(1).max(70),
    remainingExpToNextLevel: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const planSegmentSchema = z
  .object({
    id: z.string().min(1),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
    timezone: z.string().min(1),
    relaxSetting: relaxSettingSchema,
    expectedExp: z.number().int().nonnegative(),
    expectedEndState: levelStateSchema,
    status: z.enum(["planned", "active", "completed", "skipped"]),
  })
  .strict()
  .refine(
    (segment) => Date.parse(segment.endAt) >= Date.parse(segment.startAt),
    {
      path: ["endAt"],
      message: "終了日時は開始日時以後にしてください。",
    },
  );

export const growthPlanSchema = z
  .object({
    id: z.string().min(1),
    individualId: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    strategy: z.enum(["fastest", "ticket-saving", "seven-day", "custom"]),
    targetLevel: z.number().int().min(1).max(70).nullable(),
    targetDate: z.iso.datetime({ offset: true }).nullable(),
    segments: z.array(planSegmentSchema),
    status: z.enum(["draft", "active", "completed", "archived"]),
    summary: z
      .object({
        reachable: z.boolean(),
        expectedEndAt: z.iso.datetime({ offset: true }).nullable(),
        totalExpectedExp: z.number().int().nonnegative(),
        ticketCount: z.number().int().nonnegative(),
        missingExp: z.number().int().nonnegative(),
        maximumLevel: z.number().int().min(1).max(70),
      })
      .strict(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const growthPlanListSchema = z.array(growthPlanSchema);
