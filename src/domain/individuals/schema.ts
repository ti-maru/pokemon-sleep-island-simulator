import { z } from "zod";

export const pokemonIndividualSchema = z
  .object({
    id: z.string().min(1),
    pokemonId: z.string().min(1).nullable(),
    displayName: z.string().trim().min(1).max(80),
    natureId: z.string().min(1).nullable(),
    expEffectOverride: z.enum(["up", "neutral", "down"]).nullable(),
    expTypeOverride: z
      .union([z.literal(600), z.literal(900), z.literal(1080), z.literal(1320)])
      .nullable(),
    currentLevel: z.number().int().min(1).max(70),
    remainingExpToNextLevel: z.number().int().nonnegative().nullable(),
    targetLevel: z.number().int().min(1).max(70).nullable(),
    targetDate: z.iso.datetime({ offset: true }).nullable(),
    targetTimezone: z.string().min(1).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const pokemonIndividualListSchema = z.array(pokemonIndividualSchema);
