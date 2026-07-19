import type { DepositSession } from "../../domain/deposits/types";
import type { BackupPayload } from "../../domain/backup/types";
import type {
  CalculationHistoryRecord,
  NamedSnapshot,
} from "../../domain/history/types";
import type { GrowthPlan } from "../../domain/plans/types";
import type { PersistedSettings } from "../../domain/settings/types";
import type { PokemonIndividual } from "../../domain/individuals/types";

export type StorageMode = "indexeddb" | "localstorage";

export class ActiveDepositConflictError extends Error {
  constructor() {
    super("An active deposit session already exists.");
    this.name = "ActiveDepositConflictError";
  }
}

export interface AppRepository {
  readonly mode: StorageMode;
  initialize(): Promise<void>;
  listIndividuals(): Promise<readonly PokemonIndividual[]>;
  putIndividual(individual: PokemonIndividual): Promise<void>;
  deleteIndividual(id: string): Promise<void>;
  listDepositSessions(): Promise<readonly DepositSession[]>;
  getActiveDeposit(): Promise<DepositSession | null>;
  startDeposit(session: DepositSession, replaceActive: boolean): Promise<void>;
  completeDeposit(
    session: DepositSession,
    updatedIndividual: PokemonIndividual | null,
    history?: CalculationHistoryRecord,
  ): Promise<void>;
  restoreDeposit(
    session: DepositSession,
    previousIndividual: PokemonIndividual | null,
    historyId?: string,
  ): Promise<void>;
  listHistories(): Promise<readonly CalculationHistoryRecord[]>;
  putHistory(history: CalculationHistoryRecord): Promise<void>;
  deleteHistory(id: string): Promise<void>;
  listSnapshots(): Promise<readonly NamedSnapshot[]>;
  putSnapshot(snapshot: NamedSnapshot): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  listGrowthPlans(): Promise<readonly GrowthPlan[]>;
  putGrowthPlan(plan: GrowthPlan): Promise<void>;
  deleteGrowthPlan(id: string): Promise<void>;
  getSettings(): Promise<PersistedSettings>;
  putSettings(settings: PersistedSettings): Promise<void>;
  readBackupPayload(): Promise<BackupPayload>;
  restoreBackupPayload(
    payload: BackupPayload,
    mode: "replace" | "merge",
  ): Promise<void>;
}
