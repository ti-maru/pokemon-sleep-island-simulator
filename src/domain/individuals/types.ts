import type { ExpEffect, ExpType } from "../leveling/types";
import type { EntityId, IanaTimeZone, ISODateTime } from "../shared/types";

export interface PokemonIndividual {
  readonly id: EntityId;
  readonly pokemonId: string | null;
  readonly displayName: string;
  readonly natureId: string | null;
  readonly expEffectOverride: ExpEffect | null;
  readonly expTypeOverride: ExpType | null;
  readonly currentLevel: number;
  readonly remainingExpToNextLevel: number | null;
  readonly targetLevel: number | null;
  readonly targetDate: ISODateTime | null;
  readonly targetTimezone: IanaTimeZone | null;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}
