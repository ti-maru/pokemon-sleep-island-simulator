import { z } from "zod";

import { EXP_TYPES } from "../domain/leveling/types";

const dataConfidenceSchema = z.enum([
  "official",
  "multi-source-verified",
  "single-source",
  "provisional",
  "needs-review",
]);

const sourceRefsSchema = z.array(z.url()).min(1);

export const napIslandRuleSetSchema = z
  .object({
    id: z.string().min(1),
    effectiveFrom: z.iso.datetime({ offset: true }),
    baseExpPerDay: z.number().positive(),
    relaxExpPerDay: z.number().nonnegative(),
    fullRewardThresholdMinutes: z.number().int().positive(),
    earlyWithdrawalMultiplier: z.number().min(0).max(1),
    maxAccumulation: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("fixed-days"),
          days: z.number().int().positive(),
        })
        .strict(),
      z.object({ kind: z.literal("calendar-year") }).strict(),
    ]),
    rounding: z
      .object({
        stage: z.enum([
          "per-minute",
          "per-source",
          "after-combine",
          "after-early-withdrawal",
          "after-nature",
        ]),
        mode: z.enum(["floor", "round", "ceil", "truncate"]),
      })
      .strict(),
    natureApplication: z
      .object({ stage: z.literal("after-early-withdrawal") })
      .strict(),
    sourceRefs: sourceRefsSchema,
  })
  .strict();

const expTypeSchema = z.union(EXP_TYPES.map((value) => z.literal(value)));

export const expCurveMasterSchema = z
  .object({
    dataVersion: z.string().min(1),
    maxDefinedLevel: z.number().int().min(2),
    baseExpType: z.literal(600),
    typeMultipliers: z
      .object({
        "600": z.literal(1),
        "900": z.number().positive(),
        "1080": z.number().positive(),
        "1320": z.number().positive(),
      })
      .strict(),
    baseCumulativeExpToReachLevel: z.record(
      z.string().regex(/^\d+$/),
      z.number().int().nonnegative(),
    ),
    sourceRefs: sourceRefsSchema,
    confidence: dataConfidenceSchema,
  })
  .strict();

export const natureMasterSchema = z
  .object({
    dataVersion: z.string().min(1),
    sourceRefs: sourceRefsSchema,
    confidence: dataConfidenceSchema,
    natures: z
      .array(
        z
          .object({
            id: z.string().min(1),
            nameJa: z.string().min(1),
            expEffect: z.enum(["up", "neutral", "down"]),
            multiplier: z.number().positive(),
          })
          .strict(),
      )
      .length(25),
  })
  .strict();

export const pokemonExpTypeMasterSchema = z
  .object({
    dataVersion: z.string().min(1),
    sourceRefs: sourceRefsSchema,
    confidence: dataConfidenceSchema,
    coverage: z.literal("source-confirmed-non-default-families"),
    pokemon: z.array(
      z
        .object({
          id: z.string().min(1),
          nameJa: z.string().min(1),
          nameKey: z.string().min(1),
          evolutionFamilyId: z.string().min(1),
          expType: expTypeSchema,
          available: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export const dataManifestSchema = z
  .object({
    dataVersion: z.string().min(1),
    generatedAt: z.iso.datetime({ offset: true }),
    ruleSetId: z.string().min(1),
    expCurveVersion: z.string().min(1),
    natureVersion: z.string().min(1),
    pokemonExpTypeVersion: z.string().min(1),
  })
  .strict();
