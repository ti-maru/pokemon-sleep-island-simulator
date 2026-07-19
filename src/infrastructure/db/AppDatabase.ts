import Dexie, { type EntityTable } from "dexie";

import type { DepositSession } from "../../domain/deposits/types";
import type { PokemonIndividual } from "../../domain/individuals/types";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { GrowthPlan } from "../../domain/plans/types";
import type { PersistedSettings } from "../../domain/settings/types";

export class AppDatabase extends Dexie {
  individuals!: EntityTable<PokemonIndividual, "id">;
  depositSessions!: EntityTable<DepositSession, "id">;
  histories!: EntityTable<CalculationHistoryRecord, "id">;
  snapshots!: EntityTable<NamedSnapshot, "id">;
  growthPlans!: EntityTable<GrowthPlan, "id">;
  appSettings!: EntityTable<PersistedSettings, "id">;

  constructor(databaseName = "pokemonSleepIslandSimulator") {
    super(databaseName);

    this.version(1).stores({
      individuals:
        "id, pokemonId, displayName, currentLevel, targetDate, updatedAt",
      depositSessions: "id, status, individualId, startedAt, updatedAt",
      growthPlans: "id, individualId, status, targetDate, updatedAt",
      histories: "id, kind, individualId, planId, createdAt",
      snapshots: "id, individualId, createdAt",
      verificationRecords: "id, createdAt",
      appSettings: "id",
      migrationBackups: "id, createdAt",
    });
  }
}
