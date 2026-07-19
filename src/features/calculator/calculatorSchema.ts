import { z } from "zod";

import { pokemonExpTypeMaster } from "../../data/masterData";
import { getExpCurve, getExpToNextLevel } from "../../domain/leveling/expCurve";
import type { ExpType } from "../../domain/leveling/types";
import {
  isIanaTimeZone,
  zonedDateTimeToEpochMs,
} from "../../application/calculate/dateTime";

const integer = z.number().int("整数で入力してください。");
const nonNegativeInteger = integer.min(0, "0以上で入力してください。");

export const calculatorSchema = z
  .object({
    inputMode: z.enum(["duration", "datetime"]),
    durationDays: nonNegativeInteger.max(365, "365日以内で入力してください。"),
    durationHours: nonNegativeInteger.max(23, "23以下で入力してください。"),
    durationMinutes: nonNegativeInteger.max(59, "59以下で入力してください。"),
    startAt: z.string(),
    endMode: z.enum(["now", "specified"]),
    endAt: z.string(),
    timezone: z
      .string()
      .refine(isIanaTimeZone, "有効なタイムゾーンを選択してください。"),
    relaxMode: z.enum(["none", "tickets", "duration"]),
    ticketCount: nonNegativeInteger,
    relaxDays: nonNegativeInteger,
    relaxHours: nonNegativeInteger.max(23, "23以下で入力してください。"),
    relaxMinutes: nonNegativeInteger.max(59, "59以下で入力してください。"),
    natureInputMode: z.enum(["nature", "effect"]),
    natureId: z.string(),
    expEffect: z.enum(["up", "neutral", "down"]),
    pokemonId: z.string(),
    expTypeOverride: z.boolean(),
    expType: z.enum(["600", "900", "1080", "1320"]),
    levelEnabled: z.boolean(),
    currentLevel: integer.min(1, "Lv.1以上で入力してください。").max(70),
    remainingExpToNextLevel: nonNegativeInteger,
    levelCap: integer.min(1).max(70),
    targetLevelEnabled: z.boolean(),
    targetLevel: integer.min(1).max(70),
    targetDateEnabled: z.boolean(),
    targetDate: z.string(),
  })
  .superRefine((values, context) => {
    const duration =
      values.durationDays * 24 * 60 +
      values.durationHours * 60 +
      values.durationMinutes;

    if (values.inputMode === "duration" && duration > 365 * 24 * 60) {
      context.addIssue({
        code: "custom",
        path: ["durationDays"],
        message: "滞在時間は365日以内で入力してください。",
      });
    }

    if (values.inputMode === "datetime") {
      try {
        const start = zonedDateTimeToEpochMs(values.startAt, values.timezone);
        if (values.endMode === "specified") {
          const end = zonedDateTimeToEpochMs(values.endAt, values.timezone);
          if (end < start) {
            context.addIssue({
              code: "custom",
              path: ["endAt"],
              message: "引き取り日時は開始日時以後にしてください。",
            });
          }
        }
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: [values.startAt.length === 0 ? "startAt" : "endAt"],
          message:
            error instanceof Error ? error.message : "日時を確認してください。",
        });
      }
    }

    if (values.levelEnabled) {
      if (values.currentLevel > values.levelCap) {
        context.addIssue({
          code: "custom",
          path: ["currentLevel"],
          message: "現在レベルはレベル上限以下にしてください。",
        });
      }

      const pokemon = pokemonExpTypeMaster.pokemon.find(
        ({ id }) => id === values.pokemonId,
      );
      const expType = Number(
        values.expTypeOverride || pokemon === undefined
          ? values.expType
          : pokemon.expType,
      ) as ExpType;
      const expToNext = getExpToNextLevel(
        getExpCurve(expType),
        values.currentLevel,
      );

      if (expToNext !== null && values.remainingExpToNextLevel > expToNext) {
        context.addIssue({
          code: "custom",
          path: ["remainingExpToNextLevel"],
          message: `このレベルでは${expToNext.toLocaleString("ja-JP")}以下で入力してください。`,
        });
      }

      if (
        values.targetLevelEnabled &&
        (values.targetLevel < values.currentLevel ||
          values.targetLevel > values.levelCap)
      ) {
        context.addIssue({
          code: "custom",
          path: ["targetLevel"],
          message: "目標レベルは現在レベル以上、レベル上限以下にしてください。",
        });
      }
    }

    if (values.targetDateEnabled && values.targetDate.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "目標日時を入力してください。",
      });
    }
  });
