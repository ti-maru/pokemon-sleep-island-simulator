import type { DepositSession } from "../deposits/types";
import type { CalculationHistoryRecord, NamedSnapshot } from "../history/types";
import type { PokemonIndividual } from "../individuals/types";
import type { GrowthPlan } from "../plans/types";
import type { PersistedSettings } from "../settings/types";

export interface BackupPayload {
  readonly individuals: readonly PokemonIndividual[];
  readonly sessions: readonly DepositSession[];
  readonly histories: readonly CalculationHistoryRecord[];
  readonly snapshots: readonly NamedSnapshot[];
  readonly plans: readonly GrowthPlan[];
  readonly settings: PersistedSettings;
}

export interface BackupEnvelope {
  readonly format: "pokemon-sleep-island-simulator-backup";
  readonly schemaVersion: 1;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly dataVersion: string;
  readonly payload: BackupPayload;
}
