import { pokemonIndividualSchema } from "../../domain/individuals/schema";
import type { PokemonIndividual } from "../../domain/individuals/types";
import type { ExpEffect, ExpType } from "../../domain/leveling/types";
import type { AppRepository } from "../persistence/AppRepository";

export interface IndividualInput {
  readonly pokemonId: string | null;
  readonly displayName: string;
  readonly natureId: string | null;
  readonly expEffectOverride: ExpEffect | null;
  readonly expTypeOverride: ExpType | null;
  readonly currentLevel: number;
  readonly remainingExpToNextLevel: number | null;
  readonly targetLevel: number | null;
  readonly targetDate: string | null;
  readonly targetTimezone: string | null;
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `individual-${Date.now()}-${Math.random()}`
  );
}

export async function createIndividual(
  repository: AppRepository,
  input: IndividualInput,
  now = new Date().toISOString(),
): Promise<PokemonIndividual> {
  const individual = pokemonIndividualSchema.parse({
    ...input,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  });
  await repository.putIndividual(individual);
  return individual;
}

export async function updateIndividual(
  repository: AppRepository,
  existing: PokemonIndividual,
  input: IndividualInput,
  now = new Date().toISOString(),
): Promise<PokemonIndividual> {
  const individual = pokemonIndividualSchema.parse({
    ...existing,
    ...input,
    updatedAt: now,
  });
  await repository.putIndividual(individual);
  return individual;
}

export async function duplicateIndividual(
  repository: AppRepository,
  existing: PokemonIndividual,
  now = new Date().toISOString(),
): Promise<PokemonIndividual> {
  return createIndividual(
    repository,
    {
      pokemonId: existing.pokemonId,
      displayName: `${existing.displayName} のコピー`,
      natureId: existing.natureId,
      expEffectOverride: existing.expEffectOverride,
      expTypeOverride: existing.expTypeOverride,
      currentLevel: existing.currentLevel,
      remainingExpToNextLevel: existing.remainingExpToNextLevel,
      targetLevel: existing.targetLevel,
      targetDate: existing.targetDate,
      targetTimezone: existing.targetTimezone,
    },
    now,
  );
}
